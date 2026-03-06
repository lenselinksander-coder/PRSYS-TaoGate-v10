import { randomUUID } from "crypto";
import type { GateProfile, GateDecision, Scope, ScopeRule } from "@shared/schema";
import { storage } from "../storage";
import { fetchOnderbouwing } from "../perplexity";
import { runArgos } from "./argos";
import { runArachne } from "./arachne";
import { runLogos, classifyWithScope } from "./logos";
import { runCerberus, resolveOlympiaRules } from "./olympia";
import { runCastra } from "./castra";
import { runTaoGate } from "./taogate";
import { runAudit } from "./audit";
import { evaluateImplicitPressure, routeImplicitPressure, taoGateSchema } from "./clinical";
import { orchestrateGate } from "../fsm/gateOrchestrator";
import { cerberusEnforce, normaliseDecision, latticeMax } from "./types";
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
import { hypatiaRisk } from "../trace/hypatia";
import { phronesisCapacity } from "../trace/phronesis";

export type { PipelineInput, PipelineResult, PipelineStep, ScopeClassification, OlympiaResolution } from "./types";
export { classifyWithScope } from "./logos";
export { resolveOlympiaRules, preflightCheck, runCerberus } from "./olympia";
export { cerberusEnforce } from "./types";

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
      finalDecision: "PASS",
      finalReason: "Lege invoer — doorgelaten zonder verdere verwerking.",
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

  const taoGateResult = runTaoGate(D_gate, D_scope, D_runtime, gate.escalation);
  steps.push(...taoGateResult.steps);

  const auditStep = runAudit(auditId, taoGateResult.D_final);
  steps.push(auditStep);

  const finalReason = gate.reason || castraOut.result.hypatia.reason || castraOut.result.phronesis.reason;

  return {
    auditId,
    input,
    steps,
    lattice: {
      D_gate,
      D_scope,
      D_runtime,
      D_final: taoGateResult.D_final,
    },
    hypatia: castraOut.result.hypatia,
    phronesis: castraOut.result.phronesis,
    finalDecision: taoGateResult.D_final,
    finalReason,
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
}): Promise<any> {
  const start = Date.now();
  const { text, orgId, connectorId, scopeId } = opts;

  const org = await storage.getOrganization(orgId);
  if (!org) throw new Error("Organisatie niet gevonden");

  const gateProfile = (org.gateProfile as GateProfile) || "GENERAL";
  const gate = await orchestrateGate(text, gateProfile);

  let implicitPressureOverride: ReturnType<typeof routeImplicitPressure> = null;
  let llmSignals: any = null;

  if (gateProfile === "CLINICAL" && (gate.status === "PASS" || gate.status === "PASS_WITH_TRANSPARENCY")) {
    llmSignals = await evaluateImplicitPressure(text);
    if (llmSignals) {
      implicitPressureOverride = routeImplicitPressure(llmSignals);
    }
  }

  let scopeResult: ScopeClassification | null = null;
  let olympiaResult: OlympiaResolution | null = null;
  let resolvedScope: Scope | undefined;

  if (!implicitPressureOverride && (gate.status === "PASS" || gate.status === "PASS_WITH_TRANSPARENCY")) {
    let scope: Scope | undefined;
    if (scopeId) {
      scope = await storage.getScope(scopeId);
    } else {
      const orgScopes = await storage.getScopesByOrg(orgId);
      scope = orgScopes.find(s => s.status === "LOCKED") || orgScopes[0];
    }

    if (scope) {
      resolvedScope = scope;
      scopeResult = classifyWithScope(text, scope);
      const rules = (scope.rules || []) as ScopeRule[];
      const availableDomains = Array.from(new Set(rules.map(r => r.domain)));
      const matchedDomain = availableDomains.find(d => scopeResult!.category.toUpperCase().includes(d.toUpperCase()));
      olympiaResult = resolveOlympiaRules(scope, matchedDomain);
    }
  }

  const cerberusDecision = cerberusEnforce(gate.status, scopeResult?.status as GateDecision | undefined);
  const finalDecision = implicitPressureOverride?.status || cerberusDecision;
  const processingMs = Date.now() - start;

  await storage.touchConnector(connectorId);
  const usedLlm = !!implicitPressureOverride;
  const scopeUsedExternalData = resolvedScope && (resolvedScope.ingestMeta as any)?.model && (resolvedScope.ingestMeta as any).model !== "manual";
  const traceableRuleId = olympiaResult?.winningRule?.ruleId ?? null;

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
    lexiconSource: usedLlm ? "external" : (scopeUsedExternalData ? "external" : "internal"),
    lexiconDeterministic: usedLlm ? "false" : (scopeUsedExternalData ? "false" : "true"),
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
