import { clinicalGate, type ClinicalGateResult } from "./clinicalGate";
import type { GateProfile } from "@shared/schema";

export type GateResult = {
  status: "PASS" | "PASS_WITH_TRANSPARENCY" | "ESCALATE_HUMAN" | "ESCALATE_REGULATORY" | "BLOCK";
  layer: string;
  band: string;
  pressure: string;
  escalation: string | null;
  reason: string;
  signals: Record<string, any> | null;
};

function normalize(input: string): string {
  return (input ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function hits(lower: string, patterns: (string | RegExp)[]): string[] {
  const matched: string[] = [];
  for (const p of patterns) {
    if (typeof p === "string") {
      if (lower.includes(p)) matched.push(p);
    } else {
      if (p.test(lower)) matched.push(String(p));
    }
  }
  return matched;
}

const FINANCIAL_PATTERNS: (string | RegExp)[] = [
  "transactie", "overboeking", "betaling", "rekening", "credit", "debet",
  "witwassen", "fraude", "sanctie", "pep", "kyc", "aml",
  "lening", "hypotheek", "belegging", "dividend", "koers",
  "insider trading", "marktmanipulatie", "voorkennis",
  "transaction", "payment", "fraud", "money laundering",
];

const LEGAL_PATTERNS: (string | RegExp)[] = [
  "vonnis", "uitspraak", "arrest", "rechtszaak", "dagvaarding",
  "advocaat", "verdachte", "slachtoffer", "getuige", "bewijs",
  "strafbaar", "overtreding", "misdrijf", "delict",
  "overeenkomst", "contract", "aansprakelijkheid", "schadevergoeding",
  "verdict", "lawsuit", "evidence", "prosecution",
];

const EDUCATIONAL_PATTERNS: (string | RegExp)[] = [
  "leerling", "student", "toets", "examen", "beoordeling",
  "cijfer", "rapport", "diploma", "voortgang", "leerdoel",
  "bijles", "huiswerk", "stage", "afstuderen",
  "plagiarism", "assessment", "curriculum", "enrollment",
];

function generalGate(input: string): GateResult {
  const lower = normalize(input);
  if (!lower) {
    return {
      status: "PASS",
      layer: "GENERAL",
      band: "GENERAL_OBSERVATION",
      pressure: "LOW",
      escalation: null,
      reason: "Lege invoer — doorgelaten.",
      signals: null,
    };
  }

  const imperative = hits(lower, [
    "verwijder", "delete", "wis", "stop", "blokkeer", "deactiveer",
    "annuleer", "override", "forceer", "zonder toestemming", "without consent",
    "onmiddellijk", "immediately", "nu uitvoeren",
  ]);

  if (imperative.length > 0) {
    return {
      status: "ESCALATE_HUMAN",
      layer: "GENERAL",
      band: "GENERAL_IMPERATIVE",
      pressure: "HIGH",
      escalation: "HUMAN_REVIEW",
      reason: "Imperatieve instructie gedetecteerd — menselijke beoordeling vereist.",
      signals: { matched: imperative },
    };
  }

  return {
    status: "PASS",
    layer: "GENERAL",
    band: "GENERAL_OBSERVATION",
    pressure: "LOW",
    escalation: null,
    reason: "Observatie doorgelaten — geen restricties gedetecteerd.",
    signals: null,
  };
}

function financialGate(input: string): GateResult {
  const lower = normalize(input);
  const matched = hits(lower, FINANCIAL_PATTERNS);

  const fraudHits = hits(lower, [
    "witwassen", "fraude", "sanctie", "insider trading", "marktmanipulatie",
    "voorkennis", "money laundering", "fraud", "offshore", "belastingontduiking",
    "verdachte transactie", "suspicious transaction", "shell company",
    /verdacht.*overboek/, /verdacht.*betal/,
  ]);
  if (fraudHits.length > 0) {
    return {
      status: "BLOCK",
      layer: "FINANCIAL",
      band: "FINANCIAL_FRAUD_RISK",
      pressure: "CRITICAL",
      escalation: "COMPLIANCE_OFFICER",
      reason: "Fraude/witwas-indicatie gedetecteerd — geblokkeerd voor compliance review.",
      signals: { matched: fraudHits },
    };
  }

  const kycHits = hits(lower, ["kyc", "aml", "pep", "sanctie"]);
  if (kycHits.length > 0) {
    return {
      status: "ESCALATE_HUMAN",
      layer: "FINANCIAL",
      band: "FINANCIAL_KYC",
      pressure: "HIGH",
      escalation: "COMPLIANCE_OFFICER",
      reason: "KYC/AML-gerelateerde intent — menselijke verificatie vereist.",
      signals: { matched: kycHits },
    };
  }

  if (matched.length > 0) {
    return {
      status: "PASS_WITH_TRANSPARENCY",
      layer: "FINANCIAL",
      band: "FINANCIAL_TRANSACTION",
      pressure: "MEDIUM",
      escalation: null,
      reason: "Financiële observatie doorgelaten met transparantieverplichting.",
      signals: { matched },
    };
  }

  return generalGate(input);
}

function legalGate(input: string): GateResult {
  const lower = normalize(input);
  const matched = hits(lower, LEGAL_PATTERNS);

  const criminalHits = hits(lower, ["strafbaar", "misdrijf", "delict", "verdachte", "prosecution"]);
  if (criminalHits.length > 0) {
    return {
      status: "BLOCK",
      layer: "LEGAL",
      band: "LEGAL_CRIMINAL",
      pressure: "CRITICAL",
      escalation: "JURIDISCH_ADVISEUR",
      reason: "Strafrechtelijke context gedetecteerd — geblokkeerd voor juridische beoordeling.",
      signals: { matched: criminalHits },
    };
  }

  if (matched.length > 0) {
    return {
      status: "ESCALATE_HUMAN",
      layer: "LEGAL",
      band: "LEGAL_SENSITIVE",
      pressure: "HIGH",
      escalation: "JURIDISCH_ADVISEUR",
      reason: "Juridisch gevoelige intent — escalatie naar juridisch adviseur.",
      signals: { matched },
    };
  }

  return generalGate(input);
}

function educationalGate(input: string): GateResult {
  const lower = normalize(input);
  const matched = hits(lower, EDUCATIONAL_PATTERNS);

  const assessmentHits = hits(lower, ["toets", "examen", "beoordeling", "cijfer", "assessment", "plagiarism"]);
  if (assessmentHits.length > 0) {
    return {
      status: "ESCALATE_HUMAN",
      layer: "EDUCATIONAL",
      band: "EDUCATIONAL_ASSESSMENT",
      pressure: "HIGH",
      escalation: "DOCENT_EXAMINATOR",
      reason: "Beoordeling/toetsing-context gedetecteerd — menselijke beoordeling vereist.",
      signals: { matched: assessmentHits },
    };
  }

  if (matched.length > 0) {
    return {
      status: "PASS_WITH_TRANSPARENCY",
      layer: "EDUCATIONAL",
      band: "EDUCATIONAL_OBSERVATION",
      pressure: "LOW",
      escalation: null,
      reason: "Educatieve observatie doorgelaten met transparantieverplichting.",
      signals: { matched },
    };
  }

  return generalGate(input);
}

export function runGate(input: string, profile: GateProfile): GateResult {
  switch (profile) {
    case "CLINICAL": {
      const result = clinicalGate(input);
      return {
        status: result.status,
        layer: result.layer,
        band: result.band,
        pressure: result.pressure,
        escalation: result.escalation,
        reason: result.reason,
        signals: result.signals,
      };
    }
    case "FINANCIAL":
      return financialGate(input);
    case "LEGAL":
      return legalGate(input);
    case "EDUCATIONAL":
      return educationalGate(input);
    case "GENERAL":
    case "CUSTOM":
    default:
      return generalGate(input);
  }
}

export function getGateProfileDescription(profile: GateProfile): string {
  const descriptions: Record<GateProfile, string> = {
    CLINICAL: "Klinisch gate-profiel — blokkeert medicatie-opdrachten, procedures, triage-orders en imperatieven. Alleen observaties toegestaan.",
    GENERAL: "Algemeen gate-profiel — blokkeert destructieve imperatieven, laat observaties door.",
    FINANCIAL: "Financieel gate-profiel — blokkeert fraude/witwas-indicaties, escaleert KYC/AML, transparantie bij transacties.",
    LEGAL: "Juridisch gate-profiel — blokkeert strafrechtelijke context, escaleert juridisch gevoelige intents.",
    EDUCATIONAL: "Educatief gate-profiel — escaleert beoordelingen/toetsing, transparantie bij educatieve observaties.",
    CUSTOM: "Aangepast gate-profiel — standaard algemene filtering, uitbreidbaar per organisatie.",
  };
  return descriptions[profile];
}
