/**
 * EU Legal Gate — TAPE-EU2
 * Regulation (EU) 2024/1689 · OJ 13 June 2024
 * TaoGate Lexicon Editio I · ORFHEUSS
 *
 * Wet van Executie (gecorrigeerd):
 * E = Audit(Sandbox(TaoGate(LEGAL_EU2(GLE(Generatio(I))))))
 *
 * EU2-I1: Art. 5 BLOCK heeft geen drempel. Direct terminaal. Geen override.
 * EU2-I2: Postcode als ras-proxy = Art. 5.1(c) + Art. 5.1(g). Dubbele grond.
 * EU2-I3: Engine wint altijd van interface-indicatie.
 */

export type EuGateDecision =
  | "BLOCK"
  | "ESCALATE_REGULATORY"
  | "ESCALATE_HUMAN"
  | "PASS_WITH_TRANSPARENCY"
  | "PASS";

export interface EuLegalResult {
  triggered: true;
  decision: EuGateDecision;
  ref: string;
  ground: string;
  fine?: string;
  note: string;
  override: false;
  audit: boolean;
}

export interface EuLegalClear {
  triggered: false;
}

export type EuLegalGateResult = EuLegalResult | EuLegalClear;

// ─── ART. 5 — VERBODEN PRAKTIJKEN ─────────────────────────────────────────────
// Hardcoded. Geen drempel. Geen override. BLOCK > ALLES.

const ART5_KEYWORDS: Record<string, { ref: string; fine: string; ground: string; keywords: string[] }> = {
  social_scoring_public: {
    ref: "Art. 5.1(c)",
    fine: "EUR 35.000.000 / 7% omzet",
    ground: "Sociale scoring door overheidsinstanties. Postcode-profilering = directe treffer.",
    keywords: [
      "social scoring", "sociaal kredietsysteem", "sociale score",
      "profileren achterstandswijk", "postcode profil", "wijk score",
      "belastingdienst profil", "gebiedsprofiel", "bewoners profileren",
      "achterstandswijk bewoners", "postcode bewoners", "wijk bewoners score",
    ],
  },
  subliminal_manipulation: {
    ref: "Art. 5.1(a)",
    fine: "EUR 35.000.000 / 7% omzet",
    ground: "Subliminale technieken buiten bewustzijn met schade.",
    keywords: [
      "subliminaal", "subliminal", "onderbewuste beïnvloeding",
      "dark pattern ai", "manipulatie buiten bewustzijn",
    ],
  },
  exploit_vulnerable: {
    ref: "Art. 5.1(b)",
    fine: "EUR 35.000.000 / 7% omzet",
    ground: "Uitbuiting kwetsbaarheid leeftijd, beperking of economische situatie.",
    keywords: [
      "kwetsbare groepen uitbuiten", "kwetsbare doelgroep manipuleren",
      "ouderen manipuleren", "beperking uitbuiten", "armoede targeting",
    ],
  },
  predictive_policing_individual: {
    ref: "Art. 5.1(d)",
    fine: "EUR 35.000.000 / 7% omzet",
    ground: "Criminaliteitsrisico individu zonder concrete gedraging.",
    keywords: [
      "predictive policing", "voorspellend politiewerk", "recidiverisico individu",
      "criminaliteitsrisico persoon", "risicoscore strafrecht",
    ],
  },
  facial_db_scraping: {
    ref: "Art. 5.1(e)",
    fine: "EUR 35.000.000 / 7% omzet",
    ground: "Massaal scrapen gezichtsafbeeldingen voor biometrische database.",
    keywords: [
      "gezichten scrapen", "facial scraping", "biometrische database bouwen",
      "bulk gezichtsherkenning", "mass facial recognition",
    ],
  },
  emotion_recognition_work_edu: {
    ref: "Art. 5.1(f)",
    fine: "EUR 35.000.000 / 7% omzet",
    ground: "Emotie-inferentie op werkplek of in onderwijsinstelling.",
    keywords: [
      "emotieherkenning werkplek", "emotieherkenning onderwijs",
      "affect detectie school", "stemming medewerker detecteren",
      "gezichtsuitdrukking werk", "stress detectie werkvloer",
    ],
  },
  biometric_categorisation_sensitive: {
    ref: "Art. 5.1(g)",
    fine: "EUR 35.000.000 / 7% omzet",
    ground: "Ras, politieke opinie, religie of seksualiteit afleiden via biometrie.",
    keywords: [
      "ras afleiden", "etniciteit herkennen biometrie", "religie detecteren",
      "seksualiteit herkennen", "politieke opinie biometrie",
      "postcode etnisch proxy", "wijk etniciteit",
    ],
  },
};

// ─── KEYWORD CLASSIFIER ───────────────────────────────────────────────────────

function detectArt5Category(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [category, cfg] of Object.entries(ART5_KEYWORDS)) {
    if (cfg.keywords.some(kw => lower.includes(kw.toLowerCase()))) {
      return category;
    }
  }
  return null;
}

// ─── LEGAL GATE HOOFDFUNCTIE ──────────────────────────────────────────────────
// Altijd eerste stap. Retourneert EuLegalResult als geblokkeerd,
// EuLegalClear als de legal basis vrij is.

export function runEuLegalGate(text: string): EuLegalGateResult {
  const category = detectArt5Category(text);

  if (category) {
    const rule = ART5_KEYWORDS[category];
    return {
      triggered: true,
      decision: "BLOCK",
      ref: rule.ref,
      ground: rule.ground,
      fine: rule.fine,
      note: "EU AI Act Art. 5 — Terminaal. Geen herpoging. Audit verplicht. G ≠ L ≠ E.",
      override: false,
      audit: true,
    };
  }

  return { triggered: false };
}

// ─── FORMATTER voor bestaande pipeline response-structuur ────────────────────

export function formatEuBlockAsGateResponse(result: EuLegalResult, input: string) {
  return {
    status: "BLOCK",
    finalDecision: "BLOCK",
    category: "EU_AI_ACT_ART5_FORBIDDEN",
    escalation: "AI Office / Toezichthouder NL: RDI",
    rule_id: result.ref.replace(/[^A-Z0-9_]/gi, "_").toUpperCase(),
    layer: "EU",
    reason: `${result.ground} — ${result.note}`,
    fine_exposure: result.fine,
    tape_id: "TAPE-EU2",
    lexiconSource: "EU_AI_ACT_2024_1689",
    lexiconDeterministic: "true",
    override: false,
    audit_required: true,
    trst: {
      decision_context: { input_hash: hashText(input), tape_id: "TAPE-EU2" },
      canon: "TGA1: G ≠ L ≠ E · TGA2: BLOCK > alles",
      axioms_satisfied: ["TGA2", "TGA5", "TGA7"],
      // TGA8 (Immutable Trace) wordt gehandhaafd door de WORM-auditchain — niet geschonden.
      // EU-block produceert geen TRST-specifieke axioma-schendingen; lege array is correct.
      axioms_violated: [],
    },
  };
}

function hashText(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(31, h) + text.charCodeAt(i) | 0;
  }
  return `eu2_${Math.abs(h).toString(16)}`;
}
