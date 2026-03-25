// server/__tests__/multi-tape-pipeline.test.ts
//
// Tests voor de multi-tape pipeline orchestrator.
// Invariant: BLOCK wint altijd (A9), TGA4 → ESCALATE_HUMAN, EU gate is terminaal.
//
// Alle externe afhankelijkheden (storage, core, audit) worden gemockt.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../storage", () => ({
  storage: {
    getTapeScopesByOrg: vi.fn(),
  },
}));

vi.mock("../core", () => ({
  getTapeDeck: vi.fn(),
  executeTaoGate: vi.fn(),
  runEuLegalGate: vi.fn(),
}));

vi.mock("../audit", () => ({
  auditLog: vi.fn(),
}));

import { storage } from "../storage";
import { getTapeDeck, executeTaoGate, runEuLegalGate } from "../core";
import { auditLog } from "../audit";
import { runMultiTapePipeline } from "../pipeline/multiTape";

// Typed mock helpers
const mockStorage = storage as { getTapeScopesByOrg: ReturnType<typeof vi.fn> };
const mockGetTapeDeck = getTapeDeck as ReturnType<typeof vi.fn>;
const mockExecuteTaoGate = executeTaoGate as ReturnType<typeof vi.fn>;
const mockRunEuLegalGate = runEuLegalGate as ReturnType<typeof vi.fn>;
const mockAuditLog = auditLog as ReturnType<typeof vi.fn>;

// ── Fabriek-helpers ────────────────────────────────────────────────────────────

function makeTapeScope(overrides: Record<string, unknown> = {}) {
  return {
    id: "scope-1",
    name: "Test Scope",
    status: "LOCKED",
    isTapeScope: true,
    tapeNumber: 0,
    orgId: "org-1",
    categories: [],
    documents: [],
    rules: [],
    ingestMeta: null,
    scopeMeta: null,
    isDefault: "false",
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeTapeDeck(tapes: [string, unknown][] = []) {
  return {
    tapes: new Map(tapes),
    manifest: { entries: [] },
  };
}

function makeTape(id = "tape-0") {
  return {
    meta: { tape_id: id },
    decide: vi.fn(),
  };
}

function makeTRSTDecision(status: string, hardBlock = false): unknown {
  return {
    dc: {},
    canon: { delta: true, phi: true, psi: true, valid: true, failures: [] },
    result: hardBlock ? null : {
      status,
      category: "TEST",
      escalation: null,
      rule_id: null,
      layer: "EU",
      reason: "Testreden.",
      tape_id: "tape-0",
    },
    hard_block: hardBlock,
    hard_block_reason: hardBlock ? "Hard block in test." : null,
    processing_ms: 1,
    physics: null,
    axioms_satisfied: [],
    axioms_violated: [],
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runMultiTapePipeline", () => {

  // Scenario 1: EU gate triggered → BLOCK, geen tape-evaluatie
  it("geeft BLOCK terug als de EU Legal Gate getriggerd wordt", async () => {
    mockRunEuLegalGate.mockReturnValue({
      blocked: true,
      triggered: true,
      ground: "Art. 5.1(a) — subliminale manipulatie",
      note: null,
    });

    const result = await runMultiTapePipeline("org-1", "subliminale AI-manipulatie");

    expect(result.finalDecision).toBe("BLOCK");
    expect(result.euBlocked).toBe(true);
    expect(result.tapeResults).toHaveLength(0);
    expect(mockStorage.getTapeScopesByOrg).not.toHaveBeenCalled();
    expect(mockAuditLog).toHaveBeenCalledOnce();
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "BLOCK", cove: "EU_AI_ACT_ART5_BLOCK" }),
    );
  });

  // Scenario 2: geen tape-scopes beschikbaar → TGA4 → ESCALATE_HUMAN
  it("geeft ESCALATE_HUMAN terug als er geen tape-scopes zijn (TGA4)", async () => {
    mockRunEuLegalGate.mockReturnValue({ blocked: false, triggered: false, ground: null, note: null });
    mockStorage.getTapeScopesByOrg.mockResolvedValue([]);

    const result = await runMultiTapePipeline("org-1", "normale intentie");

    expect(result.finalDecision).toBe("ESCALATE_HUMAN");
    expect(result.tapeResults).toHaveLength(0);
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "ESCALATE_HUMAN", cove: "TGA4_NO_TAPE_SCOPES" }),
    );
  });

  // Scenario 3: één tape geeft BLOCK → finale beslissing is BLOCK (A9)
  it("geeft BLOCK terug als één tape BLOCK produceert (A9 Non-Override)", async () => {
    mockRunEuLegalGate.mockReturnValue({ blocked: false, triggered: false, ground: null, note: null });

    const scope = makeTapeScope({ id: "scope-1", tapeNumber: 0 });
    mockStorage.getTapeScopesByOrg.mockResolvedValue([scope]);

    const tape = makeTape("tape-0");
    mockGetTapeDeck.mockReturnValue(makeTapeDeck([["scope-1", tape]]));
    mockExecuteTaoGate.mockReturnValue(makeTRSTDecision("BLOCK"));

    const result = await runMultiTapePipeline("org-1", "verboden handeling");

    expect(result.finalDecision).toBe("BLOCK");
    expect(result.tapeResults).toHaveLength(1);
    expect(result.tapeResults[0].decision).toBe("BLOCK");
  });

  // Scenario 4: één tape ESCALATE_HUMAN, geen BLOCK → finale is ESCALATE_HUMAN
  it("geeft ESCALATE_HUMAN terug als een tape escaleert maar niets blokkeert", async () => {
    mockRunEuLegalGate.mockReturnValue({ blocked: false, triggered: false, ground: null, note: null });

    const scope1 = makeTapeScope({ id: "scope-1", tapeNumber: 0 });
    const scope2 = makeTapeScope({ id: "scope-2", tapeNumber: 1, name: "Scope 2" });
    mockStorage.getTapeScopesByOrg.mockResolvedValue([scope1, scope2]);

    const tape1 = makeTape("tape-0");
    const tape2 = makeTape("tape-1");
    mockGetTapeDeck.mockReturnValue(makeTapeDeck([
      ["scope-1", tape1],
      ["scope-2", tape2],
    ]));

    mockExecuteTaoGate
      .mockReturnValueOnce(makeTRSTDecision("ESCALATE_HUMAN"))
      .mockReturnValueOnce(makeTRSTDecision("PASS"));

    const result = await runMultiTapePipeline("org-1", "twijfelachtige intentie");

    expect(result.finalDecision).toBe("ESCALATE_HUMAN");
    expect(result.tapeResults).toHaveLength(2);
  });

  // Scenario 5: alle tapes geven PASS → finale beslissing is PASS
  it("geeft PASS terug als alle tapes PASS produceren", async () => {
    mockRunEuLegalGate.mockReturnValue({ blocked: false, triggered: false, ground: null, note: null });

    const scope1 = makeTapeScope({ id: "scope-1", tapeNumber: 0 });
    const scope2 = makeTapeScope({ id: "scope-2", tapeNumber: 1, name: "Scope 2" });
    mockStorage.getTapeScopesByOrg.mockResolvedValue([scope1, scope2]);

    const tape1 = makeTape("tape-0");
    const tape2 = makeTape("tape-1");
    mockGetTapeDeck.mockReturnValue(makeTapeDeck([
      ["scope-1", tape1],
      ["scope-2", tape2],
    ]));

    mockExecuteTaoGate
      .mockReturnValueOnce(makeTRSTDecision("PASS"))
      .mockReturnValueOnce(makeTRSTDecision("PASS"));

    const result = await runMultiTapePipeline("org-1", "onschuldige vraag");

    expect(result.finalDecision).toBe("PASS");
    expect(result.tapeResults).toHaveLength(2);
    // Finale audit moet aangeroepen zijn met cove die tapecount bevat
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "PASS", cove: expect.stringContaining("MULTI_TAPE_FINAL") }),
    );
  });

});
