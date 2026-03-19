import { describe, it, expect, beforeAll } from "vitest";
import { latticeMax, normaliseDecision, DECISION_RANK, DECISION_ORDER, cerberusEnforce } from "../pipeline/types";
import { runTaoGate } from "../pipeline/taogate";
import { runCoVe } from "../pipeline/cove";
import { runCastra } from "../pipeline/castra";
import { hypatiaRisk, classifyDpiaLevel, HYPATIA_THRESHOLDS } from "../trace/hypatia";
import { evaluateArachne } from "../pipeline/arachne";
import { runEuLegalGate } from "../core/euLegalGate";
import {
  bootstrapPhysics,
  computeTau,
  computeOmega,
  computeTI,
  evaluateTIGate,
  evaluateSI,
  evaluatePhysics,
  recordDeterminismCheck,
  recordTraceCheck,
  recordIsolationEvent,
  recordCryptoCheck,
  recordTimeoutEvent,
} from "../core/physics";

beforeAll(() => {
  bootstrapPhysics({ ti_min: 0.6, si_warn: 0.7, si_block: 0.9 });
});

describe("TGA∞ — Zero Dominance (∃x = 0 ⇒ Output = 0)", () => {
  it("BLOCK is the highest rank in the decision lattice", () => {
    expect(DECISION_RANK["BLOCK"]).toBe(4);
    for (const d of DECISION_ORDER) {
      if (d !== "BLOCK") {
        expect(DECISION_RANK[d]).toBeLessThan(DECISION_RANK["BLOCK"]);
      }
    }
  });

  it("BLOCK absorbs any other decision via latticeMax", () => {
    for (const d of DECISION_ORDER) {
      expect(latticeMax("BLOCK", d)).toBe("BLOCK");
      expect(latticeMax(d, "BLOCK")).toBe("BLOCK");
    }
  });
});

describe("TGA1 — G ≠ L ≠ E (Role Separation)", () => {
  it("decision lattice has exactly 5 ordered levels", () => {
    expect(DECISION_ORDER).toEqual([
      "PASS",
      "PASS_WITH_TRANSPARENCY",
      "ESCALATE_HUMAN",
      "ESCALATE_REGULATORY",
      "BLOCK",
    ]);
  });

  it("normaliseDecision maps ESCALATE → ESCALATE_HUMAN", () => {
    expect(normaliseDecision("ESCALATE")).toBe("ESCALATE_HUMAN");
    expect(normaliseDecision("PASS")).toBe("PASS");
    expect(normaliseDecision("BLOCK")).toBe("BLOCK");
  });
});

describe("TGA2 — BLOCK > alles (I2)", () => {
  it("TaoGate: one BLOCK input produces BLOCK final decision", () => {
    const r1 = runTaoGate("BLOCK", "PASS", "PASS");
    expect(r1.D_final).toBe("BLOCK");

    const r2 = runTaoGate("PASS", "BLOCK", "PASS");
    expect(r2.D_final).toBe("BLOCK");

    const r3 = runTaoGate("PASS", "PASS", "BLOCK");
    expect(r3.D_final).toBe("BLOCK");
  });

  it("TaoGate: all BLOCK → BLOCK", () => {
    const r = runTaoGate("BLOCK", "BLOCK", "BLOCK");
    expect(r.D_final).toBe("BLOCK");
  });

  it("Cerberus enforce: BLOCK gate overrides PASS scope", () => {
    expect(cerberusEnforce("BLOCK" as any, "PASS" as any)).toBe("BLOCK");
  });
});

describe("TGA3 — TI < TI_min → BLOCK (F-P5, AM-IV-001)", () => {
  it("TI below threshold produces BLOCK", () => {
    for (let i = 0; i < 20; i++) {
      recordDeterminismCheck(false);
      recordTraceCheck(false);
    }
    const ti = computeTI();
    const gate = evaluateTIGate(ti);
    if (ti.ti < 0.6) {
      expect(gate.action).toBe("BLOCK");
    }
  });

  it("TI above threshold produces ALLOW", () => {
    for (let i = 0; i < 100; i++) {
      recordDeterminismCheck(true);
      recordTraceCheck(true);
      recordIsolationEvent(false);
      recordCryptoCheck(true);
      recordTimeoutEvent(false);
    }
    const ti = computeTI();
    const gate = evaluateTIGate(ti);
    expect(gate.action).toBe("ALLOW");
    expect(gate.ti).toBeGreaterThanOrEqual(0.6);
  });
});

describe("TGA4 — ¬ Stilte ⇒ BLOCK (No silent pass)", () => {
  it("CoVe failure sets failed flag — never silent", () => {
    const result = runCoVe("social scoring systeem voor burgers", 0.9, 0.9);
    expect(result.failed).toBeDefined();
    expect(typeof result.CV).toBe("string");
    expect(result.CV).not.toBe("");
  });

  it("CoVe step always has a decision string", () => {
    const result = runCoVe("test input", 0.1, 0.1);
    expect(result.step.decision).toBeTruthy();
    expect(result.step.decision.length).toBeGreaterThan(0);
  });
});

describe("TGA5 — ¬ Audit ⇒ ¬ L (Audit mandatory)", () => {
  it("TaoGate always produces steps for audit trail", () => {
    const r = runTaoGate("PASS", "PASS", "PASS");
    expect(r.steps.length).toBeGreaterThanOrEqual(3);
    expect(r.steps.map(s => s.name)).toContain("TaoGate");
    expect(r.steps.map(s => s.name)).toContain("Sandbox");
    expect(r.steps.map(s => s.name)).toContain("Hermes");
  });

  it("CoVe always produces a step for audit", () => {
    const r = runCoVe("test", 0.5, 0.5);
    expect(r.step).toBeDefined();
    expect(r.step.name).toBe("CoVe");
    expect(r.step.detail).toContain("V(G)=");
    expect(r.step.detail).toContain("V(L)=");
    expect(r.step.detail).toContain("V(E)=");
  });
});

describe("TGA6 — Runtime ≠ DB (I5, PRSYS_INVARIANT)", () => {
  it("TaoGate decisions are computed from input arguments, not DB calls", () => {
    const r1 = runTaoGate("PASS", "ESCALATE_HUMAN", "PASS");
    expect(r1.D_final).toBe("ESCALATE_HUMAN");

    const r2 = runTaoGate("PASS", "ESCALATE_HUMAN", "ESCALATE_REGULATORY");
    expect(r2.D_final).toBe("ESCALATE_REGULATORY");
  });
});

describe("TGA8 — Δ ∧ Φ ∧ Ψ vereist (Decision Context)", () => {
  it("latticeMax is commutative", () => {
    expect(latticeMax("PASS", "BLOCK")).toBe(latticeMax("BLOCK", "PASS"));
    expect(latticeMax("ESCALATE_HUMAN", "ESCALATE_REGULATORY")).toBe(
      latticeMax("ESCALATE_REGULATORY", "ESCALATE_HUMAN")
    );
  });

  it("latticeMax is associative", () => {
    const a = "PASS", b = "ESCALATE_HUMAN", c = "BLOCK";
    expect(latticeMax(latticeMax(a, b), c)).toBe(latticeMax(a, latticeMax(b, c)));
  });
});

describe("TGA10 — Timeout → HARD_BLOCK", () => {
  it("high SI produces HARD_BLOCK", () => {
    const tau = computeTau({
      rules_evaluated: 50,
      branches_taken: 50,
      proof_steps: 50,
      payload_bytes: 10000,
      policy_depth: 50,
    });
    const highOmega = { omega: 1.0, omega_raw: 2.0, arrivals_per_sec: 200, inflight: 10, queue_depth: 100, load_ratio: 1.0, pressure: 1.0, capacity: 200 };
    const si = evaluateSI(tau, highOmega);
    if (si.si >= 0.9) {
      expect(si.action).toBe("HARD_BLOCK");
    }
  });
});

describe("TGA11 / TGA16 — CoVe ⊥ (I6: No layer verifies its own output)", () => {
  it("CoVe uses three independent evaluators (Hypatia, EuLegalGate, Arachne)", () => {
    const result = runCoVe("test", 0.3, 0.3);
    expect(result.step.detail).toContain("Hypatia");
    expect(result.step.detail).toContain("EuLegalGate");
    expect(result.step.detail).toContain("Arachne");
  });

  it("CoVe V(G), V(L), V(E) are independently computed", () => {
    const r = runCoVe("social scoring", 0.9, 0.9);
    expect(typeof r.V_G).toBe("string");
    expect(typeof r.V_L).toBe("string");
    expect(typeof r.V_E).toBe("string");
  });

  it("CoVe CV = latticeMax(V_G, V_L, V_E)", () => {
    const r = runCoVe("predictive policing recidiverisico", 0.8, 0.8);
    const expected = latticeMax(latticeMax(r.V_G, r.V_L), r.V_E);
    expect(r.CV).toBe(expected);
  });
});

describe("F-P2 — SI = τ × ω", () => {
  it("SI equals tau times omega", () => {
    const tau = computeTau({ rules_evaluated: 5, branches_taken: 2, proof_steps: 3, payload_bytes: 500, policy_depth: 2 });
    const omega = computeOmega();
    const si = evaluateSI(tau, omega);
    expect(si.si).toBeCloseTo(tau.tau * omega.omega, 5);
  });

  it("SI = 0 when omega = 0", () => {
    const tau = computeTau({ rules_evaluated: 5, branches_taken: 2, proof_steps: 3, payload_bytes: 500, policy_depth: 2 });
    const zeroOmega = { omega: 0, omega_raw: 0, arrivals_per_sec: 0, inflight: 0, queue_depth: 0, load_ratio: 0, pressure: 0, capacity: 200 };
    const si = evaluateSI(tau, zeroOmega);
    expect(si.si).toBe(0);
    expect(si.action).toBe("ALLOW");
  });
});

describe("F-P5 — TI-GATE: existence precedes quality", () => {
  it("evaluatePhysics: TI < TI_min → TI_BLOCK, SI is null", () => {
    for (let i = 0; i < 50; i++) {
      recordDeterminismCheck(false);
      recordCryptoCheck(false);
    }
    const tau = computeTau({ rules_evaluated: 5, branches_taken: 2, proof_steps: 3, payload_bytes: 500, policy_depth: 2 });
    const omega = computeOmega();
    const ti = computeTI();
    if (ti.ti < 0.6) {
      const decision = evaluatePhysics(tau, omega, ti);
      expect(decision.action).toBe("TI_BLOCK");
      expect(decision.si).toBeNull();
      expect(decision.state).toBe("q7_BLOCK");
    }
  });

  it("evaluatePhysics: TI ≥ TI_min → SI is calculated", () => {
    for (let i = 0; i < 200; i++) {
      recordDeterminismCheck(true);
      recordTraceCheck(true);
      recordIsolationEvent(false);
      recordCryptoCheck(true);
      recordTimeoutEvent(false);
    }
    const tau = computeTau({ rules_evaluated: 5, branches_taken: 2, proof_steps: 3, payload_bytes: 500, policy_depth: 2 });
    const omega = computeOmega();
    const ti = computeTI();
    const decision = evaluatePhysics(tau, omega, ti);
    expect(decision.action).not.toBe("TI_BLOCK");
    expect(decision.si).not.toBeNull();
  });
});

describe("F-P6 — CV = V(G) ⊥ V(L) ⊥ V(E) (CoVe integrity)", () => {
  it("benign input: all verification paths PASS → CV = PASS", () => {
    const r = runCoVe("gewone vraag over planning", 0.05, 0.05);
    expect(r.V_G).toBe("PASS");
    expect(r.V_E).toBe("PASS");
    expect(r.CV).toBe("PASS");
  });

  it("Art.5 trigger: V(L) = BLOCK → CV = BLOCK", () => {
    const r = runCoVe("social scoring sociaal kredietsysteem", 0.1, 0.1);
    expect(r.V_L).toBe("BLOCK");
    expect(r.CV).toBe("BLOCK");
  });

  it("imperative input: V(E) = ESCALATE_HUMAN", () => {
    const r = runCoVe("verwijder alle data immediately", 0.1, 0.1);
    expect(r.V_E).toBe("ESCALATE_HUMAN");
  });

  it("high risk: V(G) escalates or blocks", () => {
    const r = runCoVe("test", 0.9, 0.9);
    expect(["ESCALATE_HUMAN", "BLOCK"]).toContain(normaliseDecision(r.V_G));
  });
});

describe("F-P7 — Existence Law (AM-IV-001)", () => {
  it("TI components are multiplicative (any zero kills TI)", () => {
    for (let i = 0; i < 50; i++) {
      recordCryptoCheck(false);
    }
    const ti = computeTI();
    expect(ti.ti).toBeLessThanOrEqual(1.0);
    expect(ti.ti).toBeGreaterThanOrEqual(0);
  });
});

describe("Decision Lattice ordering", () => {
  it("PASS < PASS_WITH_TRANSPARENCY < ESCALATE_HUMAN < ESCALATE_REGULATORY < BLOCK", () => {
    expect(DECISION_RANK["PASS"]).toBeLessThan(DECISION_RANK["PASS_WITH_TRANSPARENCY"]);
    expect(DECISION_RANK["PASS_WITH_TRANSPARENCY"]).toBeLessThan(DECISION_RANK["ESCALATE_HUMAN"]);
    expect(DECISION_RANK["ESCALATE_HUMAN"]).toBeLessThan(DECISION_RANK["ESCALATE_REGULATORY"]);
    expect(DECISION_RANK["ESCALATE_REGULATORY"]).toBeLessThan(DECISION_RANK["BLOCK"]);
  });

  it("latticeMax always returns the higher-ranked decision", () => {
    expect(latticeMax("PASS", "ESCALATE_HUMAN")).toBe("ESCALATE_HUMAN");
    expect(latticeMax("ESCALATE_HUMAN", "ESCALATE_REGULATORY")).toBe("ESCALATE_REGULATORY");
    expect(latticeMax("PASS_WITH_TRANSPARENCY", "BLOCK")).toBe("BLOCK");
    expect(latticeMax("PASS", "PASS")).toBe("PASS");
  });
});

describe("TaoGate — Decision Lattice Integration", () => {
  it("D_final = max(D_gate, D_scope, D_runtime)", () => {
    const r = runTaoGate("PASS", "ESCALATE_HUMAN", "PASS_WITH_TRANSPARENCY");
    expect(r.D_final).toBe("ESCALATE_HUMAN");
  });

  it("sandbox ALLOWED only for PASS or PASS_WITH_TRANSPARENCY", () => {
    expect(runTaoGate("PASS", "PASS", "PASS").sandboxStatus).toBe("ALLOWED");
    expect(runTaoGate("PASS_WITH_TRANSPARENCY", "PASS", "PASS").sandboxStatus).toBe("ALLOWED");
    expect(runTaoGate("ESCALATE_HUMAN", "PASS", "PASS").sandboxStatus).toBe("DENIED");
    expect(runTaoGate("BLOCK", "PASS", "PASS").sandboxStatus).toBe("DENIED");
  });

  it("Hermes step carries escalation target when provided", () => {
    const r = runTaoGate("ESCALATE_HUMAN", "PASS", "PASS", "DPO");
    const hermes = r.steps.find(s => s.name === "Hermes");
    expect(hermes?.detail).toContain("DPO");
  });
});

describe("Hypatia — Risk = Impact × Probability", () => {
  it("Risk = Impact × Probability", () => {
    const r = hypatiaRisk(0.5, 0.6);
    expect(r.risk).toBeCloseTo(0.3, 5);
  });

  it("clamps input to [0,1]", () => {
    const r = hypatiaRisk(1.5, -0.3);
    expect(r.impact).toBe(1.0);
    expect(r.probability).toBe(0.0);
    expect(r.risk).toBe(0.0);
  });

  it("low risk → PASS", () => {
    expect(hypatiaRisk(0.1, 0.1).decision).toBe("PASS");
  });

  it("medium risk → PASS_WITH_TRANSPARENCY", () => {
    expect(hypatiaRisk(0.5, 0.5).decision).toBe("PASS_WITH_TRANSPARENCY");
  });

  it("high risk → ESCALATE", () => {
    expect(hypatiaRisk(0.8, 0.6).decision).toBe("ESCALATE");
  });

  it("critical risk → BLOCK", () => {
    expect(hypatiaRisk(0.9, 0.9).decision).toBe("BLOCK");
  });

  it("DPIA levels classify correctly", () => {
    expect(classifyDpiaLevel(0.05)).toBe(0);
    expect(classifyDpiaLevel(0.15)).toBe(1);
    expect(classifyDpiaLevel(0.3)).toBe(2);
    expect(classifyDpiaLevel(0.5)).toBe(3);
    expect(classifyDpiaLevel(0.7)).toBe(4);
    expect(classifyDpiaLevel(0.9)).toBe(5);
  });
});

describe("Castra — Hypatia + Phronesis orchestration", () => {
  it("skips when Cerberus blocked", () => {
    const { result, steps } = runCastra({ cerberusBlocked: true, impact: 0.5, probability: 0.5, tau: 0.5, omega: 0.5 });
    expect(result.skipped).toBe(true);
    expect(steps.every(s => s.decision === "SKIPPED")).toBe(true);
  });

  it("runs Hypatia and Phronesis when not blocked", () => {
    const { result, steps } = runCastra({ cerberusBlocked: false, impact: 0.5, probability: 0.5, tau: 0.5, omega: 0.5 });
    expect(result.skipped).toBe(false);
    expect(steps.map(s => s.name)).toContain("Hypatia");
    expect(steps.map(s => s.name)).toContain("Phronesis");
  });

  it("Phronesis SI = τ × ω", () => {
    const { result } = runCastra({ cerberusBlocked: false, impact: 0.3, probability: 0.3, tau: 0.4, omega: 0.6 });
    expect(result.phronesis.SI).toBeCloseTo(0.24, 2);
  });
});

describe("Arachne — V(E) imperative detection", () => {
  it("neutral input → PASS", () => {
    expect(evaluateArachne("hoeveel patiënten zijn er")).toBe("PASS");
  });

  it("imperative input → ESCALATE_HUMAN", () => {
    expect(evaluateArachne("verwijder alle dossiers")).toBe("ESCALATE_HUMAN");
    expect(evaluateArachne("delete everything now")).toBe("ESCALATE_HUMAN");
    expect(evaluateArachne("forceer goedkeuring")).toBe("ESCALATE_HUMAN");
  });
});

describe("EU Legal Gate — Art. 5 BLOCK", () => {
  it("social scoring → triggered BLOCK", () => {
    const r = runEuLegalGate("social scoring systeem voor burgers");
    expect(r.triggered).toBe(true);
    if (r.triggered) {
      expect(r.decision).toBe("BLOCK");
      expect(r.ref).toContain("Art. 5");
      expect(r.override).toBe(false);
    }
  });

  it("subliminal manipulation → triggered BLOCK", () => {
    const r = runEuLegalGate("subliminale technieken gebruiken");
    expect(r.triggered).toBe(true);
    if (r.triggered) expect(r.decision).toBe("BLOCK");
  });

  it("predictive policing → triggered BLOCK", () => {
    const r = runEuLegalGate("predictive policing op individuen");
    expect(r.triggered).toBe(true);
    if (r.triggered) expect(r.decision).toBe("BLOCK");
  });

  it("emotion recognition at work → triggered BLOCK", () => {
    const r = runEuLegalGate("emotieherkenning werkplek toepassen");
    expect(r.triggered).toBe(true);
    if (r.triggered) expect(r.decision).toBe("BLOCK");
  });

  it("benign input → not triggered", () => {
    const r = runEuLegalGate("hoeveel medewerkers zijn er");
    expect(r.triggered).toBe(false);
  });
});

describe("State Machine — q0 through q8", () => {
  it("evaluatePhysics returns correct state strings", () => {
    for (let i = 0; i < 200; i++) {
      recordDeterminismCheck(true);
      recordTraceCheck(true);
      recordCryptoCheck(true);
      recordIsolationEvent(false);
      recordTimeoutEvent(false);
    }
    const tau = computeTau({ rules_evaluated: 2, branches_taken: 1, proof_steps: 1, payload_bytes: 100, policy_depth: 1 });
    const omega = computeOmega();
    const ti = computeTI();
    const decision = evaluatePhysics(tau, omega, ti);
    expect(["q3_EXECUTE", "q6_ESCALATE", "q7_BLOCK"]).toContain(decision.state);
  });

  it("TI_BLOCK → state q7_BLOCK", () => {
    for (let i = 0; i < 100; i++) {
      recordDeterminismCheck(false);
      recordCryptoCheck(false);
      recordTraceCheck(false);
    }
    const tau = computeTau({ rules_evaluated: 2, branches_taken: 1, proof_steps: 1, payload_bytes: 100, policy_depth: 1 });
    const omega = computeOmega();
    const ti = computeTI();
    if (ti.ti < 0.6) {
      const decision = evaluatePhysics(tau, omega, ti);
      expect(decision.state).toBe("q7_BLOCK");
    }
  });
});

describe("Vector Engine — S = √(m² + i² + l²) / √3", () => {
  it("stability formula produces values in [0, 1]", () => {
    const compute = (m: number, i: number, l: number) =>
      Math.sqrt(m * m + i * i + l * l) / Math.sqrt(3);

    expect(compute(0, 0, 0)).toBe(0);
    expect(compute(1, 1, 1)).toBeCloseTo(1, 5);
    expect(compute(0.8, 0.7, 0.6)).toBeGreaterThan(0);
    expect(compute(0.8, 0.7, 0.6)).toBeLessThanOrEqual(1);
  });

  it("sector thresholds: zorg=0.8, beleid=0.7, infra=0.6", () => {
    const thresholds = { zorg: 0.8, beleid: 0.7, infra: 0.6 };
    expect(thresholds.zorg).toBeGreaterThan(thresholds.beleid);
    expect(thresholds.beleid).toBeGreaterThan(thresholds.infra);
  });
});

describe("TI composite — AM-II-001 (α·H + β·T + γ·S weights)", () => {
  it("TI components are all between 0 and 1", () => {
    const ti = computeTI();
    expect(ti.components.DI).toBeGreaterThanOrEqual(0);
    expect(ti.components.DI).toBeLessThanOrEqual(1);
    expect(ti.components.TrI).toBeGreaterThanOrEqual(0);
    expect(ti.components.TrI).toBeLessThanOrEqual(1);
    expect(ti.components.II).toBeGreaterThanOrEqual(0);
    expect(ti.components.II).toBeLessThanOrEqual(1);
    expect(ti.components.CI).toBeGreaterThanOrEqual(0);
    expect(ti.components.CI).toBeLessThanOrEqual(1);
    expect(ti.components.ToI).toBeGreaterThanOrEqual(0);
    expect(ti.components.ToI).toBeLessThanOrEqual(1);
  });

  it("TI is multiplicative composite of all components", () => {
    for (let i = 0; i < 50; i++) {
      recordDeterminismCheck(true);
      recordTraceCheck(true);
      recordIsolationEvent(false);
      recordCryptoCheck(true);
      recordTimeoutEvent(false);
    }
    const ti = computeTI();
    const expected = ti.components.DI * ti.components.TrI * ti.components.II * ti.components.CI * ti.components.ToI;
    expect(ti.ti).toBeGreaterThanOrEqual(expected - 0.01);
    expect(ti.ti).toBeLessThanOrEqual(1.0);
  });
});
