import { randomUUID } from "crypto";
import type { GateProfile, GateDecision, Scope, ScopeRule } from "@shared/schema";
import { storage } from "../storage";
import { fetchOnderbouwing } from "../perplexity";
import { runArgos } from "./argos";
import { runArachne } from "./arachne";
import { runLogos, classifyWithScope } from "./logos";
import { runCerberus, resolveOlympiaRules } from "./olympia";
import { runCastra } from "./castra";
import { runValkyrie } from "./valkyrie";
import { runTaoGate } from "./taogate";
import { runCoVe } from "./cove";
import { runAudit } from "./audit";
import { auditLog } from "../audit";
import { evaluateImplicitPressure, routeImplicitPressure, taoGateSchema } from "./clinical";
import { orchestrateGate } from "../fsm";
import { cerberusEnforce, normaliseDecision, latticeMax } from "./types";
import { evaluateVector } from "../vector_engine";
import type { VectorEvaluation, VectorDecision } from "../vector_engine";
import type {
  PipelineInput,
  PipelineResult,
  PipelineStep,
  ScopeClassification,
  OlympiaResolution,
  LatticeDecision,
  HypatiaResult,
  PhronesisResult,
} from "./types";
import { hypatiaRisk, classifyDpiaLevel, DPIA_LEVEL_LABELS } from "../trace";
import { phronesisCapacity } from "../trace";

export type { PipelineInput, PipelineResult, PipelineStep, ScopeClassification, OlympiaResolution } from "./types";
export { classifyWithScope } from "./logos";
export { resolveOlympiaRules, preflightCheck, runCerberus } from "./olympia";
export { cerberusEnforce } from "./types";
export { runMultiTapePipeline } from "./multiTape";
export type { MultiTapePipelineResult, TapeEvalResult } from "./multiTape";

// ── Vector Legitimacy Engine — hulpfuncties ───────────────────────────────────

/**
 * Vertaalt een gate-beslissingsstatus naar een mandate-waarde [0..1].
 * Hoge mandate = hoge governance-bevoegdheid voor de actie.
 */
function gateStatusToMandate(status: string): number {
  switch (status) {
    case "PASS":                  return 1.0;
    case "PASS_WITH_TRANSPARENCY": return 0.75;
    case "ESCALATE_HUMAN":        return 0.3;
    case "ESCALATE_REGULATORY":   return 0.2;
    case "BLOCK":                 return 0.0;
    default:                      return 0.0;
  }
}

/**
 * Vertaalt een VectorDecision naar een pipeline-lattice beslissing.
 * GO      → "PASS"           (geen extra restrictie)
 * HOLD    → "ESCALATE_HUMAN" (menselijke review vereist)
 * NO_GO   → "BLOCK"          (uitvoering geblokkeerd)
 */
function vectorDecisionToLattice(d: VectorDecision): string {
  switch (d) {
    case "GO":    return "PASS";
    case "HOLD":  return "ESCALATE_HUMAN";
    case "NO_GO": return "BLOCK";
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function runPipeline(opts: PipelineInput): Promise<PipelineResult> {
  const totalStart = Date.now();
  const auditId = randomUUID();
  const steps: PipelineStep[] = [];

  const {
    input,
    profile = "GENERAL",
    tau = 1.0,
    omega = 0.8,
    probability = 0.5,
  } = opts;

  const impact = opts.impact ?? Math.min(1.0, input.length / 200);

  const argosStep = runArgos(input);
  steps.push(argosStep);

  if (argosStep.decision === "EMPTY") {
    const hypatia = hypatiaRisk(impact, probability);
    const phronesis = phronesisCapacity(tau, omega, hypatia.risk);
    return {
      auditId,
      input,
      steps,
      lattice: { D_gate: "PASS", D_scope: "PASS", D_runtime: "PASS", D_final: "PASS" },
      hypatia,
      phronesis,
      vector: null,
      finalDecision: "PASS",
      finalReason: "Lege invoer — doorgelaten zonder verdere verwerking.",
      dpiaLevel: hypatia.dpiaLevel,
      dpiaLabel: hypatia.dpiaLabel,
      processingMs: Date.now() - totalStart,
    };
  }

  steps.push(runArachne(input));

  const logosResult = runLogos(input, profile);
  const { domain: _domain, ...logosStep } = logosResult;
  steps.push(logosStep);

  const { step: cerberusStep, gate, blocked: cerberusBlocked } = runCerberus(input, profile);
  steps.push(cerberusStep);

  const castraOut = runCastra({ cerberusBlocked, impact, probability, tau, omega });
  steps.push(...castraOut.steps);

  const D_gate = gate.status;
  const D_scope = cerberusBlocked ? "BLOCK" as string : normaliseDecision(castraOut.result.hypatia.decision);
  const D_runtime = cerberusBlocked ? "BLOCK" as string : (castraOut.result.phronesis.decision === "ESCALATE" ? "ESCALATE_HUMAN" : "PASS");

  // ── Vector Legitimacy Engine ────────────────────────────────────────────────
  // Leid de drie governance-dimensies af uit bestaande pipeline-uitkomsten.
  // Cerberus-garantie: een berekeningsfout levert HOLD op (conservatief),
  // nooit een onafgehandelde uitzondering.
  const vectorMandate   = gateStatusToMandate(gate.status);
  const vectorIntegrity = Math.max(0, 1 - castraOut.result.hypatia.risk);
  const vectorLoad      = Math.min(1, Math.max(0, castraOut.result.phronesis.SI));

  let vectorEval: VectorEvaluation | null = null;
  try {
    vectorEval = evaluateVector({ mandate: vectorMandate, integrity: vectorIntegrity, load: vectorLoad });
  } catch {
    // Berekeningsfout → conservatief HOLD; pipeline gaat door
    vectorEval = null;
  }

  const D_vector = vectorDecisionToLattice(vectorEval?.decision ?? "HOLD");
  // D_vector weegt mee als vierde lattice-dimensie via D_runtime
  const D_runtime_final = latticeMax(D_runtime, D_vector);

  const vectorStepT = Date.now();
  steps.push({
    name: "Vector",
    symbol: "⟨V⟩",
    role: "Vector Legitimacy Engine — stabiliteitsanalyse (mandate × integrity × load)",
    decision: vectorEval?.decision ?? "HOLD",
    detail: vectorEval
      ? `stability=${vectorEval.stability.toFixed(3)} | legitimacy=${vectorEval.legitimacyScore.toFixed(3)} | ` +
        `risk=${vectorEval.risk.toFixed(3)} | mandate=${vectorMandate.toFixed(2)}, ` +
        `integrity=${vectorIntegrity.toFixed(2)}, load=${vectorLoad.toFixed(2)} → ${vectorEval.decision}`
      : `Vector engine fout — HOLD als Cerberus-fallback (D_runtime_final=${D_runtime_final})`,
    durationMs: Date.now() - vectorStepT,
  });
  // ── Einde Vector Legitimacy Engine ─────────────────────────────────────────

  const valkyrieResult = runValkyrie(D_gate, D_scope, D_runtime_final, gate.escalation);
  steps.push(valkyrieResult.step);

  const taoGateResult = runTaoGate(D_gate, D_scope, D_runtime_final, gate.escalation);
  steps.push(...taoGateResult.steps);

  // ── q4b VERIFY: CoVe — CV = V(G) ⊥ V(L) ⊥ V(E) ────────────────────────────
  // I6: evaluators (Hypatia, EuLegalGate, Arachne) zijn structureel ≠ producenten
  const coveResult = runCoVe(input, impact, probability);
  steps.push(coveResult.step);
  const D_final_verified = latticeMax(taoGateResult.D_final, coveResult.CV);

  const auditStep = runAudit(auditId, D_final_verified);
  steps.push(auditStep);

  const finalReason = gate.reason || castraOut.result.hypatia.reason || castraOut.result.phronesis.reason;

  return {
    auditId,
    input,
    steps,
    lattice: {
      D_gate,
      D_scope,
      D_runtime: D_runtime_final,
      D_final: D_final_verified,
    },
    hypatia: castraOut.result.hypatia,
    phronesis: castraOut.result.phronesis,
    vector: vectorEval,
    cove: coveResult,
    finalDecision: D_final_verified,
    finalReason,
    dpiaLevel: castraOut.result.hypatia.dpiaLevel,
    dpiaLabel: castraOut.result.hypatia.dpiaLabel,
    processingMs: Date.now() - totalStart,
  };
}

export async function classifyIntent(text: string, scopeId: string): Promise<any> {
  const scope = await storage.getScope(scopeId);
  if (!scope) return { error: "Scope not found" };

  let gateProfile: GateProfile = "GENERAL";
  if (scope.orgId) {
    const org = await storage.getOrganization(scope.orgId);
    if (org) gateProfile = org.gateProfile as GateProfile;
  } else {
    gateProfile = "CLINICAL";
  }

  const { gate } = runCerberus(text, gateProfile);

  if (gate.status === "BLOCK" || gate.status === "ESCALATE_HUMAN" || gate.status === "ESCALATE_REGULATORY") {
    const onderbouwing = await fetchOnderbouwing(gate.reason || gate.band || "", gate.layer || "");
    return {
      status: gate.status,
      rule_id: null,
      olympia: gate.band,
      layer: gate.layer,
      pressure: gate.pressure,
      escalation: gate.escalation,
      reason: gate.reason,
      winningRule: null,
      signals: gate.signals,
      lexiconSource: "internal",
      lexiconDeterministic: "true",
      onderbouwing: onderbouwing || null,
    };
  }

  if (gateProfile === "CLINICAL" && (gate.status === "PASS" || gate.status === "PASS_WITH_TRANSPARENCY")) {
    const llmSignals = await evaluateImplicitPressure(text);
    if (llmSignals) {
      const pressureRoute = routeImplicitPressure(llmSignals);
      if (pressureRoute) {
        const needsOnderbouwing = pressureRoute.status === "BLOCK" || pressureRoute.status === "ESCALATE_HUMAN" || pressureRoute.status === "ESCALATE_REGULATORY";
        const onderbouwing = needsOnderbouwing ? await fetchOnderbouwing(pressureRoute.reason || "", pressureRoute.layer || "") : null;
        return {
          status: pressureRoute.status,
          rule_id: null,
          olympia: pressureRoute.olympia,
          layer: pressureRoute.layer,
          pressure: pressureRoute.pressure,
          escalation: pressureRoute.escalation,
          reason: pressureRoute.reason,
          winningRule: null,
          signals: llmSignals,
          lexiconSource: "external",
          lexiconDeterministic: "false",
          onderbouwing: onderbouwing || null,
        };
      }
    } else {
      // Klinisch fail-safe (A10): API niet beschikbaar → nooit stil doorgaan voor CLINICAL profiel
      return {
        status: "ESCALATE_HUMAN",
        rule_id: null,
        olympia: "CLINICAL_API_UNAVAILABLE",
        layer: "CLINICAL_SAFETY_NET",
        pressure: "UNKNOWN",
        escalation: "HUMAN_IC_TEAM",
        reason: "Klinische drukanalyse niet beschikbaar (API onbereikbaar of sleutel ontbreekt) — fail-safe escalatie naar IC-team.",
        winningRule: null,
        signals: null,
        lexiconSource: "internal",
        lexiconDeterministic: "false",
        onderbouwing: null,
      };
    }
  }

  const classification = classifyWithScope(text, scope);

  const rules = (scope.rules || []) as ScopeRule[];
  const availableDomains = Array.from(new Set(rules.map(r => r.domain)));
  const matchedDomain = availableDomains.find(d => classification.category.toUpperCase().includes(d.toUpperCase()));

  const olympia = resolveOlympiaRules(scope, matchedDomain);
  const finalStatus = cerberusEnforce(gate.status, classification.status as GateDecision);
  const needsOnderbouwing = finalStatus === "BLOCK" || finalStatus === "ESCALATE_HUMAN" || finalStatus === "ESCALATE_REGULATORY";
  const onderbouwing = needsOnderbouwing && olympia.winningRule
    ? await fetchOnderbouwing(olympia.winningRule.title || "", olympia.winningRule.source || "")
    : null;

  return {
    status: finalStatus,
    rule_id: olympia.winningRule?.ruleId ?? null,
    olympia: olympia.winningRule?.ruleId ?? null,
    layer: olympia.winningRule?.layer ?? "EU",
    pressure: olympia.pressure === "INFINITE" ? "CRITICAL" : "NORMAL",
    escalation: classification.escalation ?? null,
    reason: classification.reason ?? (finalStatus !== "PASS" ? (olympia.winningRule?.description ?? null) : null),
    winningRule: olympia.winningRule ?? null,
    signals: null,
    lexiconSource: "internal",
    lexiconDeterministic: "true",
    onderbouwing: onderbouwing || null,
  };
}

export async function gatewayClassify(opts: {
  text: string;
  orgId: string;
  connectorId: string;
  scopeId?: string;
  subjectRef?: string;
  subjectRefType?: string;
}): Promise<any> {
  const start = Date.now();
  const { text, orgId, connectorId, scopeId, subjectRef, subjectRefType } = opts;

  const org = await storage.getOrganization(orgId);
  if (!org) throw new Error("Organisatie niet gevonden");

  const gateProfile = (org.gateProfile as GateProfile) || "GENERAL";

  // ── I9: Connector + Scope pre-validatie (vóór dure operaties) ────────────────
  // Connector en scope worden hier vroeg gevalideerd zodat orchestrateGate (WASM)
  // en evaluateImplicitPressure (externe LLM) nooit worden aangeroepen voor een
  // ongeldige of ingetrokken connector of een ontbrekende scope (TGA4).
  const connector = await storage.getConnector(connectorId);
  if (!connector || connector.status === "REVOKED") {
    auditLog({ decision: "BLOCK", orgId, connectorId, inputText: text, endpoint: "gateway/classify", cove: "I9_CONNECTOR_REVOKED" });
    return { decision: "BLOCK", rule_id: null, gate: null, scope: null, olympia: null, processingMs: Date.now() - start, organization: org.name, gateProfile, lexiconSource: "internal", lexiconDeterministic: "true", reason: "Connector is ingetrokken (REVOKED) — verzoek geweigerd." };
  }
  if (connector.status === "INACTIVE") {
    auditLog({ decision: "ESCALATE_HUMAN", orgId, connectorId, inputText: text, endpoint: "gateway/classify", cove: "I9_CONNECTOR_INACTIVE" });
    return { decision: "ESCALATE_HUMAN", rule_id: null, gate: null, scope: null, olympia: null, processingMs: Date.now() - start, organization: org.name, gateProfile, lexiconSource: "internal", lexiconDeterministic: "true", reason: "Connector is inactief — menselijke review vereist." };
  }

  let resolvedScopeForI9: Scope | undefined;
  if (scopeId) {
    resolvedScopeForI9 = await storage.getScope(scopeId);
  } else {
    const orgScopes = await storage.getScopesByOrg(orgId);
    resolvedScopeForI9 = orgScopes.find(s => s.status === "LOCKED") ?? orgScopes[0];
  }
  if (!resolvedScopeForI9) {
    auditLog({ decision: "ESCALATE_HUMAN", orgId, connectorId, inputText: text, endpoint: "gateway/classify", cove: "I9_NO_SCOPE_TGA4" });
    return { decision: "ESCALATE_HUMAN", rule_id: null, gate: null, scope: null, olympia: null, processingMs: Date.now() - start, organization: org.name, gateProfile, lexiconSource: "internal", lexiconDeterministic: "true", reason: "Geen scope beschikbaar (TGA4) — menselijke review vereist." };
  }
  // ── Einde I9 ─────────────────────────────────────────────────────────────────

  const gate = await orchestrateGate(text, gateProfile);

  let implicitPressureOverride: ReturnType<typeof routeImplicitPressure> = null;
  let llmSignals: any = null;

  if (gateProfile === "CLINICAL" && (gate.status === "PASS" || gate.status === "PASS_WITH_TRANSPARENCY")) {
    llmSignals = await evaluateImplicitPressure(text);
    if (llmSignals) {
      implicitPressureOverride = routeImplicitPressure(llmSignals);
    } else {
      // Klinisch fail-safe (A10): API niet beschikbaar → nooit stil doorgaan voor CLINICAL profiel
      implicitPressureOverride = {
        override: true,
        status: "ESCALATE_HUMAN",
        escalation: "HUMAN_IC_TEAM",
        olympia: "CLINICAL_API_UNAVAILABLE",
        layer: "CLINICAL_SAFETY_NET",
        pressure: "UNKNOWN",
        reason: "Klinische drukanalyse niet beschikbaar (API onbereikbaar of sleutel ontbreekt) — fail-safe escalatie naar IC-team.",
      };
    }
  }

  let scopeResult: ScopeClassification | null = null;
  let olympiaResult: OlympiaResolution | null = null;
  let resolvedScope: Scope | undefined;

  if (!implicitPressureOverride && (gate.status === "PASS" || gate.status === "PASS_WITH_TRANSPARENCY")) {
    // resolvedScopeForI9 is al opgehaald in de I9-check hierboven — geen nieuwe DB-call nodig.
    resolvedScope = resolvedScopeForI9;
    scopeResult = classifyWithScope(text, resolvedScope);
    const rules = (resolvedScope.rules || []) as ScopeRule[];
    const availableDomains = Array.from(new Set(rules.map(r => r.domain)));
    const matchedDomain = availableDomains.find(d => scopeResult!.category.toUpperCase().includes(d.toUpperCase()));
    olympiaResult = resolveOlympiaRules(resolvedScope, matchedDomain);
  }

  const cerberusDecision = cerberusEnforce(gate.status, scopeResult?.status as GateDecision | undefined);
  const finalDecision = implicitPressureOverride?.status || cerberusDecision;
  const processingMs = Date.now() - start;

  await storage.touchConnector(connectorId);
  const usedLlm = !!implicitPressureOverride;
  const scopeUsedExternalData = resolvedScope && (resolvedScope.ingestMeta as any)?.model && (resolvedScope.ingestMeta as any).model !== "manual";
  const traceableRuleId = olympiaResult?.winningRule?.ruleId ?? null;

  const hypatiaForGateway = hypatiaRisk(
    Math.min(1.0, text.length / 200),
    0.5,
  );

  await storage.createIntent({
    orgId,
    scopeId: scopeId || null,
    connectorId,
    inputText: text,
    decision: finalDecision,
    category: implicitPressureOverride ? "IMPLICIT_PRESSURE" : (scopeResult?.category || gate.band),
    layer: implicitPressureOverride?.layer || olympiaResult?.winningRule?.layer || gate.layer,
    pressure: implicitPressureOverride?.pressure || String(olympiaResult?.pressure ?? gate.pressure),
    reason: implicitPressureOverride?.reason || scopeResult?.reason || gate.reason,
    escalation: implicitPressureOverride?.escalation || scopeResult?.escalation || gate.escalation,
    ruleId: traceableRuleId,
    processingMs,
    dpiaLevel: hypatiaForGateway.dpiaLevel,
    lexiconSource: usedLlm ? "external" : (scopeUsedExternalData ? "external" : "internal"),
    lexiconDeterministic: usedLlm ? "false" : (scopeUsedExternalData ? "false" : "true"),
    subjectRef: subjectRef ?? null,
    subjectRefType: subjectRefType ?? null,
  });

  if (implicitPressureOverride) {
    return {
      decision: implicitPressureOverride.status,
      rule_id: null,
      gate: { status: gate.status, layer: gate.layer, band: gate.band, pressure: gate.pressure, reason: gate.reason },
      implicitPressure: {
        status: implicitPressureOverride.status,
        layer: implicitPressureOverride.layer,
        olympia: implicitPressureOverride.olympia,
        pressure: implicitPressureOverride.pressure,
        escalation: implicitPressureOverride.escalation,
        reason: implicitPressureOverride.reason,
        signals: llmSignals,
      },
      scope: null,
      olympia: null,
      processingMs,
      organization: org.name,
      gateProfile,
      lexiconSource: "external",
      lexiconDeterministic: "false",
    };
  }

  return {
    decision: finalDecision,
    rule_id: traceableRuleId,
    gate: { status: gate.status, layer: gate.layer, band: gate.band, pressure: gate.pressure, reason: gate.reason },
    scope: scopeResult ? { status: scopeResult.status, category: scopeResult.category, escalation: scopeResult.escalation, reason: scopeResult.reason } : null,
    olympia: olympiaResult?.winningRule ? {
      ruleId: olympiaResult.winningRule.ruleId,
      layer: olympiaResult.winningRule.layer,
      action: olympiaResult.winningRule.action,
      title: olympiaResult.winningRule.title,
      source: olympiaResult.winningRule.source,
    } : null,
    processingMs,
    organization: org.name,
    gateProfile,
    lexiconSource: scopeUsedExternalData ? "external" : "internal",
    lexiconDeterministic: scopeUsedExternalData ? "false" : "true",
  };
}
