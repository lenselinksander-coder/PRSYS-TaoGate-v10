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
       - D_load > D_cap_eff                            (DYMPHNA / cumulative load)
  2. HOLD  — if V(x) >= V_hold_ratio * V_max (approaching the safety boundary).
  3. INUIT post-filter — if Siku = 0, any PASS result is tightened to HOLD.
     (Supervisory logic may only tighten decisions, never relax them.)
  4. PASS  — all constraints satisfied and V(x) well below V_max.

All functions are pure (no I/O, no global state mutations).
"""

from __future__ import annotations

import math
from typing import Any

from tao_gate.state import GateParams, Mode, State, instability, omega_capacity
from tao_gate.gdpr_bridge import DecisionResult, GdprDecision
from tao_gate.inuit import InuitSignal
from tao_gate.dymphna import DymphnaSignal, dymphna_check


# Default parameter set used when no explicit GateParams are supplied.
_DEFAULT_PARAMS = GateParams()


def tao_gate_decide(
    state: State,
    legitimacy_ok: bool,
    *,
    gdpr_result: DecisionResult | None = None,
    inuit_signal: InuitSignal | None = None,
    dymphna_signal: DymphnaSignal | None = None,
    params: GateParams = _DEFAULT_PARAMS,
) -> Mode:
    """
    Decide the ORFHEUSS operating mode for the given state and signals.

    Parameters
    ----------
    state : State
        Current continuous state vector
        x = (Delta_ext, sigma_ext, omega, tau, TI, D_load, D_cap_eff).
    legitimacy_ok : bool
        True when Cerberus confirms that the agent mandate, time window and
        reversibility requirements are all satisfied.
    gdpr_result : DecisionResult | None
        Result of the GDPR_PERSONAL_DATA check.  If ``None`` the GDPR
        constraint is treated as satisfied (PASS).  A result with
        ``decision == GdprDecision.STOP`` forces Mode.BLOCK unconditionally.
    inuit_signal : InuitSignal | None
        Output of the INUIT · BIOLOGY pre-reflexive context sensor.
        If ``None`` the INUIT constraint is treated as clear (Siku = 1).
        When ``siku == 0``, any Mode.PASS result is tightened to Mode.HOLD.
    dymphna_signal : DymphnaSignal | None
        DYMPHNA cumulative-load sensor output.  If ``None``, the signal is
        derived automatically from ``state.D_load`` and ``state.D_cap_eff``.
        When ``overloaded=True`` (D_l > D_k^e), Mode.BLOCK is forced
        (hard constraint — dysregulation must not proceed).
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
    satisfied constraints.  The INUIT post-filter can only tighten the
    outcome (PASS → HOLD); it never relaxes HOLD or BLOCK.
    """
    # Resolve DYMPHNA signal: auto-derive from state if not provided.
    _dymphna = dymphna_signal if dymphna_signal is not None else dymphna_check(state)

    # ── 1. Hard constraint checks (any failure → BLOCK) ─────────────────────

    # 1a. GDPR / PrivacyGate — STOP overrides everything.
    if gdpr_result is not None and gdpr_result.decision == GdprDecision.STOP:
        return Mode.BLOCK

    # 1b. Cerberus legitimacy (mandate / time / reversibility).
    if not legitimacy_ok:
        return Mode.BLOCK

    # 1c. Barbatos — Delta_ext must stay within the safety envelope.
    #     The maximum permissible |Delta_ext| is sqrt(V_max / alpha).
    #     When alpha == 0, Delta_ext has no weight in V(x), so the bound
    #     is infinite (any value is permissible).
    if params.alpha > 0:
        delta_max = math.sqrt(params.V_max / params.alpha)
        if abs(state.Delta_ext) > delta_max:
            return Mode.BLOCK

    # 1d. O36 — human carrying capacity: omega <= tau - sigma_ext.
    if state.omega > omega_capacity(state):
        return Mode.BLOCK

    # 1e. SI/TI — temporal integrity index must be >= TI_min.
    if state.TI < params.TI_min:
        return Mode.BLOCK

    # 1f. DYMPHNA — cumulative load must not exceed effective capacity.
    #     D_l > D_k^e signals dysregulation; no decision may proceed.
    if _dymphna.overloaded:
        return Mode.BLOCK

    # ── 2. Soft threshold check (V(x) approaching V_max → HOLD) ─────────────

    v = instability(state, params)
    v_hold_threshold = params.V_hold_ratio * params.V_max

    if v >= v_hold_threshold:
        return Mode.HOLD

    # ── 3. INUIT post-filter (Siku = 0 → tighten PASS to HOLD) ─────────────
    #     Applied only when the base decision would be PASS.  A Siku = 0 signal
    #     means there is insufficient relational/cultural carrying capacity;
    #     the system must not enter PASS.  HOLD and BLOCK are unaffected.

    if inuit_signal is not None and inuit_signal.siku == 0:
        return Mode.HOLD

    # ── 4. All clear ─────────────────────────────────────────────────────────

    return Mode.PASS


def explain_decision(
    state: State,
    legitimacy_ok: bool,
    *,
    gdpr_result: DecisionResult | None = None,
    inuit_signal: InuitSignal | None = None,
    dymphna_signal: DymphnaSignal | None = None,
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
    inuit_signal : InuitSignal | None
        INUIT · BIOLOGY context sensor result (optional).
        When ``siku == 0``, any PASS result is tightened to HOLD.
    dymphna_signal : DymphnaSignal | None
        DYMPHNA cumulative-load sensor result (optional).
        When ``overloaded=True``, Mode.BLOCK is forced.
        If ``None``, auto-derived from ``state.D_load`` / ``state.D_cap_eff``.
    params : GateParams
        Tunable coefficients.

    Returns
    -------
    dict[str, Any]
        Keys: ``mode``, ``V``, ``V_max``, ``constraints``, ``inuit``,
        ``dymphna``.
    """
    _dymphna = dymphna_signal if dymphna_signal is not None else dymphna_check(state)

    mode = tao_gate_decide(
        state, legitimacy_ok, gdpr_result=gdpr_result,
        inuit_signal=inuit_signal, dymphna_signal=_dymphna, params=params
    )
    v = instability(state, params)
    delta_max = math.sqrt(params.V_max / params.alpha) if params.alpha > 0 else math.inf
    omega_cap = omega_capacity(state)

    constraints: dict[str, bool] = {
        "gdpr_pass": gdpr_result is None or gdpr_result.decision == GdprDecision.PASS,
        "legitimacy_ok": legitimacy_ok,
        "delta_in_bounds": abs(state.Delta_ext) <= delta_max,
        "omega_in_capacity": state.omega <= omega_cap,
        "ti_sufficient": state.TI >= params.TI_min,
        "dymphna_ok": not _dymphna.overloaded,
    }

    inuit_info: dict[str, Any] = {
        "siku": inuit_signal.siku if inuit_signal is not None else 1,
        "reason": inuit_signal.reason if inuit_signal is not None else "INUIT not evaluated.",
        "source": inuit_signal.source if inuit_signal is not None else "none",
    }

    # D_cap_eff may be float('inf') — represent as null in JSON-safe dict.
    d_cap_eff_value: Any = (
        _dymphna.D_cap_eff if math.isfinite(_dymphna.D_cap_eff) else None
    )
    dymphna_info: dict[str, Any] = {
        "D_load": _dymphna.D_load,
        "D_cap_eff": d_cap_eff_value,
        "overloaded": _dymphna.overloaded,
        "reason": _dymphna.reason,
    }

    return {
        "mode": mode.value,
        "V": round(v, 6),
        "V_max": params.V_max,
        "V_hold_threshold": round(params.V_hold_ratio * params.V_max, 6),
        "constraints": constraints,
        "inuit": inuit_info,
        "dymphna": dymphna_info,
    }
