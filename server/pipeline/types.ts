import type { GateProfile, GateDecision, Scope, ScopeRule, RuleLayer } from "@shared/schema";
import type { HypatiaResult, DpiaLevel } from "../trace/hypatia";
import type { PhronesisResult } from "../trace/phronesis";
import type { GateResult } from "../gateSystem";
import type { VectorEvaluation } from "../vector_engine";

export type { GateResult } from "../gateSystem";
export type { HypatiaResult, DpiaLevel } from "../trace/hypatia";
export type { PhronesisResult } from "../trace/phronesis";
export type { VectorEvaluation } from "../vector_engine";

export const DECISION_ORDER = ["PASS", "PASS_WITH_TRANSPARENCY", "ESCALATE_HUMAN", "ESCALATE_REGULATORY", "BLOCK"] as const;
export type LatticeDecision = typeof DECISION_ORDER[number];

export const DECISION_RANK: Record<string, number> = {
  PASS: 0,
  PASS_WITH_TRANSPARENCY: 1,
  ESCALATE_HUMAN: 2,
  ESCALATE: 2,
  ESCALATE_REGULATORY: 3,
  BLOCK: 4,
};

export function latticeMax(a: string, b: string): string {
  const rankA = DECISION_RANK[a] ?? 0;
  const rankB = DECISION_RANK[b] ?? 0;
  return rankA >= rankB ? a : b;
}

export function normaliseDecision(d: string): LatticeDecision {
  if (d === "ESCALATE") return "ESCALATE_HUMAN";
  return d as LatticeDecision;
}

export function cerberusEnforce(gateDecision: GateDecision, scopeDecision?: GateDecision | null): GateDecision {
  if (scopeDecision == null) return gateDecision;
  const ga = DECISION_RANK[gateDecision] ?? 0;
  const gb = DECISION_RANK[scopeDecision] ?? 0;
  return ga >= gb ? gateDecision : scopeDecision;
}

export type PipelineStep = {
  name: string;
  symbol: string;
  role: string;
  decision: string;
  detail: string;
  durationMs: number;
};

export type PipelineInput = {
  input: string;
  profile?: GateProfile;
  scopeId?: string;
  orgId?: string;
  connectorId?: string;
  tau?: number;
  omega?: number;
  impact?: number;
  probability?: number;
};

export type PipelineLattice = {
  D_gate: string;
  D_scope: string;
  D_runtime: string;
  D_final: string;
};

export type PipelineResult = {
  auditId: string;
  input: string;
  steps: PipelineStep[];
  lattice: PipelineLattice;
  hypatia: HypatiaResult;
  phronesis: PhronesisResult;
  /** Vector Legitimacy Engine evaluatie — null bij vroege pipeline-afbreking (lege invoer) */
  vector: VectorEvaluation | null;
  finalDecision: string;
  finalReason: string;
  dpiaLevel: DpiaLevel;
  dpiaLabel: string;
  processingMs: number;
};

export type ScopeClassification = {
  status: string;
  category: string;
  escalation: string | null;
  reason: string | null;
};

export type OlympiaResolution = {
  winningRule: ScopeRule | null;
  hasConflict: boolean;
  pressure: number | "INFINITE";
  layers: {
    layer: RuleLayer;
    priority: number;
    ruleCount: number;
    rules: ScopeRule[];
    dominantAction: string | null;
  }[];
  applicableRules: ScopeRule[];
  totalRules: number;
};

export type PreflightResult = {
  canLock: boolean;
  issues: string[];
  warnings: string[];
  stats: {
    totalRules: number;
    totalCategories: number;
    rulesWithValidAction: number;
    rulesWithRuleId: number;
  };
};

export type CastraResult = {
  hypatia: HypatiaResult;
  phronesis: PhronesisResult;
  skipped: boolean;
};
