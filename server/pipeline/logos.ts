import type { GateProfile, Scope, GateDecision } from "@shared/schema";
import type { PipelineStep, ScopeClassification } from "./types";

export function runLogos(input: string, profile: GateProfile): PipelineStep & { domain: string } {
  const t = Date.now();
  const domainHints: string[] = [];
  if (/\b(patiënt|medicati|dosering|diagnos|verpleeg|triage)\b/i.test(input)) domainHints.push("CLINICAL");
  if (/\b(transactie|betaling|fraude|kyc|aml|witwas)\b/i.test(input)) domainHints.push("FINANCIAL");
  if (/\b(vonnis|rechtszaak|contract|aansprakelijk|advocaat)\b/i.test(input)) domainHints.push("LEGAL");
  if (/\b(leerling|toets|examen|beoordeling|cijfer)\b/i.test(input)) domainHints.push("EDUCATIONAL");
  const domain = domainHints.length > 0 ? domainHints[0] : profile;

  return {
    name: "Logos",
    symbol: "📐",
    role: "Classify — domeinclassificatie en profiel matching",
    decision: "CLASSIFIED",
    detail: `Domein: ${domain}. Actief profiel: ${profile}.${domainHints.length > 1 ? ` Extra signalen: ${domainHints.slice(1).join(", ")}.` : ""}`,
    durationMs: Date.now() - t,
    domain,
  };
}

const matchesKeyword = (text: string, keyword: string): boolean => {
  const pattern = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return pattern.test(text);
};

export function classifyWithScope(text: string, scope: Scope): ScopeClassification {
  const priorityOrder: GateDecision[] = ["BLOCK", "ESCALATE_HUMAN", "ESCALATE_REGULATORY", "PASS_WITH_TRANSPARENCY", "PASS"];

  const reasonMap: Record<string, string> = {
    BLOCK: "Classificatie geblokt — menselijke beoordeling vereist.",
    ESCALATE_REGULATORY: "Regulatoire escalatie vereist — toezichthouder raadplegen.",
    ESCALATE_HUMAN: "Escalatie naar mens vereist — beoordeling door specialist.",
    PASS_WITH_TRANSPARENCY: "Doorgelaten met transparantieverplichting.",
  };

  for (const decision of priorityOrder) {
    const cats = scope.categories.filter(c => c.status === decision);
    for (const cat of cats) {
      if (cat.keywords.some(kw => matchesKeyword(text, kw))) {
        let reason: string | null = null;
        if (decision !== "PASS") {
          reason = cat.escalation
            ? `${cat.label ?? cat.name} — escaleer naar ${cat.escalation}.`
            : reasonMap[decision] ?? null;
        }
        return { status: cat.status, category: cat.name, escalation: cat.escalation, reason };
      }
    }
  }

  const defaultPass = scope.categories.find(c => c.status === "PASS");
  return {
    status: "PASS",
    category: defaultPass?.name || "Observation",
    escalation: null,
    reason: null,
  };
}
