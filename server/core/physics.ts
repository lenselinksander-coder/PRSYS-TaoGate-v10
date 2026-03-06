// PRSYS Runtime-Fysica — EN-2026-002 (Herzien)
// Canonieke correcties:
//   1. TI als PRE-GATE conditie, niet als formulecomponent
//   2. R hernoemd naar SI (Spanningsindex): SI = τ × ω
//   3. Resonantie teruggeplaatst naar Canon (Laag 0) — niet formaliseerbaar als getal
//
// State Machine: q0 INIT → q1 MANDATE_CHECK → q2 PRE_GATE (TI-GATE) → q3 EXECUTE → q4 POST_GATE → q5 REPORT → q6 ESCALATE → q7 BLOCK → q8 CLOSE
//
// F2: SI = τ × ω           [alleen geldig binnen gevalideerde TI-envelop]
// F4: ω ≤ f(τ − σ_ext)     [O36-constraint]
// F5: TI-GATE: TI < TI_min → BLOCK | TI ≥ TI_min → SI
//
// INVARIANT: τ, ω, TI zijn runtime_meta — beïnvloeden NOOIT decision_hash (A6)

import * as crypto from "crypto";

// ─── Engine Constants ───

export interface PhysicsConfig {
  readonly tau_max: number;
  readonly tau_weights: readonly [number, number, number, number, number];
  readonly payload_bytes_cap: number;
  readonly omega_max: number;
  readonly omega_window_sec: number;
  readonly worker_count: number;
  readonly mean_exec_time_target_ms: number;
  readonly queue_cap: number;
  readonly ti_epsilon: number;
  readonly ti_min: number;
  readonly si_warn: number;
  readonly si_block: number;
  readonly shadow_sample_rate: number;
  readonly shadow_sample_cap: number;
  readonly ewma_alpha: number;
  readonly ti_window_size: number;
}

const DEFAULT_PHYSICS_CONFIG: PhysicsConfig = {
  tau_max: 50,
  tau_weights: [1.0, 0.8, 1.2, 0.5, 0.3],
  payload_bytes_cap: 10_000,
  omega_max: 2.0,
  omega_window_sec: 10,
  worker_count: 10,
  mean_exec_time_target_ms: 50,
  queue_cap: 100,
  ti_epsilon: 0.05,
  ti_min: 0.6,
  si_warn: 0.7,
  si_block: 0.9,
  shadow_sample_rate: 0.01,
  shadow_sample_cap: 5,
  ewma_alpha: 0.1,
  ti_window_size: 500,
};

let _physicsConfig: Readonly<PhysicsConfig> | null = null;

export function bootstrapPhysics(overrides?: Partial<PhysicsConfig>): Readonly<PhysicsConfig> {
  if (_physicsConfig !== null) {
    return _physicsConfig;
  }
  const config = { ...DEFAULT_PHYSICS_CONFIG, ...overrides };
  _physicsConfig = Object.freeze(config);
  console.log(`[PHYSICS] Bootstrapped. TI_min=${config.ti_min} SI_warn=${config.si_warn} SI_block=${config.si_block} τ_max=${config.tau_max}`);
  console.log(`[PHYSICS]   ω_window=${config.omega_window_sec}s workers=${config.worker_count} shadow_rate=${config.shadow_sample_rate}`);
  return _physicsConfig;
}

export function getPhysicsConfig(): Readonly<PhysicsConfig> {
  if (!_physicsConfig) {
    throw new Error("[PHYSICS] FAIL-FAST: Physics not bootstrapped. Call bootstrapPhysics() at server boot.");
  }
  return _physicsConfig;
}

// ─── Utility ───

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ─── 1) τ — Draagkracht / Torque (per Decision Context) ───
// Systeemcapaciteit om besluitbelasting te dragen zonder structureel falen.
// Analoog aan mechanisch koppel (OLYMPIA O36).

export interface TauInput {
  rules_evaluated: number;
  branches_taken: number;
  proof_steps: number;
  payload_bytes: number;
  policy_depth: number;
}

export interface TauResult {
  tau: number;
  tau_raw: number;
  components: {
    rules_evaluated: number;
    branches_taken: number;
    proof_steps: number;
    payload_size_norm: number;
    policy_depth: number;
  };
}

export function computeTau(input: TauInput): TauResult {
  const config = getPhysicsConfig();
  const [a1, a2, a3, a4, a5] = config.tau_weights;

  const payload_size_norm = clamp01(input.payload_bytes / config.payload_bytes_cap);

  const tau_raw =
    a1 * input.rules_evaluated +
    a2 * input.branches_taken +
    a3 * input.proof_steps +
    a4 * payload_size_norm +
    a5 * input.policy_depth;

  const tau = clamp01(tau_raw / config.tau_max);

  return {
    tau,
    tau_raw,
    components: {
      rules_evaluated: input.rules_evaluated,
      branches_taken: input.branches_taken,
      proof_steps: input.proof_steps,
      payload_size_norm,
      policy_depth: input.policy_depth,
    },
  };
}

// ─── 2) ω — Besluit-velocity (systeemniveau) ───
// Snelheid waarmee besluiten worden genomen en doorgezet.
// Hogere ω verhoogt SI; vereist proportioneel hogere τ.
// F4: ω ≤ f(τ − σ_ext) — velocity begrensd door netto draagkracht na aftrek externe druk.

interface ArrivalRecord {
  timestamp_ms: number;
}

const _arrivals: ArrivalRecord[] = [];
let _inflight = 0;
let _queueDepth = 0;
let _omega_ewma = 0;

export function recordArrival(): void {
  _arrivals.push({ timestamp_ms: Date.now() });
}

export function incrementInflight(): void {
  _inflight++;
}

export function decrementInflight(): void {
  _inflight = Math.max(0, _inflight - 1);
}

export function setQueueDepth(depth: number): void {
  _queueDepth = Math.max(0, depth);
}

export function getInflight(): number {
  return _inflight;
}

export interface OmegaResult {
  omega: number;
  omega_raw: number;
  arrivals_per_sec: number;
  inflight: number;
  queue_depth: number;
  load_ratio: number;
  pressure: number;
  capacity: number;
}

export function computeOmega(): OmegaResult {
  const config = getPhysicsConfig();
  const now = Date.now();
  const windowMs = config.omega_window_sec * 1000;
  const cutoff = now - windowMs;

  while (_arrivals.length > 0 && _arrivals[0].timestamp_ms < cutoff) {
    _arrivals.shift();
  }

  const arrivals_per_sec = _arrivals.length / config.omega_window_sec;
  const capacity = config.worker_count / (config.mean_exec_time_target_ms / 1000);

  const load_ratio = capacity > 0 ? arrivals_per_sec / capacity : 1;
  const pressure = Math.max(
    config.worker_count > 0 ? _inflight / config.worker_count : 0,
    config.queue_cap > 0 ? _queueDepth / config.queue_cap : 0,
  );

  const omega_raw = Math.max(load_ratio, pressure);
  const omega_unbounded = omega_raw / config.omega_max;
  const omega_instant = clamp01(omega_unbounded);

  _omega_ewma = config.ewma_alpha * omega_instant + (1 - config.ewma_alpha) * _omega_ewma;
  const omega = clamp01(_omega_ewma);

  return {
    omega,
    omega_raw,
    arrivals_per_sec,
    inflight: _inflight,
    queue_depth: _queueDepth,
    load_ratio,
    pressure,
    capacity,
  };
}

// ─── 3) TI — Transfer Integrity (PRE-GATE conditie, NIET formulecomponent) ───
// F5: TI-GATE: TI < TI_min → BLOCK (q7, terminaal) | TI ≥ TI_min → q3 EXECUTE
// TI = clamp(DI × TrI × II × CI × ToI, ε, 1.0) — multiplicatief composiet
// TI_min is canonieke parameter per Decision Context — vastgesteld door de Steward.
// Wijziging vereist legitiem mandaat (F3) en audit (A8).
// TI is geen formulecomponent. SI wordt niet berekend indien TI-GATE blokkeert.

interface IntegrityWindow {
  total: number;
  failures: number;
}

const _tiWindows = {
  determinism: { total: 0, failures: 0 } as IntegrityWindow,
  trace: { total: 0, failures: 0 } as IntegrityWindow,
  isolation: { total: 0, failures: 0 } as IntegrityWindow,
  crypto: { total: 0, failures: 0 } as IntegrityWindow,
  timeout: { total: 0, failures: 0 } as IntegrityWindow,
};

function windowRate(w: IntegrityWindow): number {
  if (w.total === 0) return 0;
  return w.failures / w.total;
}

function trimWindow(w: IntegrityWindow, maxSize: number): void {
  if (w.total > maxSize) {
    const ratio = w.failures / w.total;
    w.total = Math.floor(maxSize * 0.8);
    w.failures = Math.round(w.total * ratio);
  }
}

export function recordDeterminismCheck(match: boolean): void {
  const config = getPhysicsConfig();
  _tiWindows.determinism.total++;
  if (!match) _tiWindows.determinism.failures++;
  trimWindow(_tiWindows.determinism, config.ti_window_size);
}

export function recordTraceCheck(success: boolean): void {
  const config = getPhysicsConfig();
  _tiWindows.trace.total++;
  if (!success) _tiWindows.trace.failures++;
  trimWindow(_tiWindows.trace, config.ti_window_size);
}

export function recordIsolationEvent(violation: boolean): void {
  const config = getPhysicsConfig();
  _tiWindows.isolation.total++;
  if (violation) _tiWindows.isolation.failures++;
  trimWindow(_tiWindows.isolation, config.ti_window_size);
}

export function recordCryptoCheck(success: boolean): void {
  const config = getPhysicsConfig();
  _tiWindows.crypto.total++;
  if (!success) _tiWindows.crypto.failures++;
  trimWindow(_tiWindows.crypto, config.ti_window_size);
}

export function recordTimeoutEvent(timedOut: boolean): void {
  const config = getPhysicsConfig();
  _tiWindows.timeout.total++;
  if (timedOut) _tiWindows.timeout.failures++;
  trimWindow(_tiWindows.timeout, config.ti_window_size);
}

export interface TIComponents {
  DI: number;
  TrI: number;
  II: number;
  CI: number;
  ToI: number;
}

export interface TIResult {
  ti: number;
  components: TIComponents;
  samples: {
    determinism: number;
    trace: number;
    isolation: number;
    crypto: number;
    timeout: number;
  };
}

export function computeTI(): TIResult {
  const config = getPhysicsConfig();

  const DI = 1 - windowRate(_tiWindows.determinism);
  const TrI = 1 - windowRate(_tiWindows.trace);
  const II = 1 - windowRate(_tiWindows.isolation);
  const CI = 1 - windowRate(_tiWindows.crypto);
  const ToI = 1 - windowRate(_tiWindows.timeout);

  const ti_raw = DI * TrI * II * CI * ToI;
  const ti = clamp(ti_raw, config.ti_epsilon, 1.0);

  return {
    ti,
    components: { DI, TrI, II, CI, ToI },
    samples: {
      determinism: _tiWindows.determinism.total,
      trace: _tiWindows.trace.total,
      isolation: _tiWindows.isolation.total,
      crypto: _tiWindows.crypto.total,
      timeout: _tiWindows.timeout.total,
    },
  };
}

// ─── 4) TI-GATE (F5) — PRE-GATE conditie ───
// A11: SI-stabiliteit vereist TI ≥ TI_min. Zonder geldige TI-envelop is SI niet gedefinieerd.
// A9: BLOCK is absoluut. Geen omzeiling, geen compensatie via andere variabelen.

export type TIGateAction = "ALLOW" | "BLOCK";

export interface TIGateResult {
  ti: number;
  ti_min: number;
  action: TIGateAction;
  components: TIComponents;
  ti_detail: TIResult;
}

export function evaluateTIGate(tiResult: TIResult): TIGateResult {
  const config = getPhysicsConfig();
  const action: TIGateAction = tiResult.ti >= config.ti_min ? "ALLOW" : "BLOCK";

  return {
    ti: tiResult.ti,
    ti_min: config.ti_min,
    action,
    components: tiResult.components,
    ti_detail: tiResult,
  };
}

// ─── 5) SI — Spanningsindex (F2, vervangt R) ───
// SI = τ × ω — systeembelastingsvector
// Alleen geldig binnen gevalideerde TI-envelop (TI ≥ TI_min).
// SI wordt NIET berekend indien TI-GATE blokkeert.

export type SIAction = "ALLOW" | "THROTTLE" | "DEFER" | "HARD_BLOCK";

export interface SIDecision {
  tau: number;
  omega: number;
  si: number;
  si_warn: number;
  si_block: number;
  action: SIAction;
  tau_detail: TauResult;
  omega_detail: OmegaResult;
}

export function evaluateSI(tauResult: TauResult, omegaResult: OmegaResult): SIDecision {
  const config = getPhysicsConfig();

  const { tau } = tauResult;
  const { omega } = omegaResult;

  const si = tau * omega;

  let action: SIAction;
  if (si >= config.si_block) {
    action = "HARD_BLOCK";
  } else if (si >= config.si_warn) {
    action = "THROTTLE";
  } else {
    action = "ALLOW";
  }

  return {
    tau,
    omega,
    si,
    si_warn: config.si_warn,
    si_block: config.si_block,
    action,
    tau_detail: tauResult,
    omega_detail: omegaResult,
  };
}

// ─── 6) Gecombineerde Physics Decision ───
// Volgorde: TI-GATE → SI → actie
// TI-GATE blokkeert → SI niet berekend

export interface PhysicsDecision {
  tau: number;
  omega: number;
  ti_gate: TIGateResult;
  si: SIDecision | null;
  action: SIAction | "TI_BLOCK";
  state: string;
}

export function evaluatePhysics(tauResult: TauResult, omegaResult: OmegaResult, tiResult: TIResult): PhysicsDecision {
  const tiGate = evaluateTIGate(tiResult);

  if (tiGate.action === "BLOCK") {
    return {
      tau: tauResult.tau,
      omega: omegaResult.omega,
      ti_gate: tiGate,
      si: null,
      action: "TI_BLOCK",
      state: "q7_BLOCK",
    };
  }

  const si = evaluateSI(tauResult, omegaResult);

  return {
    tau: tauResult.tau,
    omega: omegaResult.omega,
    ti_gate: tiGate,
    si,
    action: si.action,
    state: si.action === "HARD_BLOCK" ? "q7_BLOCK" : si.action === "THROTTLE" ? "q6_ESCALATE" : "q3_EXECUTE",
  };
}

// ─── 7) Shadow Determinism Sampling (Optie A met cap) ───

let _shadowSamplesThisWindow = 0;
let _shadowWindowStart = Date.now();

export function shouldShadowSample(): boolean {
  const config = getPhysicsConfig();
  const now = Date.now();

  if (now - _shadowWindowStart > config.omega_window_sec * 1000) {
    _shadowSamplesThisWindow = 0;
    _shadowWindowStart = now;
  }

  if (_shadowSamplesThisWindow >= config.shadow_sample_cap) {
    return false;
  }

  if (Math.random() < config.shadow_sample_rate) {
    _shadowSamplesThisWindow++;
    return true;
  }

  return false;
}

export function performShadowCheck(
  decideFn: (input: string) => any,
  input: string,
  originalHash: string,
): boolean {
  try {
    const shadowResult = decideFn(input);
    const shadowPayload = JSON.stringify(shadowResult);
    const shadowHash = crypto.createHash("sha256").update(shadowPayload).digest("hex");
    const match = shadowHash === originalHash;
    recordDeterminismCheck(match);
    return match;
  } catch {
    recordDeterminismCheck(false);
    return false;
  }
}

// ─── 8) Compact JSON shape voor logging ───

export interface PhysicsLogEntry {
  dc_hash: string;
  tau: number;
  omega: number;
  ti: number;
  ti_min: number;
  ti_gate: TIGateAction;
  si: number | null;
  si_warn: number;
  si_block: number;
  action: SIAction | "TI_BLOCK";
  state: string;
  components: TIComponents;
}

export function toLogEntry(dcHash: string, decision: PhysicsDecision): PhysicsLogEntry {
  return {
    dc_hash: dcHash,
    tau: round4(decision.tau),
    omega: round4(decision.omega),
    ti: round4(decision.ti_gate.ti),
    ti_min: decision.ti_gate.ti_min,
    ti_gate: decision.ti_gate.action,
    si: decision.si ? round4(decision.si.si) : null,
    si_warn: decision.si?.si_warn ?? getPhysicsConfig().si_warn,
    si_block: decision.si?.si_block ?? getPhysicsConfig().si_block,
    action: decision.action,
    state: decision.state,
    components: {
      DI: round4(decision.ti_gate.components.DI),
      TrI: round4(decision.ti_gate.components.TrI),
      II: round4(decision.ti_gate.components.II),
      CI: round4(decision.ti_gate.components.CI),
      ToI: round4(decision.ti_gate.components.ToI),
    },
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
