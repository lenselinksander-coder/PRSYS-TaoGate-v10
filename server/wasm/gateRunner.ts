// server/wasm/gateRunner.ts
//
// WebAssembly gate sandbox using QuickJS (quickjs-emscripten).
//
// Each gate evaluation runs inside an isolated QuickJS VM context.
// The context has no access to:
//   - File system
//   - Network
//   - Host module system (no require / import)
//   - Node.js globals (process, Buffer, etc.)
//
// Fuel-based termination (instruction counter):
//   The QuickJS interrupt handler is polled after every N bytecode
//   instructions. When the counter exceeds FUEL_LIMIT, the VM throws
//   an InternalError("interrupted") and the context is disposed.
//   This is deterministic — it does not depend on wall-clock time.
//
// Usage:
//   const result = await runGateWasm("morfine toedienen", "CLINICAL");

import { getQuickJS, type QuickJSWASMModule } from "quickjs-emscripten";
import type { GateProfile } from "@shared/schema";
import type { GateResult } from "../gateSystem";
import { GATE_BUNDLE_SOURCE } from "./bundledGates";

// ── Configuration ─────────────────────────────────────────────────────────────

/**
 * Maximum number of QuickJS interrupt-handler polls before the gate is
 * forcibly terminated and the request is treated as BLOCK.
 *
 * The interrupt handler is called after every ~(10_000) bytecode instructions
 * by default in QuickJS. At FUEL_LIMIT = 100, that's ~1 000 000 instructions
 * before hard-kill — enough for any pattern-matching gate, far too few for
 * an infinite loop.
 */
const FUEL_LIMIT = 100;

// ── Singleton WASM module ─────────────────────────────────────────────────────
// getQuickJS() loads and compiles the WASM binary once; subsequent calls
// resolve immediately from cache.

let _quickJS: QuickJSWASMModule | null = null;

async function getVM(): Promise<QuickJSWASMModule> {
  if (!_quickJS) {
    _quickJS = await getQuickJS();
  }
  return _quickJS;
}

// ── BLOCK fallback (returned on sandbox errors / fuel exhaustion) ─────────────

function timeoutBlockResult(): GateResult {
  return {
    status: "BLOCK",
    layer: "SYSTEM",
    band: "GATE_TIMEOUT",
    pressure: "CRITICAL",
    escalation: "SYSTEM_ADMIN",
    reason: "Gate sandbox: instructielimiet (fuel) bereikt — geblokkeerd als fail-safe.",
    signals: null,
  };
}

function errorBlockResult(message: string): GateResult {
  return {
    status: "BLOCK",
    layer: "SYSTEM",
    band: "SANDBOX_ERROR",
    pressure: "CRITICAL",
    escalation: "SYSTEM_ADMIN",
    reason: `Gate sandbox fout — geblokkeerd als fail-safe: ${message}`,
    signals: null,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Evaluate a gate inside a hermetic QuickJS WASM VM.
 *
 * - Memory is fully released after each call (context.dispose + runtime.dispose).
 * - The VM has no I/O capabilities: no fetch, no fs, no require.
 * - Fuel-based interrupt: exceeding FUEL_LIMIT returns a BLOCK result.
 */
export async function runGateWasm(
  input: string,
  profile: GateProfile,
): Promise<GateResult> {
  const QuickJS = await getVM();

  // Create a fresh runtime + context per request
  const runtime = QuickJS.newRuntime();

  // ── Fuel counter (instruction-based termination) ──────────────────────────
  let pollCount = 0;
  let fuelExhausted = false;

  runtime.setInterruptHandler(() => {
    pollCount++;
    if (pollCount > FUEL_LIMIT) {
      fuelExhausted = true;
      return true; // interrupt: QuickJS throws InternalError("interrupted")
    }
    return false;
  });

  const vm = runtime.newContext();

  try {
    // Inject __input__ and __profile__ as immutable VM globals
    const inputHandle = vm.newString(input);
    const profileHandle = vm.newString(profile);
    vm.setProp(vm.global, "__input__", inputHandle);
    vm.setProp(vm.global, "__profile__", profileHandle);
    inputHandle.dispose();
    profileHandle.dispose();

    // Evaluate: bundle defines all gate functions, then calls runGate
    const evalResult = vm.evalCode(
      `${GATE_BUNDLE_SOURCE};\nJSON.stringify(runGate(__input__, __profile__));`,
    );

    if (evalResult.error) {
      const errorMsg = vm.dump(evalResult.error) as string;
      evalResult.error.dispose();
      if (fuelExhausted) {
        return timeoutBlockResult();
      }
      return errorBlockResult(String(errorMsg));
    }

    const jsonString = vm.getString(evalResult.value);
    evalResult.value.dispose();

    return JSON.parse(jsonString) as GateResult;
  } catch (err: unknown) {
    if (fuelExhausted) {
      return timeoutBlockResult();
    }
    return errorBlockResult(err instanceof Error ? err.message : String(err));
  } finally {
    // Always release: memory leak is impossible regardless of outcome
    vm.dispose();
    runtime.dispose();
  }
}
