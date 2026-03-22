"""
tao_gate/gdpr_bridge.py — Thin GDPR/PrivacyGate bridge for TaoGate.

Translates the existing PrivacyGate result (argos.py) into a canonical
DecisionResult with decision ∈ {STOP, PASS} that the TaoGate supervisor
can consume without depending on HTTP/IO.

The bridge is intentionally thin:
  - It does NOT replace argos.py.
  - It re-exposes its logic as a pure function returning a typed dataclass.
  - A STOP decision must always propagate to Mode.BLOCK in the supervisor.
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from enum import Enum
from typing import Any

# Ensure server/argos.py is importable regardless of working directory.
# Set PYTHONPATH to include the server directory to avoid this manipulation.
_SERVER_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "server"))
if _SERVER_DIR not in sys.path:
    sys.path.insert(0, _SERVER_DIR)

from argos import IndiaPrivacyGate, PrivacyGate  # noqa: E402  (must follow sys.path setup)


class GdprDecision(str, Enum):
    """
    Binary GDPR gate outcome.

    PASS — the intent context is permissible under applicable privacy law.
    STOP — the intent context violates GDPR / WGBO; execution must be blocked.
    """

    PASS = "PASS"
    STOP = "STOP"


@dataclass(frozen=True)
class DecisionResult:
    """
    Structured result returned by the GDPR_PERSONAL_DATA rule.

    Attributes
    ----------
    decision : GdprDecision
        High-level outcome (PASS or STOP).
    escalate : bool
        True when human review is required regardless of decision.
    reason : str
        Human-readable justification.
    scope : str
        Regulatory scope tag (e.g. "GDPR_ART_9", "WGBO_457BW").
    canon_level : str
        Severity/priority level (e.g. "CRITICAL", "HIGH", "INFORMATIONAL").
    """

    decision: GdprDecision
    escalate: bool
    reason: str
    scope: str
    canon_level: str


def gdpr_personal_data_check(intent_context: dict[str, Any]) -> DecisionResult:
    """
    Evaluate *intent_context* against the GDPR_PERSONAL_DATA rule.

    Wraps the existing ``PrivacyGate`` from ``server/argos.py`` and
    normalises its output into a typed :class:`DecisionResult`.

    Parameters
    ----------
    intent_context : dict[str, Any]
        Must contain at least::

            {
                "actie":            str,   # e.g. "deel_dossier"
                "doelwit":          str,   # e.g. "ouders"
                "patient_leeftijd": int,   # age in years
            }

    Returns
    -------
    DecisionResult
        ``decision=STOP`` when GDPR/WGBO requires blocking;
        ``decision=PASS`` otherwise.

    Notes
    -----
    Any unexpected exception raised by :class:`PrivacyGate` is treated
    as a STOP (fail-safe): when the privacy gate cannot be evaluated,
    execution must not proceed.
    """
    try:
        raw: dict[str, Any] = PrivacyGate().evaluate(intent_context)
    except Exception as exc:  # noqa: BLE001
        return DecisionResult(
            decision=GdprDecision.STOP,
            escalate=True,
            reason=f"PrivacyGate evaluation failed unexpectedly: {exc}",
            scope="GDPR_PERSONAL_DATA",
            canon_level="CRITICAL",
        )

    status = raw.get("status", "PASS")

    if status != "PASS":
        return DecisionResult(
            decision=GdprDecision.STOP,
            escalate=True,
            reason=raw.get("reason", "GDPR/WGBO constraint triggered."),
            scope=raw.get("olympia", "GDPR_PERSONAL_DATA"),
            canon_level=raw.get("pressure", "CRITICAL"),
        )

    return DecisionResult(
        decision=GdprDecision.PASS,
        escalate=False,
        reason="No privacy constraint triggered.",
        scope="GDPR_PERSONAL_DATA",
        canon_level="INFORMATIONAL",
    )


def india_pdp_check(intent_context: dict[str, Any]) -> DecisionResult:
    """
    Evaluate *intent_context* against India's Digital Personal Data Protection
    Act 2023 (DPDPA).

    Wraps :class:`IndiaPrivacyGate` from ``server/argos.py`` and normalises
    its output into a typed :class:`DecisionResult`.

    Parameters
    ----------
    intent_context : dict[str, Any]
        Recognised keys::

            {
                "actie":                    str,   # e.g. "deel_dossier"
                "data_categorie":           str,   # e.g. "gezondheid"
                "toestemming_geverifieerd": bool,  # True when consent is on record
                "patient_leeftijd":         int,   # age of the data subject
            }

    Returns
    -------
    DecisionResult
        ``decision=STOP`` when the DPDPA requires blocking;
        ``decision=PASS`` otherwise.

    Notes
    -----
    Any unexpected exception raised by :class:`IndiaPrivacyGate` is treated
    as a STOP (fail-safe): when the gate cannot be evaluated, execution must
    not proceed.
    """
    try:
        raw: dict[str, Any] = IndiaPrivacyGate().evaluate(intent_context)
    except Exception as exc:  # noqa: BLE001
        return DecisionResult(
            decision=GdprDecision.STOP,
            escalate=True,
            reason=f"IndiaPrivacyGate evaluation failed unexpectedly: {exc}",
            scope="INDIA_DPDPA",
            canon_level="CRITICAL",
        )

    status = raw.get("status", "PASS")

    if status != "PASS":
        return DecisionResult(
            decision=GdprDecision.STOP,
            escalate=True,
            reason=raw.get("reason", "India DPDPA constraint triggered."),
            scope=raw.get("olympia", "INDIA_DPDPA"),
            canon_level=raw.get("pressure", "CRITICAL"),
        )

    return DecisionResult(
        decision=GdprDecision.PASS,
        escalate=False,
        reason="No India DPDPA constraint triggered.",
        scope="INDIA_DPDPA",
        canon_level="INFORMATIONAL",
    )
