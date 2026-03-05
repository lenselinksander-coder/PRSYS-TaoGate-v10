// server/trace/phronesis.ts
//
// Phronesis — Capacity Formula
//
// SI = τ × ω
//   τ (tau)   = time units available
//   ω (omega) = attention / capacity coefficient [0..1]
//   SI        = available decision space
//
// If Risk > SI → ESCALATE (capacity overloaded)

export type PhronesisResult = {
  tau: number;        // time units available
  omega: number;      // attention / capacity coefficient
  SI: number;         // available decision space (τ × ω)
  risk: number;       // current risk load to compare against SI
  overloaded: boolean; // true when risk > SI
  decision: "PASS" | "ESCALATE";
  reason: string;
};

/**
 * Evaluate capacity using the Phronesis formula: SI = τ × ω.
 * If the risk load exceeds available SI, the system escalates.
 *
 * @param tau   - Time units available (e.g., session time in minutes, range 0..∞)
 * @param omega - Attention/capacity coefficient [0..1]
 * @param risk  - Current risk load (from Hypatia or caller)
 */
export function phronesisCapacity(tau: number, omega: number, risk: number): PhronesisResult {
  const clampedTau   = Math.max(0, tau);
  const clampedOmega = Math.max(0, Math.min(1, omega));
  const SI = clampedTau * clampedOmega;
  const overloaded = risk > SI;

  const decision: PhronesisResult["decision"] = overloaded ? "ESCALATE" : "PASS";
  const reason = overloaded
    ? `Capaciteit (SI=${SI.toFixed(3)}) overschreden door risico (${risk.toFixed(3)}) — escalatie.`
    : `Capaciteit (SI=${SI.toFixed(3)}) voldoende voor risico (${risk.toFixed(3)}) — doorgelaten.`;

  return {
    tau: clampedTau,
    omega: clampedOmega,
    SI,
    risk,
    overloaded,
    decision,
    reason,
  };
}
