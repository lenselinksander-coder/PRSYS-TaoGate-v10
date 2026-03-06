"""
tao_gate/__main__.py — Runnable test scenarios for the governance kernel.

Execute with:
    python -m tao_gate

Covers:
  - Scenario A : PASS   — healthy state, full legitimacy, GDPR ok.
  - Scenario B : HOLD   — instability approaching V_max threshold.
  - Scenario C : BLOCK  — legitimacy revoked.
  - Scenario D : BLOCK  — TI below minimum.
  - Scenario E : BLOCK  — omega exceeds carrying capacity.
  - Scenario F : BLOCK  — GDPR returns STOP (overrides legitimacy=True).
  - Scenario G : BLOCK  — GDPR STOP even when state is otherwise healthy.
  - Scenario H : HOLD   — INUIT Siku=0 tightens PASS to HOLD.
  - Scenario I : PASS   — INUIT Siku=1 (sufficient capacity); PASS allowed.
  - Scenario J : BLOCK  — INUIT Siku=0 does NOT relax BLOCK to HOLD.
  - Scenario K : BLOCK  — DYMPHNA overload (D_l > D_k^e) forces BLOCK.
  - Scenario L : PASS   — DYMPHNA within capacity; PASS allowed.

  Valkyrie user-exposure firewall:
  - Scenario M : PASS   — HDS=PASS, both Valkyries clear → user sees PASS.
  - Scenario N : HOLD   — HDS=PASS, Valkyrie UX blocks dark patterns → user sees HOLD.
  - Scenario O : BLOCK  — HDS=BLOCK (TI), Valkyries both clear → user still sees BLOCK.
"""

from __future__ import annotations

import json
import sys

from tao_gate.gdpr_bridge import DecisionResult, GdprDecision, gdpr_personal_data_check
from tao_gate.inuit import InuitSignal, inuit_context_check
from tao_gate.dymphna import dymphna_check
from tao_gate.state import GateParams, Mode, State
from tao_gate.supervisor import explain_decision, tao_gate_decide
from tao_gate.valkyrie import (
    valkyrie_inuit_check,
    valkyrie_ux_check,
    user_exposure_check,
)

# ── Shared parameters ────────────────────────────────────────────────────────

PARAMS = GateParams(
    alpha=1.0,
    beta=1.0,
    gamma=1.0,
    V_max=10.0,
    V_hold_ratio=0.75,  # HOLD threshold at V = 7.5
    TI_min=0.5,
)

_GDPR_PASS = DecisionResult(
    decision=GdprDecision.PASS,
    escalate=False,
    reason="No privacy constraint triggered.",
    scope="GDPR_PERSONAL_DATA",
    canon_level="INFORMATIONAL",
)

_GDPR_STOP = DecisionResult(
    decision=GdprDecision.STOP,
    escalate=True,
    reason="Verstrekking van gezondheidsgegevens vereist art. 6 + art. 9 AVG grondslag.",
    scope="GDPR_ART_9_MEDICAL_DATA",
    canon_level="CRITICAL",
)


# ── Helper ───────────────────────────────────────────────────────────────────

def _run(
    label: str,
    state: State,
    legitimacy_ok: bool,
    gdpr_result: DecisionResult,
    expected: Mode,
    inuit_signal: InuitSignal | None = None,
    dymphna_signal=None,
) -> None:
    result = explain_decision(
        state, legitimacy_ok, gdpr_result=gdpr_result,
        inuit_signal=inuit_signal, dymphna_signal=dymphna_signal, params=PARAMS
    )
    mode = Mode(result["mode"])
    status = "✓" if mode == expected else "✗"
    print(f"\n{status} {label}")
    print(f"  Expected : {expected.value}")
    print(f"  Got      : {mode.value}")
    print(f"  Detail   : {json.dumps(result, indent=4)}")
    if mode != expected:
        print(f"  ASSERTION FAILED: expected {expected.value}, got {mode.value}",
              file=sys.stderr)
        sys.exit(1)


def _run_valkyrie(
    label: str,
    hds_mode: Mode,
    inuit_ctx: dict,
    ux_ctx: dict,
    expected: Mode,
) -> None:
    """Run a Valkyrie user-exposure scenario and print the result."""
    v_inuit = valkyrie_inuit_check(inuit_ctx)
    v_ux = valkyrie_ux_check(ux_ctx)
    effective = user_exposure_check(hds_mode, v_inuit, v_ux)
    status = "✓" if effective == expected else "✗"
    print(f"\n{status} {label}")
    print(f"  HDS mode      : {hds_mode.value}")
    print(f"  V_INUIT       : {v_inuit.status.value} ({v_inuit.source})")
    print(f"  V_UX          : {v_ux.status.value} ({v_ux.source})")
    print(f"  Expected      : {expected.value}")
    print(f"  Effective mode: {effective.value}")
    if effective != expected:
        print(f"  ASSERTION FAILED: expected {expected.value}, got {effective.value}",
              file=sys.stderr)
        sys.exit(1)


# ── Scenarios ────────────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 65)
    print("TaoGate — ORFHEUSS Governance Kernel · Test Scenarios")
    print("=" * 65)

    # A — PASS: all good
    _run(
        "Scenario A · PASS (healthy state)",
        State(Delta_ext=1.0, sigma_ext=0.5, omega=0.5, tau=2.0, TI=0.9),
        legitimacy_ok=True,
        gdpr_result=_GDPR_PASS,
        expected=Mode.PASS,
    )

    # B — HOLD: V approaches V_max (V = 1² + 1² + 2² = 6 < 7.5, adjust to cross)
    # V = 1² + 1² + 2.8² = 1 + 1 + 7.84 = 9.84  → above hold threshold 7.5
    _run(
        "Scenario B · HOLD (instability near V_max)",
        State(Delta_ext=1.0, sigma_ext=1.0, omega=2.8, tau=10.0, TI=0.9),
        legitimacy_ok=True,
        gdpr_result=_GDPR_PASS,
        expected=Mode.HOLD,
    )

    # C — BLOCK: legitimacy revoked
    _run(
        "Scenario C · BLOCK (legitimacy revoked)",
        State(Delta_ext=0.5, sigma_ext=0.1, omega=0.2, tau=1.0, TI=0.8),
        legitimacy_ok=False,
        gdpr_result=_GDPR_PASS,
        expected=Mode.BLOCK,
    )

    # D — BLOCK: TI below TI_min
    _run(
        "Scenario D · BLOCK (TI below minimum)",
        State(Delta_ext=0.5, sigma_ext=0.1, omega=0.2, tau=1.0, TI=0.3),
        legitimacy_ok=True,
        gdpr_result=_GDPR_PASS,
        expected=Mode.BLOCK,
    )

    # E — BLOCK: omega exceeds carrying capacity (omega=3 > tau(2) - sigma_ext(0.5) = 1.5)
    _run(
        "Scenario E · BLOCK (omega exceeds O36 carrying capacity)",
        State(Delta_ext=0.5, sigma_ext=0.5, omega=3.0, tau=2.0, TI=0.8),
        legitimacy_ok=True,
        gdpr_result=_GDPR_PASS,
        expected=Mode.BLOCK,
    )

    # F — BLOCK: GDPR STOP overrides legitimacy=True and healthy state
    _run(
        "Scenario F · BLOCK (GDPR STOP overrides healthy state)",
        State(Delta_ext=0.5, sigma_ext=0.1, omega=0.2, tau=1.0, TI=0.8),
        legitimacy_ok=True,
        gdpr_result=_GDPR_STOP,
        expected=Mode.BLOCK,
    )

    # G — BLOCK: live GDPR check via argos.PrivacyGate (patient >= 16, dossier → ouders)
    live_gdpr = gdpr_personal_data_check({
        "actie": "deel_dossier",
        "doelwit": "ouders",
        "patient_leeftijd": 16,
    })
    _run(
        "Scenario G · BLOCK (live GDPR check: dossier → ouders, patient 16)",
        State(Delta_ext=0.0, sigma_ext=0.0, omega=0.0, tau=5.0, TI=1.0),
        legitimacy_ok=True,
        gdpr_result=live_gdpr,
        expected=Mode.BLOCK,
    )

    # H — HOLD: INUIT Siku=0 tightens PASS to HOLD (relational capacity insufficient)
    _run(
        "Scenario H · HOLD (INUIT Siku=0 tightens healthy PASS to HOLD)",
        State(Delta_ext=1.0, sigma_ext=0.5, omega=0.5, tau=2.0, TI=0.9),
        legitimacy_ok=True,
        gdpr_result=_GDPR_PASS,
        expected=Mode.HOLD,
        inuit_signal=inuit_context_check({"relational_capacity_ok": False}),
    )

    # I — PASS: INUIT Siku=1 (sufficient capacity); normal PASS allowed
    _run(
        "Scenario I · PASS (INUIT Siku=1: sufficient capacity, normal logic)",
        State(Delta_ext=1.0, sigma_ext=0.5, omega=0.5, tau=2.0, TI=0.9),
        legitimacy_ok=True,
        gdpr_result=_GDPR_PASS,
        expected=Mode.PASS,
        inuit_signal=inuit_context_check({"siku": 1}),
    )

    # J — BLOCK: INUIT Siku=0 does NOT relax a hard-constraint BLOCK to HOLD
    _run(
        "Scenario J · BLOCK (INUIT Siku=0 does not relax TI-BLOCK to HOLD)",
        State(Delta_ext=0.5, sigma_ext=0.1, omega=0.2, tau=1.0, TI=0.3),
        legitimacy_ok=True,
        gdpr_result=_GDPR_PASS,
        expected=Mode.BLOCK,
        inuit_signal=inuit_context_check({"biology_signal_ok": False}),
    )

    # K — BLOCK: DYMPHNA overload forces BLOCK (D_load=12 > D_cap_eff=10)
    _run(
        "Scenario K · BLOCK (DYMPHNA overload: D_l=12 > D_k^e=10)",
        State(Delta_ext=1.0, sigma_ext=0.5, omega=0.5, tau=2.0, TI=0.9,
              D_load=12.0, D_cap_eff=10.0),
        legitimacy_ok=True,
        gdpr_result=_GDPR_PASS,
        expected=Mode.BLOCK,
    )

    # L — PASS: DYMPHNA within capacity (D_load=5 <= D_cap_eff=10); PASS allowed
    _run(
        "Scenario L · PASS (DYMPHNA within capacity: D_l=5 <= D_k^e=10)",
        State(Delta_ext=1.0, sigma_ext=0.5, omega=0.5, tau=2.0, TI=0.9,
              D_load=5.0, D_cap_eff=10.0),
        legitimacy_ok=True,
        gdpr_result=_GDPR_PASS,
        expected=Mode.PASS,
    )

    # ── Valkyrie user-exposure firewall ──────────────────────────────────────

    # M — PASS: HDS=PASS, both Valkyries clear → user sees PASS
    _run_valkyrie(
        "Scenario M · PASS (HDS=PASS, both Valkyries clear → user sees PASS)",
        hds_mode=Mode.PASS,
        inuit_ctx={},                    # field_access_ok and timing_ok default True
        ux_ctx={},                       # dark_patterns_absent, ab_testing_safe, no_coercion default True
        expected=Mode.PASS,
    )

    # N — HOLD: HDS=PASS, Valkyrie UX blocks dark patterns → user sees HOLD
    _run_valkyrie(
        "Scenario N · HOLD (HDS=PASS, Valkyrie UX blocks dark patterns → user sees HOLD)",
        hds_mode=Mode.PASS,
        inuit_ctx={},
        ux_ctx={"dark_patterns_absent": False},
        expected=Mode.HOLD,
    )

    # O — BLOCK: HDS=BLOCK (TI failure), both Valkyries clear → user still sees BLOCK
    _run_valkyrie(
        "Scenario O · BLOCK (HDS=BLOCK via TI, Valkyries clear → user sees BLOCK)",
        hds_mode=Mode.BLOCK,
        inuit_ctx={},
        ux_ctx={},
        expected=Mode.BLOCK,
    )

    print("\n" + "=" * 65)
    print("✓ All scenarios passed.")
    print("=" * 65)


if __name__ == "__main__":
    main()
