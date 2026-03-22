"""
argos.py — Tao Gate: Pre-Execution Governance Pipeline
=======================================================

Chain of Responsibility architecture for AI intent governance.
Each Gate evaluates intent BEFORE execution. If any gate blocks,
execution is prevented and a structured escalation payload is returned.

Layers:
  1. ClinicalGate   — placeholder (passes all intent for now)
  2. PrivacyGate    — GDPR Art. 9 / WGBO Art. 7:457 BW check

Only when ALL gates return PASS does the execute() function fire.
"""

from __future__ import annotations
import json
from abc import ABC, abstractmethod
from typing import Any

# ─── Execution counter (audit) ───────────────────────────────────────────────

calls: dict[str, int] = {"execute": 0}


def execute() -> None:
    """Dummy execution function. Increments audit counter."""
    calls["execute"] += 1


# ─── 1. Base Gate Interface ──────────────────────────────────────────────────

class Gate(ABC):
    """
    Abstract base for every governance gate.
    Each gate receives an intent_context dict and returns either:
      - {"status": "PASS"}                → intent may proceed
      - {"status": "<NOT_PASS>", ...}     → intent is blocked; payload = escalation JSON
    """

    @abstractmethod
    def evaluate(self, intent_context: dict[str, Any]) -> dict[str, Any]:
        ...


# ─── 2. ClinicalGate (placeholder — always passes) ──────────────────────────

class ClinicalGate(Gate):
    """
    Placeholder clinical gate.
    In the TypeScript backend this is already fully implemented
    (see server/clinicalGate.ts). Here we keep a pass-through so
    the Python pipeline structure is complete.
    """

    def evaluate(self, intent_context: dict[str, Any]) -> dict[str, Any]:
        return {"status": "PASS"}


# ─── 3. PrivacyGate (GDPR Art. 9 / WGBO) ────────────────────────────────────

class PrivacyGate(Gate):
    """
    Checks whether the AI intent involves sharing medical data
    ('deel_dossier') with parents ('ouders') for a patient >= 16.

    Dutch law:
      - WGBO Art. 7:457 BW: medical secrecy; patient >= 16 decides
        who receives their health data.
      - GDPR Art. 9: processing of special-category data (health)
        requires explicit legal basis.

    If the condition is met the gate returns ESCALATE_HUMAN with
    a structured payload for the DPO (Data Protection Officer).
    """

    def evaluate(self, intent_context: dict[str, Any]) -> dict[str, Any]:
        actie = intent_context.get("actie", "")
        doelwit = intent_context.get("doelwit", "")
        patient_leeftijd = intent_context.get("patient_leeftijd", 0)

        if actie == "deel_dossier" and doelwit == "ouders" and patient_leeftijd >= 16:
            return {
                "status": "ESCALATE_HUMAN",
                "olympia": "GDPR_ART_9_MEDICAL_DATA",
                "layer": "PRIVACY",
                "pressure": "CRITICAL",
                "escalation": "DPO",
                "reason": (
                    "Verstrekking van gezondheidsgegevens vereist "
                    "art. 6 + art. 9 AVG grondslag en toetsing aan "
                    "art. 7:457 BW."
                ),
            }

        return {"status": "PASS"}


# ─── 4. IndiaPrivacyGate (DPDPA 2023) ───────────────────────────────────────

class IndiaPrivacyGate(Gate):
    """
    Checks whether the AI intent violates India's Digital Personal Data
    Protection Act 2023 (DPDPA).

    Rules enforced:
      - DPDPA S.7 : Processing of personal data requires a valid consent
                    signal when no other legal ground applies.  Sharing
                    health/sensitive data without verified consent is blocked.
      - DPDPA S.9 : Processing personal data of a child (< 18 years) requires
                    verifiable parental/guardian consent.

    Intent-context keys consumed:
      actie                    (str)  — e.g. "deel_dossier"
      data_categorie           (str)  — e.g. "gezondheid", "biometrisch",
                                        "financieel"
      toestemming_geverifieerd (bool) — True when valid consent is on record
      patient_leeftijd         (int)  — age of the data subject in years
    """

    _SENSITIVE_CATEGORIES = frozenset({"gezondheid", "biometrisch", "financieel"})

    def evaluate(self, intent_context: dict[str, Any]) -> dict[str, Any]:
        actie = intent_context.get("actie", "")
        data_categorie = intent_context.get("data_categorie", "")
        toestemming_geverifieerd = intent_context.get("toestemming_geverifieerd", False)
        patient_leeftijd = intent_context.get("patient_leeftijd", 18)

        # S.9 — children's data: verifiable parental consent required for < 18.
        if patient_leeftijd < 18 and not toestemming_geverifieerd:
            return {
                "status": "ESCALATE_HUMAN",
                "olympia": "INDIA_DPDPA_S9",
                "layer": "PRIVACY",
                "pressure": "CRITICAL",
                "escalation": "DPO",
                "reason": (
                    "Processing personal data of a child (< 18) requires "
                    "verifiable parental/guardian consent under India's "
                    "Digital Personal Data Protection Act 2023, Section 9."
                ),
            }

        # S.7 — sensitive personal data: explicit consent required.
        if (
            actie in ("deel_dossier", "verwerk_gezondheidsgegevens")
            and data_categorie in self._SENSITIVE_CATEGORIES
            and not toestemming_geverifieerd
        ):
            return {
                "status": "ESCALATE_HUMAN",
                "olympia": "INDIA_DPDPA_S7",
                "layer": "PRIVACY",
                "pressure": "CRITICAL",
                "escalation": "DPO",
                "reason": (
                    "Processing sensitive personal data requires verified "
                    "consent under India's Digital Personal Data Protection "
                    "Act 2023, Section 7."
                ),
            }

        return {"status": "PASS"}


# ─── 5. Pipeline Orchestrator ────────────────────────────────────────────────

class TaoGatePipeline:
    """
    Runs intent through an ordered sequence of Gates.
    Stops at the first non-PASS result and returns the escalation payload.
    Only calls execute() when every gate returns PASS.
    """

    def __init__(self, gates: list[Gate] | None = None) -> None:
        self.gates: list[Gate] = gates or [
            ClinicalGate(),
            PrivacyGate(),
        ]

    def run(self, intent_context: dict[str, Any]) -> dict[str, Any]:
        for gate in self.gates:
            result = gate.evaluate(intent_context)
            if result.get("status") != "PASS":
                return result

        execute()
        return {"status": "PASS"}


# ─── 5. Test Case ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    pipeline = TaoGatePipeline()

    intent_context = {
        "actie": "deel_dossier",
        "doelwit": "ouders",
        "patient_leeftijd": 16,
    }

    print("=" * 60)
    print("Tao Gate — Pre-Execution Governance Pipeline Test")
    print("=" * 60)
    print(f"\nIntent: {json.dumps(intent_context, indent=2)}")

    result = pipeline.run(intent_context)

    print(f"\nResult:\n{json.dumps(result, indent=2, ensure_ascii=False)}")
    print(f"\nExecution counter: calls['execute'] = {calls['execute']}")

    assert calls["execute"] == 0, "FAIL: execute() should NOT have been called"
    assert result["status"] == "ESCALATE_HUMAN", f"FAIL: expected ESCALATE_HUMAN, got {result['status']}"
    assert result["layer"] == "PRIVACY", f"FAIL: expected PRIVACY layer"
    assert result["pressure"] == "CRITICAL", f"FAIL: expected CRITICAL pressure"

    print("\n✓ All assertions passed. Execution was blocked pre-runtime.")
    print("=" * 60)
