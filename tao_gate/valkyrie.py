"""
tao_gate/valkyrie.py — Valkyrie Layer: User Exposure Guards.

The Valkyries form a protective layer between the governance kernel
(ORFHEUSS + TaoGate + INUIT + DYMPHNA) and actual user exposure.

Even when the Hybrid Dynamical System (HDS) is in mode PASS, user-facing
exposure is still gated by two Valkyrie checks:

    Valkyrie INUIT
        Field access & timing protection.
        Decides whether, when, and under which conditions a sanctioned
        outcome may enter a human field at all.

    Valkyrie UX
        Landing, protection & access.
        Ensures that what is ethically mandated actually lands without
        manipulation, overloading, or harmful timing (no dark patterns,
        no dopamine-trigger A/B testing, no coercive UX).

System rule (user exposure)
---------------------------
Let:
    Mode     ∈ {PASS, HOLD, BLOCK}  — current TaoGate/HDS mode.
    V_INUIT  ∈ {OK, FAIL}           — Valkyrie INUIT check.
    V_UX     ∈ {OK, FAIL}           — Valkyrie UX check.

User-facing exposure is only allowed if:

    Mode = PASS  ∧  V_INUIT = OK  ∧  V_UX = OK

Operationally:
    If Mode = PASS and any Valkyrie check fails:
        Effective result → HOLD (no deployment / no display).
    If Mode ∈ {HOLD, BLOCK}: result is unchanged (Valkyries cannot relax).

This makes the Valkyrie layer an explicit "user exposure firewall":
the governance kernel decides what may exist and be executed,
the Valkyries decide whether and how it may actually touch humans.

All functions are pure (no I/O, no global state mutations).
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any

from tao_gate.state import Mode


class ValkyrieStatus(str, Enum):
    """
    Binary outcome of a single Valkyrie check.

    OK   — the check passes; this Valkyrie does not block user exposure.
    FAIL — the check fails; user exposure must be withheld.
    """

    OK = "OK"
    FAIL = "FAIL"


@dataclass(frozen=True)
class ValkyrieSignal:
    """
    Typed output of a Valkyrie check.

    Attributes
    ----------
    status : ValkyrieStatus
        OK if the Valkyrie clears user exposure; FAIL if it blocks it.
    reason : str
        Human-readable explanation of the status.
    source : str
        Identifier of the sub-check or heuristic that produced the signal.
    """

    status: ValkyrieStatus
    reason: str
    source: str


def valkyrie_inuit_check(context: dict[str, Any]) -> ValkyrieSignal:
    """
    Valkyrie INUIT — field access & timing protection.

    Decides whether, when, and under which conditions a sanctioned outcome
    may enter a human field at all.  Evaluates field-readiness and timing
    safety before any user exposure is permitted.

    Recognised context keys
    -----------------------
    ``field_access_ok`` : bool
        False when the target field or domain is not in a state to safely
        receive the outcome (e.g. the recipient is in crisis, the channel
        is compromised, or consent has not been established).
    ``timing_ok`` : bool
        False when the timing is inappropriate for exposure (e.g. acute
        stress window, night-time delivery of high-stakes content, or a
        mandated cooling-off period is active).

    Parameters
    ----------
    context : dict[str, Any]
        Sensor context dict.  Unknown keys are ignored.

    Returns
    -------
    ValkyrieSignal
        ``status=FAIL`` if any condition fails; ``status=OK`` otherwise.
    """
    if not context.get("field_access_ok", True):
        return ValkyrieSignal(
            status=ValkyrieStatus.FAIL,
            reason=(
                "Valkyrie INUIT: field access is not cleared. "
                "The target field cannot safely receive this outcome."
            ),
            source="field_access",
        )

    if not context.get("timing_ok", True):
        return ValkyrieSignal(
            status=ValkyrieStatus.FAIL,
            reason=(
                "Valkyrie INUIT: timing protection active. "
                "Exposure at this moment is not sanctioned."
            ),
            source="timing",
        )

    return ValkyrieSignal(
        status=ValkyrieStatus.OK,
        reason=(
            "Valkyrie INUIT: field access and timing checks clear. "
            "Outcome may enter the human field."
        ),
        source="all_clear",
    )


def valkyrie_ux_check(context: dict[str, Any]) -> ValkyrieSignal:
    """
    Valkyrie UX — landing, protection & access.

    Ensures that what is ethically mandated actually lands without
    manipulation, overloading, or harmful timing.  Specifically guards
    against dark patterns, dopamine-trigger A/B testing, and coercive UX.

    Recognised context keys
    -----------------------
    ``dark_patterns_absent`` : bool
        False when the UX delivery contains dark patterns (e.g. hidden
        unsubscribe, misdirection, trick questions, roach motel).
    ``ab_testing_safe`` : bool
        False when the delivery variant uses dopamine-trigger A/B testing
        or other manipulative optimisation that exploits psychological
        vulnerabilities.
    ``no_coercion`` : bool
        False when the UX applies coercive pressure (e.g. countdown
        timers, artificial scarcity, threats, guilt-tripping copy).

    Parameters
    ----------
    context : dict[str, Any]
        Sensor context dict.  Unknown keys are ignored.

    Returns
    -------
    ValkyrieSignal
        ``status=FAIL`` if any condition fails; ``status=OK`` otherwise.
    """
    if not context.get("dark_patterns_absent", True):
        return ValkyrieSignal(
            status=ValkyrieStatus.FAIL,
            reason=(
                "Valkyrie UX: dark patterns detected in UX delivery. "
                "Exposure withheld to protect user autonomy."
            ),
            source="dark_patterns",
        )

    if not context.get("ab_testing_safe", True):
        return ValkyrieSignal(
            status=ValkyrieStatus.FAIL,
            reason=(
                "Valkyrie UX: dopamine-trigger A/B testing variant detected. "
                "Exposure withheld — manipulative optimisation is not permitted."
            ),
            source="ab_testing",
        )

    if not context.get("no_coercion", True):
        return ValkyrieSignal(
            status=ValkyrieStatus.FAIL,
            reason=(
                "Valkyrie UX: coercive UX patterns detected. "
                "Exposure withheld to prevent harmful pressure on the user."
            ),
            source="coercion",
        )

    return ValkyrieSignal(
        status=ValkyrieStatus.OK,
        reason=(
            "Valkyrie UX: no dark patterns, A/B manipulation, or coercion detected. "
            "Outcome may be presented to the user."
        ),
        source="all_clear",
    )


def user_exposure_check(
    mode: Mode,
    v_inuit: ValkyrieSignal,
    v_ux: ValkyrieSignal,
) -> Mode:
    """
    Apply the Valkyrie user-exposure firewall.

    Combines the governance kernel's HDS mode with both Valkyrie check
    results to determine the effective mode for user-facing exposure.

    Rule
    ----
        Exposure allowed  ⟺  mode = PASS  ∧  v_inuit = OK  ∧  v_ux = OK

    If ``mode`` is HOLD or BLOCK the result is returned unchanged — the
    Valkyries can only *tighten* a PASS; they never relax HOLD or BLOCK.

    If ``mode`` is PASS but any Valkyrie check returns FAIL the effective
    result is Mode.HOLD (boundary hold — no deployment / no display).

    Parameters
    ----------
    mode : Mode
        Current TaoGate / HDS mode (PASS, HOLD, or BLOCK).
    v_inuit : ValkyrieSignal
        Result of the Valkyrie INUIT field-access & timing check.
    v_ux : ValkyrieSignal
        Result of the Valkyrie UX ethics check.

    Returns
    -------
    Mode
        Effective mode for user-facing exposure.  Never None.

    Notes
    -----
    Like the INUIT Siku post-filter inside ``tao_gate_decide``, this
    function is *monotone-safe*: it can only tighten PASS → HOLD.
    HOLD and BLOCK are never relaxed.
    """
    # Non-PASS modes pass through unchanged — Valkyries cannot relax them.
    if mode is not Mode.PASS:
        return mode

    # Mode is PASS: both Valkyries must clear for exposure to proceed.
    if v_inuit.status is ValkyrieStatus.FAIL or v_ux.status is ValkyrieStatus.FAIL:
        return Mode.HOLD

    return Mode.PASS
