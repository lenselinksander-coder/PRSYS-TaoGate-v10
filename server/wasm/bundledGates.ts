// server/wasm/bundledGates.ts
//
// Self-contained JavaScript source of all gate functions.
// This string is injected verbatim into the QuickJS WASM VM for execution.
// It must have ZERO external imports and ZERO host I/O: only pure functions
// operating on the __input__ and __profile__ globals set by gateRunner.ts.
//
// MAINTENANCE: Keep in sync with gateSystem.ts and clinicalGate.ts.
// When gate patterns or logic change, update the corresponding sections here.

export const GATE_BUNDLE_SOURCE: string = `
"use strict";

// ── Utility ──────────────────────────────────────────────────────────────────

function normalize(input) {
  return (input == null ? "" : String(input))
    .toLowerCase()
    .replace(/\\s+/g, " ")
    .trim();
}

function hits(lower, patterns) {
  var matched = [];
  for (var i = 0; i < patterns.length; i++) {
    var p = patterns[i];
    if (typeof p === "string") {
      if (lower.indexOf(p) !== -1) matched.push(p);
    } else {
      if (p.test(lower)) matched.push(String(p));
    }
  }
  return matched;
}

// ── Pattern arrays ───────────────────────────────────────────────────────────

var FINANCIAL_PATTERNS = [
  "transactie", "overboeking", "betaling", "rekening", "credit", "debet",
  "witwassen", "fraude", "sanctie", "pep", "kyc", "aml",
  "lening", "hypotheek", "belegging", "dividend", "koers",
  "insider trading", "marktmanipulatie", "voorkennis",
  "transaction", "payment", "fraud", "money laundering"
];

var LEGAL_PATTERNS = [
  "vonnis", "uitspraak", "arrest", "rechtszaak", "dagvaarding",
  "advocaat", "verdachte", "slachtoffer", "getuige", "bewijs",
  "strafbaar", "overtreding", "misdrijf", "delict",
  "overeenkomst", "contract", "aansprakelijkheid", "schadevergoeding",
  "verdict", "lawsuit", "evidence", "prosecution"
];

var EDUCATIONAL_PATTERNS = [
  "leerling", "student", "toets", "examen", "beoordeling",
  "cijfer", "rapport", "diploma", "voortgang", "leerdoel",
  "bijles", "huiswerk", "stage", "afstuderen",
  "plagiarism", "assessment", "curriculum", "enrollment"
];

var CLINICAL_IMPERATIVE_PATTERNS = [
  "start ", "stop ", "geef ", "dien ", "toedien", "verhoog", "verlaag",
  "intubeer", "tubeer", "sedatie", "reanimeer", "bel ", "voer ", "neem ",
  "zet ", "schakel ", "regel ", "draag ", "verplaats", "ontkoppel",
  "koppel ", "zet aan", "zet uit", "nu ", "direct", "onmiddellijk",
  "zonder overleg", "zonder toestemming",
  /!\\s*$/,
  "start ", "stop ", "give ", "administer", "increase", "decrease",
  "intubate", "sedate", "resuscitate", "call ", "do now",
  "immediately", "without consent"
];

var CLINICAL_MEDICATION_PATTERNS = [
  "morfine", "fentanyl", "propofol", "midazolam", "noradrenaline",
  "norepinephrine", "adrenaline", "epinephrine", "vasopressin",
  "heparine", "insuline", "antibiotica", "cef", "piperacilline",
  "meropenem", "vancomycine", "bolus", "mg", "mcg", "µg", "ml", "units",
  /(\\d+)\\s?(mg|mcg|µg|ml|ie|iu)\\b/,
  /(start|geef|dien|toedien)\\s+\\d+/
];

var CLINICAL_PROCEDURE_PATTERNS = [
  "beademing", "ventilatie", "intubatie", "extubatie", "ecmo",
  "dialyse", "cvvh", "lijn", "central line", "arterielijn",
  "arterial line", "catheter", "katheter", "thoraxdrain",
  "bronchoscopie", "ct-scan", "scan nu", "operatie", "ok", "chirurgie"
];

var CLINICAL_TRIAGE_PATTERNS = [
  "triage", "prioriteer", "prioritering", "zet op wachtlijst",
  "verplaats naar ic", "ontslaan", "transfer naar",
  "do not resuscitate", "dnr", "code zwart", "code black",
  "toewijzen bed", "allocatie"
];

var CLINICAL_ADVICE_PATTERNS = [
  "wat moeten we doen", "wat is de beste stap", "advies",
  "advies graag", "wat raad je aan", "wat is de indicatie",
  "welke behandeling", "moet ik", "moeten we", "kan ik",
  "kunnen we", "should we", "what should", "recommend"
];

var CLINICAL_UNCERTAINTY_PATTERNS = [
  "ik denk", "misschien", "mogelijk", "lijkt", "vermoed",
  "waarschijnlijk", "onzeker", "not sure", "maybe", "possibly"
];

// ── Gate functions ────────────────────────────────────────────────────────────

function generalGate(input) {
  var lower = normalize(input);
  if (!lower) {
    return {
      status: "PASS", layer: "GENERAL", band: "GENERAL_OBSERVATION",
      pressure: "LOW", escalation: null,
      reason: "Lege invoer — doorgelaten.", signals: null
    };
  }
  var imperative = hits(lower, [
    "verwijder", "delete", "wis", "stop", "blokkeer", "deactiveer",
    "annuleer", "override", "forceer", "zonder toestemming", "without consent",
    "onmiddellijk", "immediately", "nu uitvoeren"
  ]);
  if (imperative.length > 0) {
    return {
      status: "ESCALATE_HUMAN", layer: "GENERAL", band: "GENERAL_IMPERATIVE",
      pressure: "HIGH", escalation: "HUMAN_REVIEW",
      reason: "Imperatieve instructie gedetecteerd — menselijke beoordeling vereist.",
      signals: { matched: imperative }
    };
  }
  return {
    status: "PASS", layer: "GENERAL", band: "GENERAL_OBSERVATION",
    pressure: "LOW", escalation: null,
    reason: "Observatie doorgelaten — geen restricties gedetecteerd.",
    signals: null
  };
}

function financialGate(input) {
  var lower = normalize(input);
  var matched = hits(lower, FINANCIAL_PATTERNS);
  var fraudHits = hits(lower, [
    "witwassen", "fraude", "sanctie", "insider trading", "marktmanipulatie",
    "voorkennis", "money laundering", "fraud", "offshore",
    "belastingontduiking", "verdachte transactie", "suspicious transaction",
    "shell company", /verdacht.*overboek/, /verdacht.*betal/
  ]);
  if (fraudHits.length > 0) {
    return {
      status: "BLOCK", layer: "FINANCIAL", band: "FINANCIAL_FRAUD_RISK",
      pressure: "CRITICAL", escalation: "COMPLIANCE_OFFICER",
      reason: "Fraude/witwas-indicatie gedetecteerd — geblokkeerd voor compliance review.",
      signals: { matched: fraudHits }
    };
  }
  var kycHits = hits(lower, ["kyc", "aml", "pep", "sanctie"]);
  if (kycHits.length > 0) {
    return {
      status: "ESCALATE_HUMAN", layer: "FINANCIAL", band: "FINANCIAL_KYC",
      pressure: "HIGH", escalation: "COMPLIANCE_OFFICER",
      reason: "KYC/AML-gerelateerde intent — menselijke verificatie vereist.",
      signals: { matched: kycHits }
    };
  }
  if (matched.length > 0) {
    return {
      status: "PASS_WITH_TRANSPARENCY", layer: "FINANCIAL",
      band: "FINANCIAL_TRANSACTION", pressure: "MEDIUM", escalation: null,
      reason: "Financiële observatie doorgelaten met transparantieverplichting.",
      signals: { matched: matched }
    };
  }
  return generalGate(input);
}

function legalGate(input) {
  var lower = normalize(input);
  var matched = hits(lower, LEGAL_PATTERNS);
  var criminalHits = hits(lower, [
    "strafbaar", "misdrijf", "delict", "verdachte", "prosecution"
  ]);
  if (criminalHits.length > 0) {
    return {
      status: "BLOCK", layer: "LEGAL", band: "LEGAL_CRIMINAL",
      pressure: "CRITICAL", escalation: "JURIDISCH_ADVISEUR",
      reason: "Strafrechtelijke context gedetecteerd — geblokkeerd voor juridische beoordeling.",
      signals: { matched: criminalHits }
    };
  }
  if (matched.length > 0) {
    return {
      status: "ESCALATE_HUMAN", layer: "LEGAL", band: "LEGAL_SENSITIVE",
      pressure: "HIGH", escalation: "JURIDISCH_ADVISEUR",
      reason: "Juridisch gevoelige intent — escalatie naar juridisch adviseur.",
      signals: { matched: matched }
    };
  }
  return generalGate(input);
}

function educationalGate(input) {
  var lower = normalize(input);
  var matched = hits(lower, EDUCATIONAL_PATTERNS);
  var assessmentHits = hits(lower, [
    "toets", "examen", "beoordeling", "cijfer", "assessment", "plagiarism"
  ]);
  if (assessmentHits.length > 0) {
    return {
      status: "ESCALATE_HUMAN", layer: "EDUCATIONAL",
      band: "EDUCATIONAL_ASSESSMENT", pressure: "HIGH",
      escalation: "DOCENT_EXAMINATOR",
      reason: "Beoordeling/toetsing-context gedetecteerd — menselijke beoordeling vereist.",
      signals: { matched: assessmentHits }
    };
  }
  if (matched.length > 0) {
    return {
      status: "PASS_WITH_TRANSPARENCY", layer: "EDUCATIONAL",
      band: "EDUCATIONAL_OBSERVATION", pressure: "LOW", escalation: null,
      reason: "Educatieve observatie doorgelaten met transparantieverplichting.",
      signals: { matched: matched }
    };
  }
  return generalGate(input);
}

function clinicalGate(input) {
  var lower = normalize(input);
  if (!lower) {
    return {
      status: "PASS_WITH_TRANSPARENCY", layer: "CLINICAL",
      band: "CLINICAL_OBSERVATION_OK", pressure: "LOW", escalation: null,
      reason: "Lege of minimale invoer: geen klinische opdracht gedetecteerd.",
      signals: {
        imperativeHit: false, medicationHit: false, procedureHit: false,
        triageHit: false, adviceRequestHit: false, uncertaintyHit: false,
        matched: []
      }
    };
  }
  var imperative   = hits(lower, CLINICAL_IMPERATIVE_PATTERNS);
  var medication   = hits(lower, CLINICAL_MEDICATION_PATTERNS);
  var procedure    = hits(lower, CLINICAL_PROCEDURE_PATTERNS);
  var triage       = hits(lower, CLINICAL_TRIAGE_PATTERNS);
  var adviceReq    = hits(lower, CLINICAL_ADVICE_PATTERNS);
  var uncertainty  = hits(lower, CLINICAL_UNCERTAINTY_PATTERNS);

  var imperativeHit    = imperative.length > 0;
  var medicationHit    = medication.length > 0;
  var procedureHit     = procedure.length > 0;
  var triageHit        = triage.length > 0;
  var adviceRequestHit = adviceReq.length > 0;
  var uncertaintyHit   = uncertainty.length > 0;

  var matched = imperative.concat(medication, procedure, triage, adviceReq, uncertainty).slice(0, 20);
  var signals = {
    imperativeHit: imperativeHit, medicationHit: medicationHit,
    procedureHit: procedureHit, triageHit: triageHit,
    adviceRequestHit: adviceRequestHit, uncertaintyHit: uncertaintyHit,
    matched: matched
  };

  if (triageHit) {
    return {
      status: "BLOCK", layer: "CLINICAL", band: "CLINICAL_TRIAGE_ORDER",
      pressure: "CRITICAL", escalation: "HUMAN_IC_TEAM",
      reason: "Triage/allocatie-opdracht gedetecteerd. Observatie-only: alleen menselijke besluitvorming toegestaan.",
      signals: signals
    };
  }
  if (medicationHit) {
    return {
      status: "BLOCK", layer: "CLINICAL", band: "CLINICAL_MEDICATION_ORDER",
      pressure: "CRITICAL", escalation: "HUMAN_IC_TEAM",
      reason: "Medicatie-toediening/doseringsopdracht gedetecteerd. Observatie-only: geen orders of doseringen via AI.",
      signals: signals
    };
  }
  if (procedureHit) {
    return {
      status: "BLOCK", layer: "CLINICAL", band: "CLINICAL_PROCEDURE_ORDER",
      pressure: "CRITICAL", escalation: "HUMAN_IC_TEAM",
      reason: "Procedure/interventie-opdracht gedetecteerd. Observatie-only: interventies vereisen menselijke autorisatie.",
      signals: signals
    };
  }
  if (imperativeHit) {
    return {
      status: "BLOCK", layer: "CLINICAL", band: "CLINICAL_IMPERATIVE",
      pressure: "HIGH", escalation: "HUMAN_IC_TEAM",
      reason: "Imperatieve instructietaal gedetecteerd. Observatie-only: opdrachten worden geblokkeerd en geëscaleerd.",
      signals: signals
    };
  }
  if (adviceRequestHit) {
    return {
      status: "ESCALATE_HUMAN", layer: "CLINICAL", band: "CLINICAL_ADVICE_REQUEST",
      pressure: "MEDIUM", escalation: "HUMAN_IC_TEAM",
      reason: "Advies-/besluitvraag gedetecteerd. Observatie-only: AI mag niet adviseren of behandelen; escalatie naar mens.",
      signals: signals
    };
  }
  if (uncertaintyHit) {
    return {
      status: "PASS_WITH_TRANSPARENCY", layer: "CLINICAL",
      band: "CLINICAL_OBSERVATION_OK", pressure: "LOW", escalation: null,
      reason: "Observatie/interpretatie-taal met onzekerheidsmarkers gedetecteerd. Doorlaten als observatie (geen opdracht).",
      signals: signals
    };
  }
  return {
    status: "PASS_WITH_TRANSPARENCY", layer: "CLINICAL",
    band: "CLINICAL_OBSERVATION_OK", pressure: "LOW", escalation: null,
    reason: "Alleen klinische observatie: geen opdrachten, doseringen, interventies of triage gedetecteerd.",
    signals: signals
  };
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

function runGate(input, profile) {
  switch (profile) {
    case "CLINICAL":    return clinicalGate(input);
    case "FINANCIAL":   return financialGate(input);
    case "LEGAL":       return legalGate(input);
    case "EDUCATIONAL": return educationalGate(input);
    case "GENERAL":
    case "CUSTOM":
    default:            return generalGate(input);
  }
}
`;
