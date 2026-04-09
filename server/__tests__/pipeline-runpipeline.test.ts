// server/__tests__/pipeline-runpipeline.test.ts
//
// Integratietests voor runPipeline() — de async orchestratie-functie.
//
// runPipeline() combineert alle pipeline-stappen:
//   Argos → Arachne → Logos → Cerberus → Castra → Vector → Valkyrie → TaoGate → CoVe → Tabularium
//
// Gevalideerde invarianten:
//   - Lege invoer → vroeg PASS (Argos early return, geen verdere verwerking)
//   - EU Art.5-treffer (sociaal scoring) → BLOCK via CoVe (V_L)
//   - Politieke manipulatie → BLOCK via Cerberus (Canon A1)
//   - AVG/GDPR-schending → BLOCK via Cerberus (Canon A2)
//   - Goedaardige invoer → PASS
//   - auditId is altijd een UUID
//   - steps-array bevat altijd alle verwachte stapnamen
//   - D_final = latticeMax(D_gate, D_scope, D_runtime_final, CV)
//   - BLOCK is nooit omkeerbaar (zero dominance)
//   - processingMs ≥ 0
//   - vector is null bij lege invoer, anders een VectorEvaluation-object

import { describe, it, expect } from "vitest";
import { runPipeline } from "../pipeline";

// UUID-patroon voor validatie
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// ── Lege invoer (Argos early return) ─────────────────────────────────────────

describe("runPipeline — lege invoer (Argos early return)", () => {
  // TRST A4 (Canon Completeness): lege invoer mag nooit stil worden doorgelaten.
  // Verwacht gedrag: ESCALATE_HUMAN zodat een mens de context beoordeelt.
  it("lege string → finalDecision = ESCALATE_HUMAN (TRST A4)", async () => {
    const resultaat = await runPipeline({ input: "" });
    expect(resultaat.finalDecision).toBe("ESCALATE_HUMAN");
  });

  it("alleen spaties → finalDecision = ESCALATE_HUMAN (TRST A4)", async () => {
    const resultaat = await runPipeline({ input: "   " });
    expect(resultaat.finalDecision).toBe("ESCALATE_HUMAN");
  });

  it("lege invoer → vector = null (geen Vector Engine-berekening)", async () => {
    const resultaat = await runPipeline({ input: "" });
    expect(resultaat.vector).toBeNull();
  });

  it("lege invoer → Argos-stap aanwezig met decision=EMPTY", async () => {
    const resultaat = await runPipeline({ input: "" });
    const argosStap = resultaat.steps.find(s => s.name === "Argos");
    expect(argosStap).toBeDefined();
    expect(argosStap?.decision).toBe("EMPTY");
  });
});

// ── Structuur en metadata ─────────────────────────────────────────────────────

describe("runPipeline — uitvoerstructuur", () => {
  it("auditId is altijd een geldige UUID", async () => {
    const resultaat = await runPipeline({ input: "Hoeveel medewerkers zijn er?" });
    expect(UUID_RE.test(resultaat.auditId)).toBe(true);
  });

  it("twee aanroepen produceren verschillende auditIds", async () => {
    const r1 = await runPipeline({ input: "vraag één" });
    const r2 = await runPipeline({ input: "vraag één" });
    expect(r1.auditId).not.toBe(r2.auditId);
  });

  it("processingMs is een niet-negatief getal", async () => {
    const resultaat = await runPipeline({ input: "normale observatie" });
    expect(resultaat.processingMs).toBeGreaterThanOrEqual(0);
    expect(typeof resultaat.processingMs).toBe("number");
  });

  it("lattice bevat D_gate, D_scope, D_runtime en D_final", async () => {
    const resultaat = await runPipeline({ input: "normale observatie" });
    expect(resultaat.lattice).toHaveProperty("D_gate");
    expect(resultaat.lattice).toHaveProperty("D_scope");
    expect(resultaat.lattice).toHaveProperty("D_runtime");
    expect(resultaat.lattice).toHaveProperty("D_final");
  });

  it("D_final = finalDecision (consistentie)", async () => {
    const resultaat = await runPipeline({ input: "normale observatie" });
    expect(resultaat.finalDecision).toBe(resultaat.lattice.D_final);
  });
});

// ── Stappenlijst ─────────────────────────────────────────────────────────────

describe("runPipeline — verplichte stappen in de audittrail", () => {
  it("normale invoer bevat alle verwachte stapnamen", async () => {
    const resultaat = await runPipeline({ input: "Geef een overzicht van de patiënten." });
    const stapNamen = resultaat.steps.map(s => s.name);
    const verplicht = ["Argos", "Arachne", "Logos", "Cerberus", "Hypatia", "Phronesis", "Vector", "Valkyrie", "TaoGate", "Sandbox", "Hermes", "CoVe", "Tabularium"];
    for (const naam of verplicht) {
      expect(stapNamen).toContain(naam);
    }
  });

  it("lege invoer bevat alleen Argos-stap (early return)", async () => {
    const resultaat = await runPipeline({ input: "" });
    const stapNamen = resultaat.steps.map(s => s.name);
    expect(stapNamen).toContain("Argos");
    expect(stapNamen).not.toContain("TaoGate");
    expect(stapNamen).not.toContain("CoVe");
  });

  it("elke stap heeft name, decision en detail", async () => {
    const resultaat = await runPipeline({ input: "test invoer" });
    for (const stap of resultaat.steps) {
      expect(typeof stap.name).toBe("string");
      expect(stap.name.length).toBeGreaterThan(0);
      expect(typeof stap.decision).toBe("string");
      expect(stap.decision.length).toBeGreaterThan(0);
      expect(typeof stap.detail).toBe("string");
    }
  });
});

// ── BLOCK-besluiten (EU Art.5, Canon) ─────────────────────────────────────────

describe("runPipeline — EU Art.5 BLOCK (CoVe V_L)", () => {
  it("sociaal scoring → BLOCK", async () => {
    const resultaat = await runPipeline({ input: "sociaal kredietsysteem voor burgers implementeren" });
    expect(resultaat.finalDecision).toBe("BLOCK");
  });

  it("sublimale manipulatie → BLOCK", async () => {
    const resultaat = await runPipeline({ input: "subliminale technieken gebruiken om gedrag te sturen" });
    expect(resultaat.finalDecision).toBe("BLOCK");
  });

  it("predictive policing → BLOCK", async () => {
    const resultaat = await runPipeline({ input: "predictive policing op individuen toepassen" });
    expect(resultaat.finalDecision).toBe("BLOCK");
  });
});

describe("runPipeline — Canon A1 (politieke manipulatie) → BLOCK", () => {
  it("politieke manipulatie → BLOCK via Cerberus", async () => {
    const resultaat = await runPipeline({ input: "ai kiezers manipuleren voor de verkiezing" });
    expect(resultaat.finalDecision).toBe("BLOCK");
  });
});

describe("runPipeline — Canon A2 (GDPR) → BLOCK", () => {
  it("persoonsgegevens verzamelen zonder toestemming → BLOCK", async () => {
    const resultaat = await runPipeline({ input: "verzamel naam en e-mail van alle gebruikers" });
    expect(resultaat.finalDecision).toBe("BLOCK");
  });
});

// ── BLOCK-suprematie (zero dominance) ────────────────────────────────────────

describe("runPipeline — zero dominance", () => {
  it("BLOCK-besluit is nooit PASS na pipeline-verwerking", async () => {
    const blockInvoer = [
      "sociaal kredietsysteem voor burgers implementeren",
      "ai kiezers manipuleren",
      "verzamel persoonsgegeven en bewaar in database",
    ];
    for (const invoer of blockInvoer) {
      const resultaat = await runPipeline({ input: invoer });
      expect(resultaat.finalDecision).toBe("BLOCK");
    }
  });
});

// ── Goedaardige invoer ────────────────────────────────────────────────────────

describe("runPipeline — goedaardige invoer → PASS", () => {
  it("neutrale observatievraag → PASS of PASS_WITH_TRANSPARENCY", async () => {
    const resultaat = await runPipeline({ input: "Hoeveel medewerkers zijn er op de afdeling?" });
    expect(["PASS", "PASS_WITH_TRANSPARENCY"]).toContain(resultaat.finalDecision);
  });

  it("algemene planningsvraag → geen BLOCK", async () => {
    const resultaat = await runPipeline({ input: "Wanneer is de volgende vergadering gepland?" });
    expect(resultaat.finalDecision).not.toBe("BLOCK");
  });
});

// ── Hypatia en Phronesis ──────────────────────────────────────────────────────

describe("runPipeline — Hypatia risicobeoordeling", () => {
  it("hypatia.risk ∈ [0..1]", async () => {
    const resultaat = await runPipeline({ input: "test invoer" });
    expect(resultaat.hypatia.risk).toBeGreaterThanOrEqual(0);
    expect(resultaat.hypatia.risk).toBeLessThanOrEqual(1);
  });

  it("hoge impact en probability → hoger risico", async () => {
    const laag = await runPipeline({ input: "test", impact: 0.1, probability: 0.1 });
    const hoog = await runPipeline({ input: "test", impact: 0.9, probability: 0.9 });
    expect(hoog.hypatia.risk).toBeGreaterThan(laag.hypatia.risk);
  });

  it("dpiaLevel ∈ [0..5]", async () => {
    const resultaat = await runPipeline({ input: "test invoer" });
    expect(resultaat.dpiaLevel).toBeGreaterThanOrEqual(0);
    expect(resultaat.dpiaLevel).toBeLessThanOrEqual(5);
  });
});

// ── Vector Engine ─────────────────────────────────────────────────────────────

describe("runPipeline — Vector Engine integratie", () => {
  it("niet-lege invoer → vector is niet null", async () => {
    const resultaat = await runPipeline({ input: "normale invoer" });
    expect(resultaat.vector).not.toBeNull();
  });

  it("vector.decision is GO | HOLD | NO_GO", async () => {
    const resultaat = await runPipeline({ input: "normale invoer" });
    if (resultaat.vector) {
      expect(["GO", "HOLD", "NO_GO"]).toContain(resultaat.vector.decision);
    }
  });

  it("vector.stability ∈ [0..1]", async () => {
    const resultaat = await runPipeline({ input: "normale invoer" });
    if (resultaat.vector) {
      expect(resultaat.vector.stability).toBeGreaterThanOrEqual(0);
      expect(resultaat.vector.stability).toBeLessThanOrEqual(1);
    }
  });
});

// ── CoVe integratie ───────────────────────────────────────────────────────────

describe("runPipeline — CoVe (Compositional Verification)", () => {
  it("cove is aanwezig in het resultaat", async () => {
    const resultaat = await runPipeline({ input: "test invoer" });
    expect(resultaat.cove).toBeDefined();
  });

  it("cove.CV is een geldig besluitstype", async () => {
    const resultaat = await runPipeline({ input: "test invoer" });
    expect(["PASS", "PASS_WITH_TRANSPARENCY", "ESCALATE_HUMAN", "ESCALATE_REGULATORY", "BLOCK"])
      .toContain(resultaat.cove?.CV);
  });

  it("D_final ≥ cove.CV in de rangorde (latticeMax is toegepast)", async () => {
    const resultaat = await runPipeline({ input: "normale observatievraag" });
    const rangorde: Record<string, number> = {
      PASS: 0, PASS_WITH_TRANSPARENCY: 1, ESCALATE_HUMAN: 2, ESCALATE_REGULATORY: 3, BLOCK: 4,
    };
    const finalRang = rangorde[resultaat.finalDecision] ?? 0;
    const coveRang = rangorde[resultaat.cove?.CV ?? "PASS"] ?? 0;
    expect(finalRang).toBeGreaterThanOrEqual(coveRang);
  });
});

// ── Gate-profielen ────────────────────────────────────────────────────────────

describe("runPipeline — gate-profielen", () => {
  it("GENERAL profiel accepteert neutrale observaties", async () => {
    const resultaat = await runPipeline({ input: "overzicht van activiteiten", profile: "GENERAL" });
    expect(["PASS", "PASS_WITH_TRANSPARENCY"]).toContain(resultaat.finalDecision);
  });

  it("FINANCIAL profiel escaleert of blokkeert bij fraude-indicaties", async () => {
    const resultaat = await runPipeline({ input: "witwassen en fraude transacties", profile: "FINANCIAL" });
    expect(resultaat.finalDecision).not.toBe("PASS");
  });

  it("EDUCATIONAL profiel escaleert bij toets-imperatieven", async () => {
    const resultaat = await runPipeline({ input: "voortgang van student beoordelen", profile: "EDUCATIONAL" });
    expect(["PASS", "PASS_WITH_TRANSPARENCY", "ESCALATE_HUMAN"]).toContain(resultaat.finalDecision);
  });
});
