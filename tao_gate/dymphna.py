"""
tao_gate/dymphna.py — DYMPHNA cumulative-load and damage sensor.

DYMPHNA tracks the long-term accumulation of load on the human decision system
(or organisation) and signals when effective capacity is exceeded.  It
complements SI/O36, which govern *momentary* load, by enforcing an axiom over
*cumulative* load.

DYMPHNA axioms
--------------
    D_l(t) = Σ (load_i × duration_i)   — cumulative load over time
    D_l > D_k^e  ⇒  dysregulation / potential damage

When dysregulation is active the governance kernel must not issue a PASS
decision: the system is in a fragile state where further load could cause
irreversible damage.

Governance constraint enforced by TaoGate
------------------------------------------
    state.D_load > state.D_cap_eff  ⟹  Mode.BLOCK

This is a *hard* constraint, analogous to O36's omega > omega_capacity.
DYMPHNA cannot be overridden by code; only a human remediation step that
reduces D_load or raises D_cap_eff can restore PASS eligibility.

INUIT (Siku) vs DYMPHNA
------------------------
    INUIT   — pre-reflexive *context* sensor; Siku=0 tightens PASS → HOLD.
    DYMPHNA — cumulative *load/damage* sensor; overload forces BLOCK.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from tao_gate.state import State


@dataclass(frozen=True)
class DymphnaSignal:
    """
    Typed output of the DYMPHNA cumulative-load sensor.

    Attributes
    ----------
    D_load : float
        Observed cumulative load D_l at evaluation time.
    D_cap_eff : float
        Effective capacity D_k^e at evaluation time.
    overloaded : bool
        True when D_load > D_cap_eff (dysregulation condition).
    reason : str
        Human-readable explanation of the signal.
    """

    D_load: float
    D_cap_eff: float
    overloaded: bool
    reason: str

    def __post_init__(self) -> None:
        if self.D_load < 0:
            raise ValueError(
                f"D_load must be >= 0, got {self.D_load!r}. "
                "Cumulative load cannot be negative."
            )
        if self.D_cap_eff < 0:
            raise ValueError(
                f"D_cap_eff must be >= 0, got {self.D_cap_eff!r}. "
                "Effective capacity cannot be negative."
            )
        # Verify that overloaded is consistent with D_load / D_cap_eff.
        expected = self.D_load > self.D_cap_eff
        if self.overloaded != expected:
            raise ValueError(
                f"overloaded={self.overloaded!r} is inconsistent with "
                f"D_load={self.D_load!r} and D_cap_eff={self.D_cap_eff!r}. "
                f"Expected overloaded={expected!r}."
            )


def dymphna_check(state: "State") -> DymphnaSignal:
    """
    Derive a :class:`DymphnaSignal` from the current state vector.

    Parameters
    ----------
    state : State
        Must expose ``D_load`` and ``D_cap_eff`` fields.

    Returns
    -------
    DymphnaSignal
        ``overloaded=True`` when ``state.D_load > state.D_cap_eff``;
        ``overloaded=False`` otherwise.
    """
    overloaded = state.D_load > state.D_cap_eff

    if overloaded:
        excess = state.D_load - state.D_cap_eff
        reason = (
            f"DYMPHNA: cumulative load D_l={state.D_load!r} exceeds "
            f"effective capacity D_k^e={state.D_cap_eff!r} "
            f"(excess={excess:.4g}). Dysregulation condition active — "
            "BLOCK required."
        )
    else:
        margin = (
            state.D_cap_eff - state.D_load
            if math.isfinite(state.D_cap_eff)
            else float("inf")
        )
        reason = (
            f"DYMPHNA: cumulative load D_l={state.D_load!r} within "
            f"effective capacity D_k^e="
            + (f"{state.D_cap_eff!r}" if math.isfinite(state.D_cap_eff) else "∞")
            + f" (margin={margin:.4g}). No dysregulation."
        )

    return DymphnaSignal(
        D_load=state.D_load,
        D_cap_eff=state.D_cap_eff,
        overloaded=overloaded,
        reason=reason,
    )
