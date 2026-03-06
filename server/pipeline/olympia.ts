import type { GateProfile, Scope, ScopeRule, RuleLayer } from "@shared/schema";
import { ruleLayers } from "@shared/schema";
import { runGate, type GateResult } from "../gateSystem";
import type { PipelineStep, OlympiaResolution, PreflightResult } from "./types";

export function runCerberus(input: string, profile: GateProfile): { step: PipelineStep; gate: GateResult; blocked: boolean } {
  const t = Date.now();
  const gate = runGate(input, profile);
  const blocked = gate.status === "BLOCK";

  return {
    step: {
      name: "Cerberus",
      symbol: "🐺",
      role: "Boundary — gate-profiel grenshandhaving (Lex Cerberus: D_final ≥ D_gate)",
      decision: gate.status,
      detail: `Gate profiel '${profile}' resultaat: ${gate.status}. ${gate.reason}${blocked ? " ⛔ Short-circuit: Hypatia/Phronesis overgeslagen." : ""}`,
      durationMs: Date.now() - t,
    },
    gate,
    blocked,
  };
}

export function resolveOlympiaRules(scope: Scope, domain?: string, category?: string): OlympiaResolution {
  const rules = (scope.rules || []) as ScopeRule[];
  let applicable = rules;
  if (domain) {
    applicable = applicable.filter(r => r.domain === domain);
  }
  if (category) {
    applicable = applicable.filter(r =>
      r.ruleId.toLowerCase().includes(category.toLowerCase()) ||
      r.title.toLowerCase().includes(category.toLowerCase()) ||
      r.domain.toLowerCase().includes(category.toLowerCase())
    );
  }

  const priorityIndex = (layer: RuleLayer) => ruleLayers.indexOf(layer);
  const actionSeverity = (action: string) => {
    const order: Record<string, number> = { BLOCK: 5, ESCALATE_REGULATORY: 4, ESCALATE_HUMAN: 3, PASS_WITH_TRANSPARENCY: 2, PASS: 1 };
    return order[action] || 0;
  };
  const sorted = [...applicable].sort((a, b) => priorityIndex(a.layer) - priorityIndex(b.layer) || actionSeverity(b.action) - actionSeverity(a.action));

  const statusPriority: Record<string, number> = { BLOCK: 0, ESCALATE_HUMAN: 1, ESCALATE_REGULATORY: 2, PASS_WITH_TRANSPARENCY: 3, PASS: 4 };
  const resolvedByRestriction = [...applicable].sort((a, b) => (statusPriority[a.action] ?? 99) - (statusPriority[b.action] ?? 99));
  const winningRule: ScopeRule | null = resolvedByRestriction.length > 0 ? resolvedByRestriction[0] : null;

  const layerSummary = ruleLayers.map(layer => {
    const layerRules = sorted.filter(r => r.layer === layer);
    return {
      layer,
      priority: priorityIndex(layer) + 1,
      ruleCount: layerRules.length,
      rules: layerRules,
      dominantAction: layerRules[0]?.action || null,
    };
  });

  const hasConflict = new Set(sorted.map(r => r.action)).size > 1;

  const pressure = sorted.reduce((acc, r) => {
    if (r.action === "BLOCK") return Infinity;
    const layerWeight = 4 - priorityIndex(r.layer);
    const actionWeight = actionSeverity(r.action);
    return acc + layerWeight * actionWeight;
  }, 0);

  return {
    winningRule,
    hasConflict,
    pressure: pressure === Infinity ? "INFINITE" as const : pressure,
    layers: layerSummary,
    applicableRules: sorted,
    totalRules: rules.length,
  };
}

const validActions: Set<string> = new Set(["BLOCK", "ESCALATE_HUMAN", "ESCALATE_REGULATORY", "PASS_WITH_TRANSPARENCY", "PASS"]);

export function preflightCheck(scope: { rules: any[]; categories: any[] }): PreflightResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  const rules = scope.rules || [];
  const categories = scope.categories || [];

  if (rules.length === 0) {
    issues.push("Geen regels gedefinieerd — scope is leeg");
  }

  const missingRuleId = rules.filter(r => !r.ruleId || typeof r.ruleId !== "string" || r.ruleId.trim() === "");
  if (missingRuleId.length > 0) {
    issues.push(`${missingRuleId.length} regel(s) zonder ruleId`);
  }

  const invalidAction = rules.filter(r => !validActions.has(r.action));
  if (invalidAction.length > 0) {
    issues.push(`${invalidAction.length} regel(s) met ongeldige action: ${invalidAction.map(r => `${r.ruleId ?? "?"}: ${r.action}`).join(", ")}`);
  }

  if (categories.length === 0) {
    warnings.push("Geen categorieën gedefinieerd");
  }

  return {
    canLock: issues.length === 0,
    issues,
    warnings,
    stats: {
      totalRules: rules.length,
      totalCategories: categories.length,
      rulesWithValidAction: rules.filter(r => validActions.has(r.action)).length,
      rulesWithRuleId: rules.filter(r => r.ruleId && typeof r.ruleId === "string" && r.ruleId.trim() !== "").length,
    },
  };
}
