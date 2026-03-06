import { clinicalGate, type ClinicalGateResult } from "./clinicalGate";
import type { GateProfile } from "@shared/schema";
import { normalize, hits } from "./utils/patternMatching";

// Feature 1: WASM sandbox — re-exported for use by the FSM and routes.
// runGateWasm runs the gate logic inside a hermetic QuickJS WASM VM with
// fuel-based (instruction-counter) termination. The synchronous runGate()
// below is kept as a fallback for non-sandboxed routes.
export { runGateWasm } from "./wasm/gateRunner";

export type GateResult = {
  status: "PASS" | "PASS_WITH_TRANSPARENCY" | "ESCALATE_HUMAN" | "ESCALATE_REGULATORY" | "BLOCK";
  layer: string;
  band: string;
  pressure: string;
  escalation: string | null;
  reason: string;
  signals: Record<string, unknown> | null;
};

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

const POLITICAL_MANIPULATION_PATTERNS: (string | RegExp)[] = [
  /stem.*(advies|gedrag|voorkeur|beïnvloed)/,
  /verkiezing.*(campagne|fraude|ondermijn|beïnvloed)/,
  /kiezers?.*(segmentat|targeting|manipul|profiler)/,
  /politiek.*(overtuiging|invloed|manipul|sturen)/,
  /\b(polariseren|polarisatie|desinformatie|nepnieuws|fake\s*news)\b/,
  /\blaat\b.*\bstemmen\s+op\b/,
  /manipul\w*.*\b(kiezers|stemm|verkiezing|publieke\s+opinie)\b/,
  /\b(kiezers|stemm|verkiezing|publieke\s+opinie)\b.*manipul/,
  /beïnvloed.*\b(stemgedrag|verkiezing|electoraat|kiezers)\b/,
  /\b(stemgedrag|verkiezing|electoraat|kiezers)\b.*beïnvloed/,
  /twijfel.*(zaaien|verkiezingsuitslag)/,
  /target.*(advertentie|campagne).*(politiek|kiezers|zwakke)/,
  /\bai\b.*(kiezers|verkiezing).*manipul/,
  /electorale?\s*profiler/,
];

const POLITICAL_OBSERVATION_GUARD: RegExp[] = [
  /^(de|het|een)\b.*\b(uitslag|resultaat|telling|opkomst|percentage|opinie|peiling)\b.*\b(is|was|werd|zijn|waren|staat|toont|laat\s+zien)\b/,
  /\b(verkiezingsuitslag|opkomstcijfer|stempercentage|opkomstpercentage|exitpoll)\b.*\b(is|was|bekend|gepubliceerd|vastgesteld|bekendgemaakt)\b/,
  /\b(verkiezing|stemming|referendum)\b.*\b(plaatsgevonden|gehouden|afgelopen|voorbij|geweest)\b/,
  /\b(analyse|onderzoek|rapport|studie|beschrijving|evaluatie|overzicht)\b.*\b(verkiezing|stem|kiezer|politiek|stemgedrag)\b/,
  /\b(verkiezing|stem|kiezer|politiek|stemgedrag)\b.*\b(analyse|onderzoek|rapport|studie|statistiek|trend|beschrijving)\b/,
];

function canonPoliticalCheck(lower: string): GateResult | null {
  for (const guard of POLITICAL_OBSERVATION_GUARD) {
    if (guard.test(lower)) return null;
  }
  const matched = hits(lower, POLITICAL_MANIPULATION_PATTERNS);
  if (matched.length === 0) return null;
  return {
    status: "BLOCK",
    layer: "CANON_A1",
    band: "POLITICAL_MANIPULATION",
    pressure: "INFINITE",
    escalation: "AI_OFFICE_TOEZICHTHOUDER",
    reason: "Constitutionele weigering: politieke manipulatie gedetecteerd (Canon A1 — EU AI Act Art. 5(1)(a)).",
    signals: { matched, canon: "A1", source: "EU AI Act Art. 5(1)(a)" },
  };
}

const GDPR_PERSONAL_DATA_PATTERNS: (string | RegExp)[] = [
  "naam", "adres", /telefoon\w*/, "e-mail", "email", "mailinglijst",
  "burgerservicenummer", "bsn", "geboortedatum",
  /medisch\w*\s*(gegeven|dossier)/, "diagnose",
  /locatie\s*gegeven/, /gps[\s-]*gegeven/,
  "identiteitsbewijs", "paspoort", "id-kaart", "rijbewijs",
  "gezichtsherkenning", /biometrisch\w*\s*gegeven/,
  /persoons\s*gegeven/, /persoonlijk\w*\s*gegeven/,
  "ip-adres", "cookie", "vingerafdruk",
  /e[\s-]*mail\s*adres/,
];

const GDPR_PROCESSING_VERBS: string[] = [
  "verzamel", "verzamelen", "opslaan", "bewaar", "bewaren",
  "maak een lijst", "lijst maken", "database",
  "exporteer", "exporteren", "delen", "uitwisselen",
  "verkopen", "verkoop", "profileren", "profileer",
  "koppel", "combineren", "aan elkaar koppelen",
  "scrapen", "harvesten", "downloaden", "kopieer", "kopiëren",
  "doorsturen", "versturen", "uploaden",
];

function canonGdprCheck(lower: string): GateResult | null {
  const dataHits = hits(lower, GDPR_PERSONAL_DATA_PATTERNS);
  if (dataHits.length === 0) return null;
  const verbHits = hits(lower, GDPR_PROCESSING_VERBS);
  if (verbHits.length === 0) return null;
  return {
    status: "BLOCK",
    layer: "CANON_A2",
    band: "PERSONAL_DATA_PROCESSING",
    pressure: "INFINITE",
    escalation: "DATA_PROTECTION_OFFICER",
    reason: "AVG/GDPR: (vermoedelijke) onrechtmatige verwerking van persoonsgegevens (Canon A2).",
    signals: { dataPatterns: dataHits, processingVerbs: verbHits, canon: "A2", source: "AVG/GDPR" },
  };
}

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
  const lower = normalize(input);

  const canonBlock = canonPoliticalCheck(lower);
  if (canonBlock) return canonBlock;

  const gdprBlock = canonGdprCheck(lower);
  if (gdprBlock) return gdprBlock;

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
