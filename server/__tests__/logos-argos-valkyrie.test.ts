// server/__tests__/logos-argos-valkyrie.test.ts
//
// Tests voor drie kleine maar kritieke pipeline-stappen:
//   - Argos: invoerdetectie en normalisatie
//   - Logos: domeinclassificatie op basis van sleutelwoorden
//   - classifyWithScope: keyword-matching met prioriteitsvolgorde
//   - Valkyrie: exposure guard (GUARDED vs CLEARED)
//
// Gevalideerde invarianten:
//   - Argos: lege invoer → EMPTY, niet-leeg → OBSERVED
//   - Logos: domein-hints bepalen het domein (eerste match wint)
//   - classifyWithScope: BLOCK > ESCALATE > PASS_WITH_TRANSPARENCY > PASS (prioriteitsvolgorde)
//   - Valkyrie: ≥ ESCALATE_HUMAN in één lattice-dimensie → GUARDED

import { describe, it, expect } from "vitest";
import { runArgos } from "../pipeline/argos";
import { runLogos, classifyWithScope } from "../pipeline/logos";
import { runValkyrie } from "../pipeline/valkyrie";

// ── Argos ─────────────────────────────────────────────────────────────────────

describe("Argos — invoerdetectie", () => {
  it("lege string → decision = EMPTY", () => {
    const stap = runArgos("");
    expect(stap.decision).toBe("EMPTY");
  });

  it("alleen spaties → decision = EMPTY (na trim)", () => {
    const stap = runArgos("   ");
    expect(stap.decision).toBe("EMPTY");
  });

  it("niet-lege invoer → decision = OBSERVED", () => {
    const stap = runArgos("Hoeveel patiënten zijn er?");
    expect(stap.decision).toBe("OBSERVED");
  });

  it("één teken → decision = OBSERVED", () => {
    const stap = runArgos("a");
    expect(stap.decision).toBe("OBSERVED");
  });

  it("naam = Argos", () => {
    expect(runArgos("test").name).toBe("Argos");
  });

  it("detail bij EMPTY vermeldt lege invoer", () => {
    const stap = runArgos("");
    // Argos retourneert: "Lege invoer gedetecteerd."
    expect(stap.detail.toLowerCase()).toContain("lege invoer");
  });

  it("detail bij OBSERVED vermeldt aantal woorden", () => {
    const stap = runArgos("dit is een test");
    expect(stap.detail).toContain("4");
  });

  it("detail bij OBSERVED vermeldt aantal tekens", () => {
    const invoer = "hallo wereld";
    const stap = runArgos(invoer);
    expect(stap.detail).toContain(String(invoer.length));
  });

  it("durationMs is een niet-negatief getal", () => {
    const stap = runArgos("test");
    expect(stap.durationMs).toBeGreaterThanOrEqual(0);
  });
});

// ── Logos — domeinclassificatie ───────────────────────────────────────────────

describe("Logos — domeinclassificatie", () => {
  it("geen domein-hints → domein = profiel", () => {
    const stap = runLogos("algemene vraag zonder specifieke context", "GENERAL");
    expect(stap.domain).toBe("GENERAL");
  });

  it("klinische sleutelwoorden → domein = CLINICAL", () => {
    const stap = runLogos("patiënt heeft diagnose nodig en medicatie", "GENERAL");
    expect(stap.domain).toBe("CLINICAL");
  });

  it("financiële sleutelwoorden → domein = FINANCIAL", () => {
    const stap = runLogos("transactie met fraude en kyc-check", "GENERAL");
    expect(stap.domain).toBe("FINANCIAL");
  });

  it("juridische sleutelwoorden → domein = LEGAL", () => {
    const stap = runLogos("vonnis in de rechtszaak over het contract", "GENERAL");
    expect(stap.domain).toBe("LEGAL");
  });

  it("educatieve sleutelwoorden → domein = EDUCATIONAL", () => {
    const stap = runLogos("leerling doet examen en krijgt een cijfer", "GENERAL");
    expect(stap.domain).toBe("EDUCATIONAL");
  });

  it("meerdere domein-hints → eerste match wint", () => {
    // CLINICAL komt eerst in de hintslijst
    const stap = runLogos("patiënt heeft een transactie gedaan", "GENERAL");
    expect(stap.domain).toBe("CLINICAL");
  });

  it("naam = Logos", () => {
    expect(runLogos("test", "GENERAL").name).toBe("Logos");
  });

  it("decision = CLASSIFIED", () => {
    expect(runLogos("test", "GENERAL").decision).toBe("CLASSIFIED");
  });

  it("detail vermeldt het domein en profiel", () => {
    const stap = runLogos("patiënt heeft pijn", "GENERAL");
    expect(stap.detail).toContain("CLINICAL");
    expect(stap.detail).toContain("GENERAL");
  });

  it("profiel wordt doorgegeven in detail", () => {
    const stap = runLogos("neutrale vraag", "FINANCIAL");
    expect(stap.detail).toContain("FINANCIAL");
  });
});

// ── classifyWithScope — keyword-matching ──────────────────────────────────────

describe("classifyWithScope — categorieprioriteit (BLOCK > ESCALATE > PASS)", () => {
  function maakScope(categorieën: any[]) {
    return { categories: categorieën, rules: [] } as any;
  }

  it("BLOCK-categorie wint van PASS-categorie bij zelfde keyword", () => {
    const scope = maakScope([
      { status: "PASS", name: "Observatie", label: "Observatie", escalation: null, keywords: ["vraag"] },
      { status: "BLOCK", name: "Verboden", label: "Verbod", escalation: "DPO", keywords: ["vraag"] },
    ]);
    const resultaat = classifyWithScope("dit is een vraag", scope);
    expect(resultaat.status).toBe("BLOCK");
  });

  it("ESCALATE_HUMAN wint van PASS_WITH_TRANSPARENCY", () => {
    const scope = maakScope([
      { status: "PASS_WITH_TRANSPARENCY", name: "Transparant", label: "Transparant", escalation: null, keywords: ["verzoek"] },
      { status: "ESCALATE_HUMAN", name: "Escaleer", label: "Escaleer", escalation: "SUPERVISOR", keywords: ["verzoek"] },
    ]);
    const resultaat = classifyWithScope("stuur een verzoek", scope);
    expect(resultaat.status).toBe("ESCALATE_HUMAN");
  });

  it("geen keyword-match → standaard PASS", () => {
    const scope = maakScope([
      { status: "BLOCK", name: "Verboden", label: "Verboden", escalation: null, keywords: ["verboden_term"] },
    ]);
    const resultaat = classifyWithScope("gewone observatievraag", scope);
    expect(resultaat.status).toBe("PASS");
  });

  it("lege scope → standaard PASS", () => {
    const resultaat = classifyWithScope("welke tekst dan ook", maakScope([]));
    expect(resultaat.status).toBe("PASS");
  });

  it("PASS-besluit heeft geen reden (geen onnodige verklaringen)", () => {
    const scope = maakScope([
      { status: "PASS", name: "Observatie", label: "Observatie", escalation: null, keywords: ["info"] },
    ]);
    const resultaat = classifyWithScope("geef info", scope);
    expect(resultaat.reason).toBeNull();
  });

  it("BLOCK-besluit met escalatiedoel vermeldt doel in reden", () => {
    const scope = maakScope([
      { status: "BLOCK", name: "Verboden", label: "Verboden handeling", escalation: "DATA_PROTECTION_OFFICER", keywords: ["blokkeer"] },
    ]);
    const resultaat = classifyWithScope("blokkeer alle accounts", scope);
    expect(resultaat.status).toBe("BLOCK");
    expect(resultaat.reason).toContain("DATA_PROTECTION_OFFICER");
  });

  it("keyword-matching is hoofdletterongevoelig", () => {
    const scope = maakScope([
      { status: "ESCALATE_HUMAN", name: "Klinisch", label: "Klinisch", escalation: null, keywords: ["Bloeddruk"] },
    ]);
    const resultaat = classifyWithScope("wat is de BLOEDDRUK van de patiënt", scope);
    expect(resultaat.status).toBe("ESCALATE_HUMAN");
  });

  it("escalatie-veld wordt doorgegeven in resultaat", () => {
    const scope = maakScope([
      { status: "ESCALATE_REGULATORY", name: "Regelgevend", label: "Regelgevend", escalation: "ACM_TOEZICHTHOUDER", keywords: ["toezicht"] },
    ]);
    const resultaat = classifyWithScope("vraag over toezicht", scope);
    expect(resultaat.escalation).toBe("ACM_TOEZICHTHOUDER");
  });

  it("categorienaam wordt teruggegeven in resultaat", () => {
    const scope = maakScope([
      { status: "PASS", name: "Dagelijkse observatie", label: "Dagelijks", escalation: null, keywords: ["vraag"] },
    ]);
    const resultaat = classifyWithScope("een vraag stellen", scope);
    expect(resultaat.category).toBe("Dagelijkse observatie");
  });
});

// ── Valkyrie — exposure guard ─────────────────────────────────────────────────

describe("Valkyrie — CLEARED (geen blokkering)", () => {
  it("PASS + PASS + PASS → CLEARED", () => {
    const resultaat = runValkyrie("PASS", "PASS", "PASS");
    expect(resultaat.step.decision).toBe("CLEARED");
    expect(resultaat.exposureBlocked).toBe(false);
  });

  it("PASS_WITH_TRANSPARENCY + PASS + PASS → CLEARED", () => {
    const resultaat = runValkyrie("PASS_WITH_TRANSPARENCY", "PASS", "PASS");
    expect(resultaat.step.decision).toBe("CLEARED");
    expect(resultaat.exposureBlocked).toBe(false);
  });

  it("CLEARED → exposureReason = null", () => {
    const resultaat = runValkyrie("PASS", "PASS", "PASS");
    expect(resultaat.exposureReason).toBeNull();
  });
});

describe("Valkyrie — GUARDED (blokkering vereist)", () => {
  it("ESCALATE_HUMAN in D_gate → GUARDED", () => {
    const resultaat = runValkyrie("ESCALATE_HUMAN", "PASS", "PASS");
    expect(resultaat.step.decision).toBe("GUARDED");
    expect(resultaat.exposureBlocked).toBe(true);
  });

  it("ESCALATE_REGULATORY in D_scope → GUARDED", () => {
    const resultaat = runValkyrie("PASS", "ESCALATE_REGULATORY", "PASS");
    expect(resultaat.step.decision).toBe("GUARDED");
    expect(resultaat.exposureBlocked).toBe(true);
  });

  it("BLOCK in D_runtime → GUARDED", () => {
    const resultaat = runValkyrie("PASS", "PASS", "BLOCK");
    expect(resultaat.step.decision).toBe("GUARDED");
    expect(resultaat.exposureBlocked).toBe(true);
  });

  it("BLOCK in D_gate → GUARDED", () => {
    const resultaat = runValkyrie("BLOCK", "PASS", "PASS");
    expect(resultaat.step.decision).toBe("GUARDED");
    expect(resultaat.exposureBlocked).toBe(true);
  });

  it("met escalatiedoel → reden vermeldt doel", () => {
    const resultaat = runValkyrie("ESCALATE_HUMAN", "PASS", "PASS", "SUPERVISOR");
    expect(resultaat.exposureReason).toContain("SUPERVISOR");
  });

  it("zonder escalatiedoel → generieke blokkeringsreden", () => {
    const resultaat = runValkyrie("BLOCK", "PASS", "PASS", null);
    expect(resultaat.exposureReason).toBeTruthy();
    expect(typeof resultaat.exposureReason).toBe("string");
  });

  it("GUARDED detail vermeldt alle drie lattice-dimensies", () => {
    const resultaat = runValkyrie("ESCALATE_HUMAN", "PASS_WITH_TRANSPARENCY", "PASS");
    expect(resultaat.step.detail).toContain("ESCALATE_HUMAN");
    expect(resultaat.step.detail).toContain("PASS_WITH_TRANSPARENCY");
    expect(resultaat.step.detail).toContain("PASS");
  });
});

describe("Valkyrie — stapmetadata", () => {
  it("naam = Valkyrie", () => {
    expect(runValkyrie("PASS", "PASS", "PASS").step.name).toBe("Valkyrie");
  });

  it("durationMs ≥ 0", () => {
    const resultaat = runValkyrie("PASS", "PASS", "PASS");
    expect(resultaat.step.durationMs).toBeGreaterThanOrEqual(0);
  });
});
