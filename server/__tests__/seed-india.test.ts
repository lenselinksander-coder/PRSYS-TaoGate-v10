import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  INR_AUTO_APPROVE_THRESHOLD,
  INR_FMU_REPORT_THRESHOLD,
  INDIA_SCOPE_NAME,
  indiaRules,
  seedIndiaScope,
} from "../seed";

// ─── Storage mock ─────────────────────────────────────────────────────────────
// seedIndiaScope gebruikt storage-methoden; we mocken de module zodat er geen
// databaseverbinding nodig is tijdens de tests.
vi.mock("../storage", () => ({
  storage: {
    getOrganizations: vi.fn(),
    createOrganization: vi.fn(),
    getScopesByOrg: vi.fn(),
    createScope: vi.fn(),
  },
}));

import { storage } from "../storage";

const mockStorage = storage as {
  getOrganizations: ReturnType<typeof vi.fn>;
  createOrganization: ReturnType<typeof vi.fn>;
  getScopesByOrg: ReturnType<typeof vi.fn>;
  createScope: ReturnType<typeof vi.fn>;
};

const INDIA_ORG = { id: "org-india-1", slug: "taogate-india", name: "TaoGate India" };

describe("India Scope — drempelwaarden (constanten)", () => {
  it("INR_AUTO_APPROVE_THRESHOLD is 50.000", () => {
    expect(INR_AUTO_APPROVE_THRESHOLD).toBe(50_000);
  });

  it("INR_FMU_REPORT_THRESHOLD is 5 lakh (500.000)", () => {
    expect(INR_FMU_REPORT_THRESHOLD).toBe(500_000);
  });

  it("FMU drempel is hoger dan auto-approve drempel", () => {
    expect(INR_FMU_REPORT_THRESHOLD).toBeGreaterThan(INR_AUTO_APPROVE_THRESHOLD);
  });
});

describe("India Scope — regelset structuur", () => {
  it("indiaRules bevat exact 6 regels", () => {
    expect(indiaRules).toHaveLength(6);
  });

  it("elke regel heeft verplichte velden (ruleId, layer, domain, action)", () => {
    for (const rule of indiaRules) {
      expect(rule.ruleId).toBeTruthy();
      expect(rule.layer).toBeTruthy();
      expect(rule.domain).toBeTruthy();
      expect(rule.action).toBeTruthy();
    }
  });

  it("IRDAI_IIB_BLOCK → ESCALATE_REGULATORY, overridesLowerLayers = true", () => {
    const rule = indiaRules.find(r => r.ruleId === "IRDAI_IIB_BLOCK");
    expect(rule).toBeDefined();
    expect(rule!.action).toBe("ESCALATE_REGULATORY");
    expect(rule!.overridesLowerLayers).toBe(true);
  });

  it("IRDAI_DUPLICATE_BLOCK → BLOCK, overridesLowerLayers = true", () => {
    const rule = indiaRules.find(r => r.ruleId === "IRDAI_DUPLICATE_BLOCK");
    expect(rule).toBeDefined();
    expect(rule!.action).toBe("BLOCK");
    expect(rule!.overridesLowerLayers).toBe(true);
  });

  it("TAOGATE_AUTO_APPROVE → PASS, overridesLowerLayers = false", () => {
    const rule = indiaRules.find(r => r.ruleId === "TAOGATE_AUTO_APPROVE");
    expect(rule).toBeDefined();
    expect(rule!.action).toBe("PASS");
    expect(rule!.overridesLowerLayers).toBe(false);
  });

  it("IRDAI_INJURY_HUMAN → ESCALATE_HUMAN, overridesLowerLayers = true", () => {
    const rule = indiaRules.find(r => r.ruleId === "IRDAI_INJURY_HUMAN");
    expect(rule).toBeDefined();
    expect(rule!.action).toBe("ESCALATE_HUMAN");
    expect(rule!.overridesLowerLayers).toBe(true);
  });

  it("IRDAI_FMU_REPORT → ESCALATE_REGULATORY, overridesLowerLayers = true", () => {
    const rule = indiaRules.find(r => r.ruleId === "IRDAI_FMU_REPORT");
    expect(rule).toBeDefined();
    expect(rule!.action).toBe("ESCALATE_REGULATORY");
    expect(rule!.overridesLowerLayers).toBe(true);
  });

  it("TAOGATE_SOFT_FRAUD_REVIEW → ESCALATE_HUMAN, overridesLowerLayers = false", () => {
    const rule = indiaRules.find(r => r.ruleId === "TAOGATE_SOFT_FRAUD_REVIEW");
    expect(rule).toBeDefined();
    expect(rule!.action).toBe("ESCALATE_HUMAN");
    expect(rule!.overridesLowerLayers).toBe(false);
  });

  it("AUTO_APPROVE regel-beschrijving bevat de drempelwaarde als getal", () => {
    const rule = indiaRules.find(r => r.ruleId === "TAOGATE_AUTO_APPROVE");
    expect(rule!.description).toContain(INR_AUTO_APPROVE_THRESHOLD.toLocaleString("nl-IN"));
  });

  it("FMU_REPORT regel-beschrijving bevat de FMU drempelwaarde als getal", () => {
    const rule = indiaRules.find(r => r.ruleId === "IRDAI_FMU_REPORT");
    expect(rule!.description).toContain(INR_FMU_REPORT_THRESHOLD.toLocaleString("nl-IN"));
  });
});

describe("seedIndiaScope — idempotentie en guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("slaat over als scope al bestaat", async () => {
    mockStorage.getOrganizations.mockResolvedValue([INDIA_ORG]);
    mockStorage.getScopesByOrg.mockResolvedValue([{ name: INDIA_SCOPE_NAME }]);

    await seedIndiaScope();

    expect(mockStorage.createScope).not.toHaveBeenCalled();
  });

  it("maakt organisatie aan als taogate-india nog niet bestaat", async () => {
    mockStorage.getOrganizations.mockResolvedValue([]);
    mockStorage.createOrganization.mockResolvedValue(INDIA_ORG);
    mockStorage.getScopesByOrg.mockResolvedValue([]);
    mockStorage.createScope.mockResolvedValue({});

    await seedIndiaScope();

    expect(mockStorage.createOrganization).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "taogate-india" }),
    );
  });

  it("maakt scope aan als organisatie bestaat maar scope nog niet", async () => {
    mockStorage.getOrganizations.mockResolvedValue([INDIA_ORG]);
    mockStorage.getScopesByOrg.mockResolvedValue([]);
    mockStorage.createScope.mockResolvedValue({});

    await seedIndiaScope();

    expect(mockStorage.createScope).toHaveBeenCalledOnce();
    const callArg: unknown = mockStorage.createScope.mock.calls[0]?.[0];
    expect(callArg).toBeDefined();
    const scopeArg = callArg as { name: string; rules: unknown[] };
    expect(scopeArg.name).toBe(INDIA_SCOPE_NAME);
    expect(scopeArg.rules).toHaveLength(indiaRules.length);
  });

  it("geeft geen fout als getOrganizations een lege lijst teruggeeft (guard)", async () => {
    mockStorage.getOrganizations.mockResolvedValue([]);
    mockStorage.createOrganization.mockResolvedValue(INDIA_ORG);
    mockStorage.getScopesByOrg.mockResolvedValue([]);
    mockStorage.createScope.mockResolvedValue({});

    await expect(seedIndiaScope()).resolves.not.toThrow();
  });
});
