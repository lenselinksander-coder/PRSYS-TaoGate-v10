"""
tao_gate/demo.py — TaoGate Governance Kernel Quick Demo.

Laat in < 5 minuten zien hoe de governance-kernel werkt:
zelfdiagnose, HDS + Valkyries, en beslisprioriteit.

Stappen
-------
  1. Systeemcheck     — zelfdiagnostiek van alle governance-lagen.
  2. HDS + Valkyries  — PASS / HOLD / BLOCK met de Valkyrie user-exposure firewall.
  3. Beslisprioriteit — hoe de kernel beslisvolgorde afdwingt.

Uitvoeren met:
    python -m tao_gate.demo
"""

from __future__ import annotations

import sys

from tao_gate.gdpr_bridge import DecisionResult, GdprDecision
from tao_gate.inuit import InuitSignal
from tao_gate.state import GateParams, Mode, State, instability
from tao_gate.supervisor import tao_gate_decide
from tao_gate.system_check import run_system_check
from tao_gate.valkyrie import (
    user_exposure_check,
    valkyrie_inuit_check,
    valkyrie_ux_check,
)

# ── Shared fixtures ───────────────────────────────────────────────────────────

_PARAMS = GateParams()

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
    reason="Gezondheidsgegevens vereisen art. 9 AVG-grondslag — STOP.",
    scope="GDPR_ART_9",
    canon_level="CRITICAL",
)

_W = 70  # console width


# ── Helpers ───────────────────────────────────────────────────────────────────

def _print_section_header(title: str) -> None:
    print()
    print("=" * _W)
    print(title)
    print("=" * _W)


def _print_subsection_header(title: str) -> None:
    print()
    print(f"  ── {title}")


def _show(label: str, mode: Mode, expected: Mode) -> None:
    """Print a scenario line; exit with code 1 if the result is unexpected."""
    icon = "✓" if mode is expected else "✗"
    print(f"  {icon}  {label}")
    print(f"       → {mode.value}")
    if mode is not expected:
        print(
            f"  ASSERTION FAILED: expected {expected.value}, got {mode.value}",
            file=sys.stderr,
        )
        sys.exit(1)


# ── Step 1: System check ──────────────────────────────────────────────────────

def _step1_system_check() -> None:
    _print_section_header("Stap 1 · Systeemcheck (zelfdiagnostiek)")
    report = run_system_check()
    for check in report.checks:
        icon = "✓" if check.status == "OK" else "✗"
        print(f"  {icon}  [{check.status}] {check.name}")
    print()
    if report.overall == "OK":
        print(f"✓ Alle {len(report.checks)} checks geslaagd — kernel gezond.")
    else:
        failed = [c.name for c in report.checks if c.status != "OK"]
        print(f"✗ {len(failed)} check(s) mislukt:")
        for name in failed:
            print(f"    • {name}")
        sys.exit(1)


# ── Step 2: HDS + Valkyries ───────────────────────────────────────────────────

def _step2_hds_valkyries() -> None:
    _print_section_header("Stap 2 · HDS + Valkyries (user-exposure firewall)")

    # 2a — PASS: gezonde toestand, Valkyries akkoord → gebruiker ziet PASS
    _print_subsection_header("HDS PASS + Valkyries akkoord → gebruiker ziet PASS")
    healthy = State(Delta_ext=1.0, sigma_ext=0.5, omega=0.5, tau=2.0, TI=0.9)
    hds_mode = tao_gate_decide(healthy, True, gdpr_result=_GDPR_PASS, params=_PARAMS)
    v_inuit = valkyrie_inuit_check({})
    v_ux = valkyrie_ux_check({})
    effective = user_exposure_check(hds_mode, v_inuit, v_ux)
    v = instability(healthy, _PARAMS)
    print(f"  State   : V(x)={v:.2f}  (V_max={_PARAMS.V_max})")
    print(f"  HDS     : {hds_mode.value}")
    print(f"  V_INUIT : {v_inuit.status.value} ({v_inuit.source})")
    print(f"  V_UX    : {v_ux.status.value} ({v_ux.source})")
    _show("Effectief resultaat voor gebruiker", effective, Mode.PASS)

    # 2b — HOLD from instability: V(x) boven drempelwaarde
    _print_subsection_header("HDS HOLD door instabiliteit (V ≥ V_hold_ratio × V_max)")
    unstable = State(Delta_ext=1.0, sigma_ext=1.0, omega=2.8, tau=10.0, TI=0.9)
    hds_hold = tao_gate_decide(unstable, True, gdpr_result=_GDPR_PASS, params=_PARAMS)
    v_unstable = instability(unstable, _PARAMS)
    v_thresh = _PARAMS.V_hold_ratio * _PARAMS.V_max
    print(f"  State   : V(x)={v_unstable:.2f}  ≥  drempel={v_thresh:.2f}")
    _show("HDS brengt kernel in HOLD", hds_hold, Mode.HOLD)

    # 2c — HOLD from Valkyrie UX: HDS=PASS maar Valkyrie UX detecteert dark patterns
    _print_subsection_header("HDS PASS, Valkyrie UX blokkeert dark patterns → HOLD")
    v_ux_fail = valkyrie_ux_check({"dark_patterns_absent": False})
    effective_ux_fail = user_exposure_check(Mode.PASS, valkyrie_inuit_check({}), v_ux_fail)
    print(f"  V_UX    : {v_ux_fail.status.value} ({v_ux_fail.source})")
    _show("Valkyrie UX verlaagt PASS naar HOLD", effective_ux_fail, Mode.HOLD)

    # 2d — HOLD from INUIT: Siku=0 verhindert PASS
    _print_subsection_header("INUIT Siku=0 vernauwt PASS naar HOLD")
    siku0 = InuitSignal(siku=0, reason="onvoldoende relationele capaciteit", source="demo")
    inuit_mode = tao_gate_decide(
        healthy, True, gdpr_result=_GDPR_PASS, inuit_signal=siku0, params=_PARAMS
    )
    print(f"  INUIT   : Siku=0 — {siku0.reason}")
    _show("INUIT Siku=0 vernauwt naar HOLD", inuit_mode, Mode.HOLD)

    # 2e — Valkyries kunnen BLOCK niet ontspannen
    _print_subsection_header("Valkyries kunnen BLOCK niet ontspannen (monotone veiligheid)")
    ti_block = State(Delta_ext=0.5, sigma_ext=0.1, omega=0.2, tau=1.0, TI=0.1)
    hds_block = tao_gate_decide(ti_block, True, gdpr_result=_GDPR_PASS, params=_PARAMS)
    effective_block = user_exposure_check(hds_block, valkyrie_inuit_check({}), valkyrie_ux_check({}))
    print(f"  HDS     : {hds_block.value} (TI={ti_block.TI} < TI_min={_PARAMS.TI_min})")
    _show("BLOCK blijft BLOCK ondanks Valkyries akkoord", effective_block, Mode.BLOCK)


# ── Step 3: Decision priority ─────────────────────────────────────────────────

def _step3_decision_priority() -> None:
    _print_section_header("Stap 3 · Beslisprioriteit")
    print()
    print("  Volgorde: GDPR STOP > Cerberus > Barbatos > O36 > SI/TI > DYMPHNA > INUIT > PASS")

    # 3a — GDPR STOP (hoogste prioriteit)
    _print_subsection_header("GDPR STOP → BLOCK (overstijgt alles)")
    gdpr_mode = tao_gate_decide(
        State(Delta_ext=1.0, sigma_ext=0.5, omega=0.5, tau=2.0, TI=0.9),
        True,
        gdpr_result=_GDPR_STOP,
        params=_PARAMS,
    )
    _show("GDPR STOP forceert BLOCK", gdpr_mode, Mode.BLOCK)

    # 3b — Barbatos: Delta_ext buiten de veiligheidsgrens
    _print_subsection_header("Barbatos |Delta_ext| > √(V_max/α) → BLOCK")
    barbatos_mode = tao_gate_decide(
        State(Delta_ext=5.0, sigma_ext=0.0, omega=0.0, tau=5.0, TI=1.0),
        True,
        gdpr_result=_GDPR_PASS,
        params=_PARAMS,
    )
    _show("Barbatos: externe druk buiten grens forceert BLOCK", barbatos_mode, Mode.BLOCK)

    # 3c — Cerberus: legitimiteit ingetrokken
    _print_subsection_header("Cerberus legitimacy_ok=False → BLOCK")
    cerberus_mode = tao_gate_decide(
        State(Delta_ext=1.0, sigma_ext=0.5, omega=0.5, tau=2.0, TI=0.9),
        False,
        gdpr_result=_GDPR_PASS,
        params=_PARAMS,
    )
    _show("Ingetrokken legitimiteit forceert BLOCK", cerberus_mode, Mode.BLOCK)

    # 3d — O36: omega overschrijdt draagcapaciteit
    _print_subsection_header("O36 omega > tau − sigma_ext → BLOCK")
    o36_mode = tao_gate_decide(
        State(Delta_ext=0.5, sigma_ext=0.5, omega=3.0, tau=2.0, TI=0.8),
        True,
        gdpr_result=_GDPR_PASS,
        params=_PARAMS,
    )
    _show("O36 draagcapaciteitsoverschrijding forceert BLOCK", o36_mode, Mode.BLOCK)

    # 3e — SI/TI: temporele integriteit te laag
    _print_subsection_header("SI/TI TI < TI_min → BLOCK")
    ti_mode = tao_gate_decide(
        State(Delta_ext=0.5, sigma_ext=0.1, omega=0.2, tau=1.0, TI=0.1),
        True,
        gdpr_result=_GDPR_PASS,
        params=_PARAMS,
    )
    _show("TI < TI_min forceert BLOCK", ti_mode, Mode.BLOCK)

    # 3f — DYMPHNA: cumulatieve belasting overschreden
    _print_subsection_header("DYMPHNA D_load > D_cap_eff → BLOCK")
    dymphna_mode = tao_gate_decide(
        State(Delta_ext=1.0, sigma_ext=0.5, omega=0.5, tau=2.0, TI=0.9,
              D_load=12.0, D_cap_eff=10.0),
        True,
        gdpr_result=_GDPR_PASS,
        params=_PARAMS,
    )
    _show("DYMPHNA-overbelasting forceert BLOCK", dymphna_mode, Mode.BLOCK)

    # 3g — Alles akkoord → PASS
    _print_subsection_header("Alle constraints voldaan → PASS")
    pass_mode = tao_gate_decide(
        State(Delta_ext=1.0, sigma_ext=0.5, omega=0.5, tau=2.0, TI=0.9),
        True,
        gdpr_result=_GDPR_PASS,
        params=_PARAMS,
    )
    _show("Alle constraints voldaan: kernel geeft PASS", pass_mode, Mode.PASS)


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    """Run the three-step Quick Demo."""
    print("=" * _W)
    print("TaoGate Governance Kernel — Quick Demo")
    print("ORFHEUSS · zelfdiagnose · HDS + Valkyries · beslisprioriteit")
    print("=" * _W)

    _step1_system_check()
    _step2_hds_valkyries()
    _step3_decision_priority()

    print()
    print("=" * _W)
    print("✓ Demo voltooid — governance-kernel werkt correct.")
    print("=" * _W)


if __name__ == "__main__":
    main()
