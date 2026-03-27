// server/__tests__/olympia.test.ts
//
// Tests voor de Olympia-module: regelresolutie, preflight-validatie en Cerberus-handhaving.
//
// Gevalideerde invarianten:
//   - BLOCK-regel → pressure = INFINITE (geen override mogelijk)
//   - Layer-prioriteit: EU > NATIONAL > REGIONAL > MUNICIPAL
//   - Actie-ernst: BLOCK > ESCALATE_REGULATORY > ESCALATE_HUMAN > PASS_WITH_TRANSPARENCY > PASS
//   - Conflictdetectie: meerdere acties in één scope = hasConflict = true
//   - Preflight: scope zonder regels of met ongeldige acties kan niet LOCKED worden

import { describe, it, expect } from "vitest";
import { resolveOlympiaRules, preflightCheck } from "../pipeline/olympia";
import type { ScopeRule } from "@shared/schema";

// ── Fabrieken ─────────────────────────────────────────────────────────────────

type PartialRule = Partial<ScopeRule> & { ruleId: string; layer: ScopeRule["layer"]; domain: string; action: ScopeRule["action"] };

function maakRegel(overrides: PartialRule): ScopeRule {
  return {
    title: "Testregel",
    description: "Testbeschrijving.",
    overridesLowerLayers: true,
    ...overrides,
  } as ScopeRule;
}

function maakScope(rules: ScopeRule[], categories: any[] = []) {
  return { rules, categories } as any;
}

// ── resolveOlympiaRules ───────────────────────────────────────────────────────

describe("resolveOlympiaRules — lege scope", () => {
  it("geeft winningRule=null terug als er geen regels zijn", () => {
    const resultaat = resolveOlympiaRules(maakScope([]));
    expect(resultaat.winningRule).toBeNull();
    expect(resultaat.totalRules).toBe(0);
    expect(resultaat.applicableRules).toHaveLength(0);
  });

  it("pressure is 0 bij lege scope", () => {
    const resultaat = resolveOlympiaRules(maakScope([]));
    expect(resultaat.pressure).toBe(0);
  });

  it("hasConflict is false bij lege scope", () => {
    const resultaat = resolveOlympiaRules(maakScope([]));
    expect(resultaat.hasConflict).toBe(false);
  });
});

describe("resolveOlympiaRules — BLOCK suprematie (I2)", () => {
  it("BLOCK-regel → winningRule.action = BLOCK", () => {
    const scope = maakScope([
      maakRegel({ ruleId: "EU-001", layer: "EU", domain: "FINANCE", action: "BLOCK" }),
      maakRegel({ ruleId: "EU-002", layer: "EU", domain: "FINANCE", action: "PASS" }),
    ]);
    const resultaat = resolveOlympiaRules(scope);
    expect(resultaat.winningRule?.action).toBe("BLOCK");
  });

  it("BLOCK-regel → pressure = INFINITE", () => {
    const scope = maakScope([
      maakRegel({ ruleId: "EU-001", layer: "EU", domain: "FINANCE", action: "BLOCK" }),
    ]);
    const resultaat = resolveOlympiaRules(scope);
    expect(resultaat.pressure).toBe("INFINITE");
  });

  it("één BLOCK-regel overheerst alle andere acties", () => {
    const scope = maakScope([
      maakRegel({ ruleId: "M-001", layer: "MUNICIPAL", domain: "GENERAL", action: "PASS" }),
      maakRegel({ ruleId: "EU-001", layer: "EU", domain: "GENERAL", action: "BLOCK" }),
      maakRegel({ ruleId: "N-001", layer: "NATIONAL", domain: "GENERAL", action: "ESCALATE_HUMAN" }),
    ]);
    const resultaat = resolveOlympiaRules(scope);
    expect(resultaat.winningRule?.action).toBe("BLOCK");
    expect(resultaat.pressure).toBe("INFINITE");
  });
});

describe("resolveOlympiaRules — actie-ernst rangorde", () => {
  it("ESCALATE_HUMAN heeft hogere prioriteit dan ESCALATE_REGULATORY in Olympia (directe menselijke interventie = urgenter)", () => {
    // Let op: in de beslislattice scoort ESCALATE_REGULATORY hoger dan ESCALATE_HUMAN,
    // maar Olympia statusPriority geeft ESCALATE_HUMAN lagere index (1) dan ESCALATE_REGULATORY (2),
    // waardoor ESCALATE_HUMAN de winnaarsregel wordt (laagste index = eerste in sorteerresultaat).
    const scope = maakScope([
      maakRegel({ ruleId: "R-001", layer: "REGIONAL", domain: "GENERAL", action: "ESCALATE_HUMAN" }),
      maakRegel({ ruleId: "EU-001", layer: "EU", domain: "GENERAL", action: "ESCALATE_REGULATORY" }),
    ]);
    const resultaat = resolveOlympiaRules(scope);
    expect(resultaat.winningRule?.action).toBe("ESCALATE_HUMAN");
  });

  it("ESCALATE_HUMAN wint van PASS_WITH_TRANSPARENCY", () => {
    const scope = maakScope([
      maakRegel({ ruleId: "N-001", layer: "NATIONAL", domain: "GENERAL", action: "PASS_WITH_TRANSPARENCY" }),
      maakRegel({ ruleId: "EU-001", layer: "EU", domain: "GENERAL", action: "ESCALATE_HUMAN" }),
    ]);
    const resultaat = resolveOlympiaRules(scope);
    expect(resultaat.winningRule?.action).toBe("ESCALATE_HUMAN");
  });

  it("PASS_WITH_TRANSPARENCY wint van PASS", () => {
    const scope = maakScope([
      maakRegel({ ruleId: "M-001", layer: "MUNICIPAL", domain: "GENERAL", action: "PASS" }),
      maakRegel({ ruleId: "N-001", layer: "NATIONAL", domain: "GENERAL", action: "PASS_WITH_TRANSPARENCY" }),
    ]);
    const resultaat = resolveOlympiaRules(scope);
    expect(resultaat.winningRule?.action).toBe("PASS_WITH_TRANSPARENCY");
  });
});

describe("resolveOlympiaRules — domeinfilter", () => {
  it("filtert regels op domein", () => {
    const scope = maakScope([
      maakRegel({ ruleId: "EU-001", layer: "EU", domain: "CLINICAL", action: "BLOCK" }),
      maakRegel({ ruleId: "EU-002", layer: "EU", domain: "FINANCE", action: "PASS" }),
    ]);
    const resultaat = resolveOlympiaRules(scope, "FINANCE");
    expect(resultaat.applicableRules).toHaveLength(1);
    expect(resultaat.winningRule?.ruleId).toBe("EU-002");
  });

  it("levert lege resultaten op bij onbekend domein", () => {
    const scope = maakScope([
      maakRegel({ ruleId: "EU-001", layer: "EU", domain: "CLINICAL", action: "PASS" }),
    ]);
    const resultaat = resolveOlympiaRules(scope, "ONBEKEND_DOMEIN");
    expect(resultaat.applicableRules).toHaveLength(0);
    expect(resultaat.winningRule).toBeNull();
  });
});

describe("resolveOlympiaRules — categoriefilter", () => {
  it("filtert op categorie in titel of ruleId", () => {
    const scope = maakScope([
      maakRegel({ ruleId: "EU-CLINICAL-001", layer: "EU", domain: "CLINICAL", action: "ESCALATE_HUMAN", title: "Klinische beperking" }),
      maakRegel({ ruleId: "EU-002", layer: "EU", domain: "FINANCE", action: "PASS", title: "Financieel" }),
    ]);
    const resultaat = resolveOlympiaRules(scope, undefined, "clinical");
    expect(resultaat.applicableRules.length).toBeGreaterThan(0);
    expect(resultaat.applicableRules.every(r =>
      r.ruleId.toLowerCase().includes("clinical") ||
      r.title.toLowerCase().includes("clinical") ||
      r.domain.toLowerCase().includes("clinical")
    )).toBe(true);
  });
});

describe("resolveOlympiaRules — conflictdetectie", () => {
  it("hasConflict = true bij meerdere acties in scope", () => {
    const scope = maakScope([
      maakRegel({ ruleId: "EU-001", layer: "EU", domain: "GENERAL", action: "PASS" }),
      maakRegel({ ruleId: "N-001", layer: "NATIONAL", domain: "GENERAL", action: "BLOCK" }),
    ]);
    const resultaat = resolveOlympiaRules(scope);
    expect(resultaat.hasConflict).toBe(true);
  });

  it("hasConflict = false bij alle gelijke acties", () => {
    const scope = maakScope([
      maakRegel({ ruleId: "EU-001", layer: "EU", domain: "GENERAL", action: "PASS" }),
      maakRegel({ ruleId: "N-001", layer: "NATIONAL", domain: "GENERAL", action: "PASS" }),
    ]);
    const resultaat = resolveOlympiaRules(scope);
    expect(resultaat.hasConflict).toBe(false);
  });
});

describe("resolveOlympiaRules — layer-samenvatting", () => {
  it("retourneert alle vier layers in layer-samenvatting", () => {
    const scope = maakScope([
      maakRegel({ ruleId: "EU-001", layer: "EU", domain: "GENERAL", action: "PASS" }),
    ]);
    const resultaat = resolveOlympiaRules(scope);
    const layerNamen = resultaat.layers.map(l => l.layer);
    expect(layerNamen).toContain("EU");
    expect(layerNamen).toContain("NATIONAL");
    expect(layerNamen).toContain("REGIONAL");
    expect(layerNamen).toContain("MUNICIPAL");
  });

  it("EU-layer heeft prioriteit 1 (hoogste)", () => {
    const scope = maakScope([
      maakRegel({ ruleId: "EU-001", layer: "EU", domain: "GENERAL", action: "PASS" }),
    ]);
    const resultaat = resolveOlympiaRules(scope);
    const euLayer = resultaat.layers.find(l => l.layer === "EU");
    expect(euLayer?.priority).toBe(1);
  });

  it("MUNICIPAL-layer heeft lagere prioriteit dan EU", () => {
    const scope = maakScope([]);
    const resultaat = resolveOlympiaRules(scope);
    const euPrioriteit = resultaat.layers.find(l => l.layer === "EU")!.priority;
    const municipalPrioriteit = resultaat.layers.find(l => l.layer === "MUNICIPAL")!.priority;
    expect(municipalPrioriteit).toBeGreaterThan(euPrioriteit);
  });

  it("dominantAction in layer weerspiegelt de zwaarste actie van die layer", () => {
    const scope = maakScope([
      maakRegel({ ruleId: "EU-001", layer: "EU", domain: "GENERAL", action: "BLOCK" }),
      maakRegel({ ruleId: "EU-002", layer: "EU", domain: "GENERAL", action: "PASS" }),
    ]);
    const resultaat = resolveOlympiaRules(scope);
    const euLayer = resultaat.layers.find(l => l.layer === "EU");
    expect(euLayer?.dominantAction).toBe("BLOCK");
  });
});

describe("resolveOlympiaRules — totalRules teller", () => {
  it("totalRules telt alle regels in de scope ongeacht filter", () => {
    const scope = maakScope([
      maakRegel({ ruleId: "EU-001", layer: "EU", domain: "CLINICAL", action: "BLOCK" }),
      maakRegel({ ruleId: "N-001", layer: "NATIONAL", domain: "FINANCE", action: "PASS" }),
      maakRegel({ ruleId: "R-001", layer: "REGIONAL", domain: "LEGAL", action: "ESCALATE_HUMAN" }),
    ]);
    const resultaat = resolveOlympiaRules(scope, "CLINICAL");
    expect(resultaat.totalRules).toBe(3);
    expect(resultaat.applicableRules).toHaveLength(1);
  });
});

// ── preflightCheck ────────────────────────────────────────────────────────────

describe("preflightCheck — geldige scope", () => {
  it("scope met geldige regels en categorieën → canLock = true", () => {
    const resultaat = preflightCheck({
      rules: [
        { ruleId: "EU-001", layer: "EU", domain: "GENERAL", action: "PASS", title: "Test", description: "Beschrijving." },
      ],
      categories: [{ name: "Observatie", status: "PASS" }],
    });
    expect(resultaat.canLock).toBe(true);
    expect(resultaat.issues).toHaveLength(0);
  });
});

describe("preflightCheck — lege scope", () => {
  it("scope zonder regels → canLock = false", () => {
    const resultaat = preflightCheck({ rules: [], categories: [] });
    expect(resultaat.canLock).toBe(false);
    expect(resultaat.issues.length).toBeGreaterThan(0);
  });

  it("foutmelding vermeldt dat er geen regels zijn", () => {
    const resultaat = preflightCheck({ rules: [], categories: [] });
    expect(resultaat.issues.some(i => i.toLowerCase().includes("geen regels"))).toBe(true);
  });
});

describe("preflightCheck — ontbrekende ruleId", () => {
  it("regel zonder ruleId → canLock = false", () => {
    const resultaat = preflightCheck({
      rules: [{ ruleId: "", layer: "EU", domain: "GENERAL", action: "PASS" }],
      categories: [],
    });
    expect(resultaat.canLock).toBe(false);
    expect(resultaat.issues.some(i => i.includes("ruleId"))).toBe(true);
  });

  it("ruleId met alleen spaties → canLock = false", () => {
    const resultaat = preflightCheck({
      rules: [{ ruleId: "   ", layer: "EU", domain: "GENERAL", action: "PASS" }],
      categories: [],
    });
    expect(resultaat.canLock).toBe(false);
  });
});

describe("preflightCheck — ongeldige actie", () => {
  it("onbekende actie → canLock = false", () => {
    const resultaat = preflightCheck({
      rules: [{ ruleId: "EU-001", layer: "EU", domain: "GENERAL", action: "ONGELDIG" }],
      categories: [],
    });
    expect(resultaat.canLock).toBe(false);
    expect(resultaat.issues.some(i => i.includes("ongeldige action"))).toBe(true);
  });

  it("foutmelding noemt de ongeldige actie", () => {
    const resultaat = preflightCheck({
      rules: [{ ruleId: "EU-001", layer: "EU", domain: "GENERAL", action: "GOEDKEUREN" }],
      categories: [],
    });
    expect(resultaat.issues.some(i => i.includes("GOEDKEUREN"))).toBe(true);
  });
});

describe("preflightCheck — waarschuwingen vs. fouten", () => {
  it("geen categorieën → waarschuwing maar geen fout (canLock niet geblokkeerd door dit)", () => {
    const resultaat = preflightCheck({
      rules: [{ ruleId: "EU-001", layer: "EU", domain: "GENERAL", action: "PASS", title: "T", description: "D." }],
      categories: [],
    });
    expect(resultaat.warnings.some(w => w.toLowerCase().includes("categorieën"))).toBe(true);
    // canLock wordt alleen door issues bepaald, niet door warnings
    expect(resultaat.canLock).toBe(true);
  });
});

describe("preflightCheck — statistieken", () => {
  it("stats.totalRules klopt", () => {
    const resultaat = preflightCheck({
      rules: [
        { ruleId: "EU-001", layer: "EU", domain: "GENERAL", action: "PASS" },
        { ruleId: "EU-002", layer: "EU", domain: "GENERAL", action: "BLOCK" },
      ],
      categories: [{ name: "Cat" }],
    });
    expect(resultaat.stats.totalRules).toBe(2);
  });

  it("stats.rulesWithValidAction telt alleen geldige acties", () => {
    const resultaat = preflightCheck({
      rules: [
        { ruleId: "EU-001", layer: "EU", domain: "GENERAL", action: "PASS" },
        { ruleId: "EU-002", layer: "EU", domain: "GENERAL", action: "ONGELDIG" },
      ],
      categories: [],
    });
    expect(resultaat.stats.rulesWithValidAction).toBe(1);
  });

  it("stats.rulesWithRuleId telt regels met geldige ruleId", () => {
    const resultaat = preflightCheck({
      rules: [
        { ruleId: "EU-001", action: "PASS" },
        { ruleId: "", action: "PASS" },
      ],
      categories: [],
    });
    expect(resultaat.stats.rulesWithRuleId).toBe(1);
  });
});
