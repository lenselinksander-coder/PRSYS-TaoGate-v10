"""
tao_gate/supervisor.py — TaoGate supervisory controller for ORFHEUSS.

Implements the pure function ``tao_gate_decide`` that maps a continuous
state vector and external signals to a discrete Mode (PASS / HOLD / BLOCK).

Decision logic (in priority order):
  1. BLOCK — if any hard constraint fails:
       - legitimacy_ok is False                        (Cerberus)
       - GDPR check returns STOP                       (PrivacyGate)
       - |Delta_ext| > sqrt(V_max / alpha)             (Barbatos)
       - omega > tau - sigma_ext                       (O36 / carrying capacity)
       - TI < TI_min                                   (SI/TI temporal stability)
  2. HOLD  — if V(x) >= V_hold_ratio * V_max (approaching the safety boundary).
  3. PASS  — all constraints satisfied and V(x) well below V_max.

All functions are pure (no I/O, no global state mutations).
"""

from __future__ import annotations

import math
from typing import Any

from tao_gate.state import GateParams, Mode, State, instability, omega_capacity
from tao_gate.gdpr_bridge import DecisionResult, GdprDecision


# Default parameter set used when no explicit GateParams are supplied.
_DEFAULT_PARAMS = GateParams()


def tao_gate_decide(
    state: State,
    legitimacy_ok: bool,
    *,
    gdpr_result: DecisionResult | None = None,
    params: GateParams = _DEFAULT_PARAMS,
) -> Mode:
    """
    Decide the ORFHEUSS operating mode for the given state and signals.

    Parameters
    ----------
    state : State
        Current continuous state vector x = (Delta_ext, sigma_ext, omega, tau, TI).
    legitimacy_ok : bool
        True when Cerberus confirms that the agent mandate, time window and
        reversibility requirements are all satisfied.
    gdpr_result : DecisionResult | None
        Result of the GDPR_PERSONAL_DATA check.  If ``None`` the GDPR
        constraint is treated as satisfied (PASS).  A result with
        ``decision == GdprDecision.STOP`` forces Mode.BLOCK unconditionally.
    params : GateParams
        Tunable coefficients (alpha, beta, gamma, V_max, TI_min …).
        Defaults to :data:`_DEFAULT_PARAMS`.

    Returns
    -------
    Mode
        PASS, HOLD, or BLOCK — never None.

    Notes
    -----
    The function is *monotone-safe*: if it returns BLOCK for a state, it
    will also return BLOCK for any state with higher instability or fewer
    satisfied constraints.
    """
    # ── 1. Hard constraint checks (any failure → BLOCK) ─────────────────────

    # 1a. GDPR / PrivacyGate — STOP overrides everything.
    if gdpr_result is not None and gdpr_result.decision == GdprDecision.STOP:
        return Mode.BLOCK

    # 1b. Cerberus legitimacy (mandate / time / reversibility).
    if not legitimacy_ok:
        return Mode.BLOCK

    # 1c. Barbatos — Delta_ext must stay within the safety envelope.
    #     The maximum permissible |Delta_ext| is sqrt(V_max / alpha).
    delta_max = math.sqrt(params.V_max / params.alpha)
    if abs(state.Delta_ext) > delta_max:
        return Mode.BLOCK

    # 1d. O36 — human carrying capacity: omega <= tau - sigma_ext.
    if state.omega > omega_capacity(state):
        return Mode.BLOCK

    # 1e. SI/TI — temporal integrity index must be >= TI_min.
    if state.TI < params.TI_min:
        return Mode.BLOCK

    # ── 2. Soft threshold check (V(x) approaching V_max → HOLD) ─────────────

    v = instability(state, params)
    v_hold_threshold = params.V_hold_ratio * params.V_max

    if v >= v_hold_threshold:
        return Mode.HOLD

    # ── 3. All clear ─────────────────────────────────────────────────────────

    return Mode.PASS


def explain_decision(
    state: State,
    legitimacy_ok: bool,
    *,
    gdpr_result: DecisionResult | None = None,
    params: GateParams = _DEFAULT_PARAMS,
) -> dict[str, Any]:
    """
    Return the decision *and* a human-readable explanation dict.

    Useful for audit trails and TRST/TGR integration.

    Parameters
    ----------
    state : State
        Current continuous state vector.
    legitimacy_ok : bool
        Cerberus legitimacy signal.
    gdpr_result : DecisionResult | None
        GDPR gate result (optional).
    params : GateParams
        Tunable coefficients.

    Returns
    -------
    dict[str, Any]
        Keys: ``mode``, ``V``, ``V_max``, ``constraints``.
    """
    mode = tao_gate_decide(
        state, legitimacy_ok, gdpr_result=gdpr_result, params=params
    )
    v = instability(state, params)
    delta_max = math.sqrt(params.V_max / params.alpha)
    omega_cap = omega_capacity(state)

    constraints: dict[str, bool] = {
        "gdpr_pass": gdpr_result is None or gdpr_result.decision == GdprDecision.PASS,
        "legitimacy_ok": legitimacy_ok,
        "delta_in_bounds": abs(state.Delta_ext) <= delta_max,
        "omega_in_capacity": state.omega <= omega_cap,
        "ti_sufficient": state.TI >= params.TI_min,
    }

    return {
        "mode": mode.value,
        "V": round(v, 6),
        "V_max": params.V_max,
        "V_hold_threshold": round(params.V_hold_ratio * params.V_max, 6),
        "constraints": constraints,
    }
