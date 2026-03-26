import { clinicalGate, type ClinicalGateResult } from "./clinicalGate";
import type { GateProfile } from "@shared/schema";
import { getTapeDeck, executeTaoGate, runEuLegalGate } from "./core";
import { appendWormEntry, auditLog } from "./audit/wormChain";

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

// ── executeWithGate — Governance enforcement voor configuratie-endpoints ──────
// Alle configuratie-mutaties (scope, organisatie, connector, import) lopen via
// deze functie. Garandeert dat de governance-kern ook intern geldt — niet alleen
// op de externe API-grens (Invariant I5: Runtime ≠ DB-write zonder gate).
//
// Volgorde conform TRST-laagorde (EN-2026-002):
//   1. EU Legal Gate (euLegalGate.ts) — terminaal bij Art. 5 schending
//   2. TapeDeck beschikbaarheid — escaleer bij leeg deck (TGA4)
//   3. executeTaoGate (trst.ts) — bevat TI-check (A11), Cerberus-axioma's
//   4. Tape-beslissing — BLOCK/ESCALATE stoppen executie, PASS voert door
//   5. Actie uitvoeren (alleen bij PASS/PASS_WITH_TRANSPARENCY) + auditLog (A8, cove)
//
// Beslissingsmatrix:
//   EU Art. 5 trigger          → allowed=false, HTTP 451
//   TRST hard_block            → allowed=false, HTTP 403
//   Tape: BLOCK                → allowed=false, HTTP 403
//   Tape: ESCALATE_*           → allowed=false, HTTP 202 (in behandeling, geen DB-write)
//   Geen tapes (TGA4)          → allowed=false, HTTP 202
//   Tape: PASS / PASS_WITH_TR  → allowed=true,  action() uitvoeren

export interface ConfigGateContext {
  orgId: string | null;
  connectorId: string | null;
  endpoint: string;
}

export interface ConfigGateOutcome {
  /** true = action() is uitgevoerd en result is beschikbaar; false = actie gestopt */
  allowed: boolean;
  decision: string;
  reason: string | null;
  httpStatus: number;
  body: Record<string, unknown>;
}

export async function executeWithGate<T>(
  actionDescription: string,
  action: () => Promise<T>,
  context: ConfigGateContext,
): Promise<{ gateOutcome: ConfigGateOutcome; result?: T }> {
  const start = Date.now();

  // Stap 1 — EU Legal Gate (altijd eerste, terminaal — geen override mogelijk, A9)
  const euResult = runEuLegalGate(actionDescription);
  if (euResult.triggered) {
    auditLog({
      decision: "BLOCK",
      orgId: context.orgId,
      connectorId: context.connectorId,
      inputText: actionDescription,
      endpoint: context.endpoint,
      cove: "EU_AI_ACT",
      layer: "EU",
      processingMs: Date.now() - start,
    });
    return {
      gateOutcome: {
        allowed: false,
        decision: "BLOCK",
        reason: "EU AI Act Art. 5 — absolute weigering.",
        httpStatus: 451,
        body: {
          status: "BLOCK",
          category: "EU_AI_ACT",
          layer: "EU",
          endpoint: context.endpoint,
          reason: "EU AI Act Art. 5 — absolute weigering.",
        },
      },
    };
  }

  // Stap 2 — TapeDeck beschikbaarheid
  // TGA4: geen tape beschikbaar → ESCALATE_HUMAN, HTTP 202, geen DB-write
  const tapeDeck = getTapeDeck();
  if (!tapeDeck || tapeDeck.tapes.size === 0) {
    auditLog({
      decision: "ESCALATE_HUMAN",
      orgId: context.orgId,
      connectorId: context.connectorId,
      inputText: actionDescription,
      endpoint: context.endpoint,
      cove: "CONFIG_MUTATION",
      layer: "CONFIG",
      processingMs: Date.now() - start,
    });
    return {
      gateOutcome: {
        allowed: false,
        decision: "ESCALATE_HUMAN",
        reason: "Geen geverifieerde tapes geladen — menselijke review vereist (TGA4).",
        httpStatus: 202,
        body: {
          status: "ESCALATE_HUMAN",
          category: "CONFIG_MUTATION",
          endpoint: context.endpoint,
          reason: "Geen geverifieerde tapes geladen — menselijke review vereist (TGA4).",
        },
      },
    };
  }

  // Stap 3 — Tape selectie (eerste beschikbare — configuratie-endpoints zijn niet scope-gebonden)
  // Veilig: tapeDeck.tapes.size > 0 is gecontroleerd in stap 2
  const tape = tapeDeck.tapes.values().next().value!;

  // Stap 4 — TRST executie (bevat TI-check A11, SI-check, O36, Barbatos, Dymphna)
  const trst = executeTaoGate(actionDescription, tape, tapeDeck);
  const processingMs = Date.now() - start;

  if (trst.hard_block) {
    auditLog({
      decision: "BLOCK",
      orgId: context.orgId,
      connectorId: context.connectorId,
      inputText: actionDescription,
      endpoint: context.endpoint,
      cove: "CONFIG_MUTATION",
      layer: trst.result?.layer ?? "TRST",
      processingMs,
    });
    return {
      gateOutcome: {
        allowed: false,
        decision: "BLOCK",
        reason: trst.hard_block_reason ?? "TRST hard block.",
        httpStatus: 403,
        body: {
          status: "BLOCK",
          category: "TRST_VIOLATION",
          layer: "TRST",
          endpoint: context.endpoint,
          reason: trst.hard_block_reason,
        },
      },
    };
  }

  const tapeDecision = trst.result?.status ?? "ESCALATE_HUMAN";

  // Stap 4b — BLOCK: definitief weigeren
  if (tapeDecision === "BLOCK") {
    auditLog({
      decision: "BLOCK",
      orgId: context.orgId,
      connectorId: context.connectorId,
      inputText: actionDescription,
      endpoint: context.endpoint,
      cove: "CONFIG_MUTATION",
      layer: trst.result?.layer ?? "TAPE",
      pressure: null,
      processingMs,
    });
    return {
      gateOutcome: {
        allowed: false,
        decision: "BLOCK",
        reason: trst.result?.reason ?? "Tape beslissing: BLOCK.",
        httpStatus: 403,
        body: {
          status: "BLOCK",
          category: "CONFIG_MUTATION",
          layer: trst.result?.layer,
          endpoint: context.endpoint,
          reason: trst.result?.reason,
        },
      },
    };
  }

  // Stap 4c — ESCALATE: in behandeling nemen, geen DB-write, HTTP 202
  if (tapeDecision.startsWith("ESCALATE")) {
    auditLog({
      decision: tapeDecision,
      orgId: context.orgId,
      connectorId: context.connectorId,
      inputText: actionDescription,
      endpoint: context.endpoint,
      cove: "CONFIG_MUTATION",
      layer: trst.result?.layer ?? "TAPE",
      pressure: null,
      processingMs,
    });
    return {
      gateOutcome: {
        allowed: false,
        decision: tapeDecision,
        reason: trst.result?.reason ?? "Menselijke review vereist.",
        httpStatus: 202,
        body: {
          status: tapeDecision,
          category: "CONFIG_MUTATION",
          layer: trst.result?.layer,
          endpoint: context.endpoint,
          reason: trst.result?.reason ?? "Menselijke review vereist.",
        },
      },
    };
  }

  // Stap 5 — PASS of PASS_WITH_TRANSPARENCY: actie uitvoeren + auditLog (A8, cove)
  let result: T;
  try {
    result = await action();
  } catch (err: unknown) {
    // Actie mislukt — audit als BLOCK (Cerberus fail-safe: onverwachte fout = blokkeer)
    auditLog({
      decision: "BLOCK",
      orgId: context.orgId,
      connectorId: context.connectorId,
      inputText: actionDescription,
      endpoint: context.endpoint,
      cove: "ACTION_ERROR",
      layer: "SYSTEM",
      processingMs: Date.now() - start,
    });
    throw err;
  }

  auditLog({
    decision: tapeDecision,
    orgId: context.orgId,
    connectorId: context.connectorId,
    inputText: actionDescription,
    endpoint: context.endpoint,
    cove: "CONFIG_MUTATION",
    layer: trst.result?.layer ?? "TAPE",
    pressure: null,
    processingMs,
  });

  return {
    gateOutcome: {
      allowed: true,
      decision: tapeDecision,
      reason: trst.result?.reason ?? null,
      httpStatus: 200,
      body: {},
    },
    result,
  };
}
