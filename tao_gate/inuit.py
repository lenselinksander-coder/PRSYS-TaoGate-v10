"""
tao_gate/inuit.py — INUIT · BIOLOGY pre-reflexive context sensor.

INUIT is the pre-reflexive layer that signals whether there is sufficient
relational and cultural carrying capacity for *any* decision to proceed.
It operates before TaoGate's primary decision logic and can only *tighten*
the outcome, never relax it.

The sensor output is a binary signal called **Siku** (from the Inuktitut word
for sea ice — a metaphor for contextual stability):

    Siku = 0  —  insufficient relational/cultural carrying capacity;
                  no decision may be PASS (only HOLD or BLOCK).
    Siku = 1  —  sufficient carrying capacity; normal TaoGate logic applies.

The :func:`inuit_context_check` function is the canonical way to obtain the
Siku value from an arbitrary context dict.  It is intentionally simple and
pure so that callers can inject any context-sensing logic by overriding the
dict values.

Governance axioms enforced here:
  A1. Siku ∈ {0, 1} — no fractional or undefined values.
  A2. If Siku = 0, the supervisor MUST NOT emit Mode.PASS.
  A3. A Siku = 0 signal may only be overridden by a human (not by code).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


# Literal type alias for documentation clarity.
Siku = int  # 0 or 1


@dataclass(frozen=True)
class InuitSignal:
    """
    Typed output of the INUIT · BIOLOGY context sensor.

    Attributes
    ----------
    siku : int
        Binary carrying-capacity signal: 0 = insufficient, 1 = sufficient.
    reason : str
        Human-readable explanation of why Siku has this value.
    source : str
        Identifier of the sub-sensor or heuristic that produced the signal.
    """

    siku: Siku
    reason: str
    source: str

    def __post_init__(self) -> None:
        if self.siku not in (0, 1):
            raise ValueError(
                f"Siku must be 0 or 1, got {self.siku!r}. "
                "Fractional or undefined values violate INUIT Axiom A1."
            )


def inuit_context_check(context: dict[str, Any]) -> InuitSignal:
    """
    Evaluate relational/cultural carrying capacity from *context*.

    The function checks a set of canonical keys in *context*.  Any key
    that signals an insufficient condition sets Siku = 0.  If none of the
    hard conditions are triggered, Siku = 1 (sufficient).

    Recognised context keys
    -----------------------
    ``siku`` : int (0 or 1)
        Direct override — caller explicitly sets the Siku value.
        Useful for testing and for human-in-the-loop overrides.
    ``relational_capacity_ok`` : bool
        False when the relational/social network is too stressed to absorb
        a PASS decision (e.g. active conflict, bereavement, acute crisis).
    ``cultural_context_ok`` : bool
        False when cultural protocols forbid proceeding (e.g. ceremonial
        period, indigenous governance moratorium).
    ``biology_signal_ok`` : bool
        False when a biological/physiological indicator (e.g. high stress
        hormone level, fatigue index) signals the human actor cannot give
        meaningful consent or carry the load of the decision.

    Parameters
    ----------
    context : dict[str, Any]
        Sensor context dict.  Unknown keys are ignored.

    Returns
    -------
    InuitSignal
        ``siku=0`` if any hard condition fails; ``siku=1`` otherwise.
    """
    # Direct override — highest priority.
    if "siku" in context:
        raw = context["siku"]
        if raw not in (0, 1):
            raise ValueError(
                f"Context key 'siku' must be 0 or 1, got {raw!r}. "
                "INUIT Axiom A1 forbids fractional or undefined values."
            )
        reason = (
            "Siku set directly via context override."
            if raw == 1
            else "Siku forced to 0 via context override — carrying capacity insufficient."
        )
        return InuitSignal(siku=raw, reason=reason, source="context_override")

    # Sub-sensor: relational capacity.
    if not context.get("relational_capacity_ok", True):
        return InuitSignal(
            siku=0,
            reason=(
                "Relational carrying capacity is insufficient. "
                "The social/relational network cannot safely absorb a PASS decision."
            ),
            source="relational_capacity",
        )

    # Sub-sensor: cultural context.
    if not context.get("cultural_context_ok", True):
        return InuitSignal(
            siku=0,
            reason=(
                "Cultural carrying capacity is insufficient. "
                "Active cultural protocol or governance moratorium prevents PASS."
            ),
            source="cultural_context",
        )

    # Sub-sensor: biology signal.
    if not context.get("biology_signal_ok", True):
        return InuitSignal(
            siku=0,
            reason=(
                "Biology signal indicates insufficient carrying capacity. "
                "The human actor cannot safely carry the load of this decision."
            ),
            source="biology_signal",
        )

    # All sub-sensors clear.
    return InuitSignal(
        siku=1,
        reason="All INUIT sub-sensors clear. Sufficient carrying capacity for PASS.",
        source="all_clear",
    )
