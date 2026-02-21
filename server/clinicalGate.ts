// server/clinicalGate.ts

export type ClinicalGateStatus =
  | "PASS"
  | "PASS_WITH_TRANSPARENCY"
  | "ESCALATE_HUMAN"
  | "BLOCK";

export type ClinicalPressure = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ClinicalGateBand =
  | "CLINICAL_OBSERVATION_OK"
  | "CLINICAL_TRANSLATION_OK"
  | "CLINICAL_ADVICE_REQUEST"
  | "CLINICAL_IMPERATIVE"
  | "CLINICAL_MEDICATION_ORDER"
  | "CLINICAL_PROCEDURE_ORDER"
  | "CLINICAL_TRIAGE_ORDER"
  | "CLINICAL_OVERRIDE";

export type ClinicalGateResult = {
  status: ClinicalGateStatus;
  layer: "CLINICAL";
  band: ClinicalGateBand;
  pressure: ClinicalPressure;
  escalation: string | null;
  reason: string;
  signals: {
    imperativeHit: boolean;
    medicationHit: boolean;
    procedureHit: boolean;
    triageHit: boolean;
    adviceRequestHit: boolean;
    uncertaintyHit: boolean;
    matched: string[];
  };
};

function normalize(input: string): string {
  return (input ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Utility: does the text contain any of these patterns?
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

// NOTE: keep it conservative. We only want to allow "observations", not commands.
const IMPERATIVE_PATTERNS: (string | RegExp)[] = [
  // Dutch imperative verbs / commands
  "start ",
  "stop ",
  "geef ",
  "dien ",
  "toedien",
  "verhoog",
  "verlaag",
  "intubeer",
  "tubeer",
  "sedatie",
  "reanimeer",
  "bel ",
  "voer ",
  "neem ",
  "zet ",
  "schakel ",
  "regel ",
  "draag ",
  "verplaats",
  "ontkoppel",
  "koppel ",
  "zet aan",
  "zet uit",
  "nu ",
  "direct",
  "onmiddellijk",
  "zonder overleg",
  "zonder toestemming",
  /!\s*$/,

  // English common imperatives (if mixed language appears)
  "start ",
  "stop ",
  "give ",
  "administer",
  "increase",
  "decrease",
  "intubate",
  "sedate",
  "resuscitate",
  "call ",
  "do now",
  "immediately",
  "without consent",
];

const MEDICATION_PATTERNS: (string | RegExp)[] = [
  // Common ICU meds / orders (add your own)
  "morfine",
  "fentanyl",
  "propofol",
  "midazolam",
  "noradrenaline",
  "norepinephrine",
  "adrenaline",
  "epinephrine",
  "vasopressin",
  "heparine",
  "insuline",
  "antibiotica",
  "cef",
  "piperacilline",
  "meropenem",
  "vancomycine",
  "bolus",
  "mg",
  "mcg",
  "µg",
  "ml",
  "units",
  /(\d+)\s?(mg|mcg|µg|ml|ie|iu)\b/,
  /(start|geef|dien|toedien)\s+\d+/,
];

const PROCEDURE_PATTERNS: (string | RegExp)[] = [
  // Procedures / interventions
  "beademing",
  "ventilatie",
  "intubatie",
  "extubatie",
  "ecmo",
  "dialyse",
  "cvvh",
  "lijn",
  "central line",
  "arterielijn",
  "arterial line",
  "catheter",
  "katheter",
  "thoraxdrain",
  "bronchoscopie",
  "ct-scan",
  "scan nu",
  "operatie",
  "ok",
  "chirurgie",
];

const TRIAGE_PATTERNS: (string | RegExp)[] = [
  "triage",
  "prioriteer",
  "prioritering",
  "zet op wachtlijst",
  "verplaats naar ic",
  "ontslaan",
  "transfer naar",
  "do not resuscitate",
  "dnr",
  "code zwart",
  "code black",
  "toewijzen bed",
  "allocatie",
];

const ADVICE_REQUEST_PATTERNS: (string | RegExp)[] = [
  // Advice / decision requests -> escalate to human
  "wat moeten we doen",
  "wat is de beste stap",
  "advies",
  "advies graag",
  "wat raad je aan",
  "wat is de indicatie",
  "welke behandeling",
  "moet ik",
  "moeten we",
  "kan ik",
  "kunnen we",
  "should we",
  "what should",
  "recommend",
];

const UNCERTAINTY_PATTERNS: (string | RegExp)[] = [
  // Uncertainty language: still might be observation, but flag as escalate
  "ik denk",
  "misschien",
  "mogelijk",
  "lijkt",
  "vermoed",
  "waarschijnlijk",
  "onzeker",
  "not sure",
  "maybe",
  "possibly",
];

export function clinicalGate(input: string): ClinicalGateResult {
  const lower = normalize(input);

  // Empty or trivial input -> pass with transparency
  if (!lower) {
    return {
      status: "PASS_WITH_TRANSPARENCY",
      layer: "CLINICAL",
      band: "CLINICAL__OBSERVATION_OK",
      pressure: "LOW",
      escalation: null,
      reason: "Lege of minimale invoer: geen klinische opdracht gedetecteerd.",
      signals: {
        imperativeHit: false,
        medicationHit: false,
        procedureHit: false,
        triageHit: false,
        adviceRequestHit: false,
        uncertaintyHit: false,
        matched: [],
      },
    };
  }

  const imperative = hits(lower, IMPERATIVE_PATTERNS);
  const medication = hits(lower, MEDICATION_PATTERNS);
  const procedure = hits(lower, PROCEDURE_PATTERNS);
  const triage = hits(lower, TRIAGE_PATTERNS);
  const adviceReq = hits(lower, ADVICE_REQUEST_PATTERNS);
  const uncertainty = hits(lower, UNCERTAINTY_PATTERNS);

  const imperativeHit = imperative.length > 0;
  const medicationHit = medication.length > 0;
  const procedureHit = procedure.length > 0;
  const triageHit = triage.length > 0;
  const adviceRequestHit = adviceReq.length > 0;
  const uncertaintyHit = uncertainty.length > 0;

  const matched = [
    ...imperative,
    ...medication,
    ...procedure,
    ...triage,
    ...adviceReq,
    ...uncertainty,
  ].slice(0, 20);

  // Hard block: anything that reads like an instruction / order / intervention.
  if (triageHit) {
    return {
      status: "BLOCK",
      layer: "CLINICAL",
      band: "CLINICAL_TRIAGE_ORDER",
      pressure: "CRITICAL",
      escalation: "HUMAN_IC_TEAM",
      reason:
        "Triage/allocatie-opdracht gedetecteerd. Observatie-only: alleen menselijke besluitvorming toegestaan.",
      signals: {
        imperativeHit,
        medicationHit,
        procedureHit,
        triageHit,
        adviceRequestHit,
        uncertaintyHit,
        matched,
      },
    };
  }

  if (medicationHit) {
    return {
      status: "BLOCK",
      layer: "CLINICAL",
      band: "CLINICAL_MEDICATION_ORDER",
      pressure: "CRITICAL",
      escalation: "HUMAN_IC_TEAM",
      reason:
        "Medicatie-toediening/ doseringsopdracht gedetecteerd. Observatie-only: geen orders of doseringen via AI.",
      signals: {
        imperativeHit,
        medicationHit,
        procedureHit,
        triageHit,
        adviceRequestHit,
        uncertaintyHit,
        matched,
      },
    };
  }

  if (procedureHit) {
    return {
      status: "BLOCK",
      layer: "CLINICAL",
      band: "CLINICAL_PROCEDURE_ORDER",
      pressure: "CRITICAL",
      escalation: "HUMAN_IC_TEAM",
      reason:
        "Procedure/interventie-opdracht gedetecteerd. Observatie-only: interventies vereisen menselijke autorisatie.",
      signals: {
        imperativeHit,
        medicationHit,
        procedureHit,
        triageHit,
        adviceRequestHit,
        uncertaintyHit,
        matched,
      },
    };
  }

  if (imperativeHit) {
    return {
      status: "BLOCK",
      layer: "CLINICAL",
      band: "CLINICAL_IMPERATIVE",
      pressure: "HIGH",
      escalation: "HUMAN_IC_TEAM",
      reason:
        "Imperatieve instructietaal gedetecteerd. Observatie-only: opdrachten worden geblokkeerd en geëscaleerd.",
      signals: {
        imperativeHit,
        medicationHit,
        procedureHit,
        triageHit,
        adviceRequestHit,
        uncertaintyHit,
        matched,
      },
    };
  }

  // Escalate: asks for advice / decision-making (even if not imperative)
  if (adviceRequestHit) {
    return {
      status: "ESCALATE_HUMAN",
      layer: "CLINICAL",
      band: "CLINICAL_ADVICE_REQUEST",
      pressure: "MEDIUM",
      escalation: "HUMAN_IC_TEAM",
      reason:
        "Advies-/besluitvraag gedetecteerd. Observatie-only: AI mag niet adviseren of behandelen; escalatie naar mens.",
      signals: {
        imperativeHit,
        medicationHit,
        procedureHit,
        triageHit,
        adviceRequestHit,
        uncertaintyHit,
        matched,
      },
    };
  }

  // PASS (with transparency) for plain observations, but if uncertainty language: pass w/ transparency
  if (uncertaintyHit) {
    return {
      status: "PASS_WITH_TRANSPARENCY",
      layer: "CLINICAL",
      band: "CLINICAL_OBSERVATION_OK",
      pressure: "LOW",
      escalation: null,
      reason:
        "Observatie/interpretatie-taal met onzekerheidsmarkers gedetecteerd. Doorlaten als observatie (geen opdracht).",
      signals: {
        imperativeHit,
        medicationHit,
        procedureHit,
        triageHit,
        adviceRequestHit,
        uncertaintyHit,
        matched,
      },
    };
  }

  // Default: observation OK
  return {
    status: "PASS_WITH_TRANSPARENCY",
    layer: "CLINICAL",
    band: "CLINICAL_OBSERVATION_OK",
    pressure: "LOW",
    escalation: null,
    reason: "Alleen klinische observatie: geen opdrachten, doseringen, interventies of triage gedetecteerd.",
    signals: {
      imperativeHit,
      medicationHit,
      procedureHit,
      triageHit,
      adviceRequestHit,
      uncertaintyHit,
      matched,
    },
  };
}