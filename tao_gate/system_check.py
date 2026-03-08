"""
tao_gate/system_check.py — ORFHEUSS Governance Kernel self-diagnostic.

Runs a structured health check across every governance layer and returns
a :class:`SystemCheckReport` with the status of each check.  The checks
validate that all governance invariants hold at the current code level;
they can be used during deployment, CI, or on-demand audit runs.

Layers verified
---------------
  1. GateParams       — coefficient validation.
  2. instability      — V(x) is always non-negative.
  3. omega_capacity   — O36 capacity clamps correctly.
  4. GDPR STOP        — STOP unconditionally forces BLOCK.
  5. Cerberus         — legitimacy_ok=False forces BLOCK.
  6. Barbatos         — alpha=0 does not raise ZeroDivisionError.
  7. O36              — omega > capacity forces BLOCK.
  8. SI/TI            — TI < TI_min forces BLOCK.
  9. DYMPHNA          — D_load > D_cap_eff forces BLOCK.
 10. INUIT            — Siku=0 tightens PASS → HOLD.
 11. Monotone safety  — hard BLOCK is never relaxed.
 12. HOLD threshold   — V(x) ≥ V_hold_ratio × V_max triggers HOLD.
 13. Valkyrie INUIT   — all-clear context returns OK.
 14. Valkyrie UX      — all-clear context returns OK.
 15. User exposure    — PASS + OK + OK → PASS.
 16. Exposure firewall — Valkyries cannot relax BLOCK.
  17. explain_decision — all required audit keys present.
  18. Architecture docs — layer and flow documents are present.
  19. Public API indexes — boundary index.ts files exist for server subsystems.
  20. Import boundaries — cross-subsystem imports go through public indexes.

Invoke as a CLI script:
    python -m tao_gate.system_check
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
import re
from typing import Callable

from tao_gate.state import GateParams, Mode, State, instability, omega_capacity
from tao_gate.gdpr_bridge import DecisionResult, GdprDecision
from tao_gate.inuit import InuitSignal
from tao_gate.dymphna import dymphna_check
from tao_gate.supervisor import tao_gate_decide, explain_decision
from tao_gate.valkyrie import (
    ValkyrieStatus,
    valkyrie_inuit_check,
    valkyrie_ux_check,
    user_exposure_check,
)


@dataclass(frozen=True)
class CheckResult:
    """
    Result of a single system check.

    Attributes
    ----------
    name : str
        Short name identifying the check.
    status : str
        ``"OK"`` if the check passed, ``"FAIL"`` if it did not.
    detail : str
        Human-readable explanation of the outcome.
    """

    name: str
    status: str  # "OK" | "FAIL"
    detail: str


@dataclass
class SystemCheckReport:
    """
    Full self-diagnostic report for the TaoGate governance kernel.

    Attributes
    ----------
    checks : list[CheckResult]
        Ordered list of individual check results.
    overall : str
        ``"OK"`` if every check passed; ``"FAIL"`` otherwise.
    timestamp : str
        ISO-8601 UTC timestamp of when the report was generated.
    """

    checks: list[CheckResult] = field(default_factory=list)
    overall: str = "OK"  # "OK" | "FAIL"
    timestamp: str = ""


# ── Internal helpers ──────────────────────────────────────────────────────────

def _run_check(
    name: str,
    fn: Callable[[], bool],
    detail_ok: str,
    detail_fail: str,
) -> CheckResult:
    """Execute *fn* and wrap the boolean result in a :class:`CheckResult`."""
    try:
        ok = fn()
        return CheckResult(
            name=name,
            status="OK" if ok else "FAIL",
            detail=detail_ok if ok else detail_fail,
        )
    except Exception as exc:  # noqa: BLE001
        return CheckResult(
            name=name,
            status="FAIL",
            detail=f"Unexpected exception during check: {exc}",
        )


def _read_text(path: Path) -> str:
    """Read *path* as UTF-8 text."""
    return path.read_text(encoding="utf-8")


_REPO_ROOT = Path(__file__).resolve().parent.parent
_SERVER_PUBLIC_SUBSYSTEMS = (
    "core",
    "pipeline",
    "fsm",
    "trace",
    "vector_engine",
    "middleware",
)
_ARCHITECTURE_DOC_ANCHORS = {
    _REPO_ROOT / "ARCHITECTURE.md": ("Dependency Direction", "Dependency Rules"),
    _REPO_ROOT / "docs" / "system_architecture.md": ("Full Stack", "Discrete Modes"),
}
_IMPORT_FROM_RE = re.compile(r'\bfrom\s+["\']([^"\']+)["\']')


def _server_subsystem(rel_path: Path) -> str | None:
    """Return the server subsystem for a repository-relative path."""
    parts = rel_path.parts
    if len(parts) >= 2 and parts[0] == "server" and parts[1] in _SERVER_PUBLIC_SUBSYSTEMS:
        return parts[1]
    return None


def _architecture_doc_gaps() -> tuple[list[str], list[str]]:
    """Return missing architecture files and missing anchor headings."""
    missing_files: list[str] = []
    missing_anchors: list[str] = []

    for path, anchors in _ARCHITECTURE_DOC_ANCHORS.items():
        if not path.exists():
            missing_files.append(path.relative_to(_REPO_ROOT).as_posix())
            continue

        text = _read_text(path)
        for anchor in anchors:
            if anchor not in text:
                missing_anchors.append(
                    f"{path.relative_to(_REPO_ROOT).as_posix()}::{anchor}"
                )

    return missing_files, missing_anchors


def _missing_public_indexes() -> list[str]:
    """Return missing public index.ts files for server subsystems."""
    missing: list[str] = []

    for subsystem in _SERVER_PUBLIC_SUBSYSTEMS:
        index_path = _REPO_ROOT / "server" / subsystem / "index.ts"
        if not index_path.exists():
            missing.append(index_path.relative_to(_REPO_ROOT).as_posix())

    return missing


def _cross_subsystem_internal_import_violations() -> list[str]:
    """
    Find cross-subsystem imports that bypass a public index file.

    The rule is intentionally simple: files may import another subsystem through
    ``server/<subsystem>`` or ``server/<subsystem>/index``, but not through
    internal files such as ``server/trace/hypatia``.
    """
    violations: list[str] = []

    for path in _REPO_ROOT.rglob("*.ts"):
        rel_path = path.relative_to(_REPO_ROOT)
        rel_posix = rel_path.as_posix()
        if (
            "node_modules" in rel_path.parts
            or "dist" in rel_path.parts
            or path.name == "index.ts"
            or "__tests__" in rel_path.parts
            or rel_posix.endswith(".test.ts")
            or rel_posix.endswith(".spec.ts")
        ):
            continue

        current_subsystem = _server_subsystem(rel_path)
        if current_subsystem is None:
            continue

        for specifier in _IMPORT_FROM_RE.findall(_read_text(path)):
            if not specifier.startswith("."):
                continue

            target = (path.parent / specifier).resolve(strict=False)
            try:
                target_rel = target.relative_to(_REPO_ROOT)
            except ValueError:
                continue

            target_subsystem = _server_subsystem(target_rel)
            if target_subsystem is None or target_subsystem == current_subsystem:
                continue

            if len(target_rel.parts) <= 2:
                continue

            if len(target_rel.parts) == 3 and Path(target_rel.parts[2]).stem == "index":
                continue

            violations.append(f"{rel_posix} -> {specifier}")

    return violations


# ── Shared fixtures ───────────────────────────────────────────────────────────

_PARAMS = GateParams()

_HEALTHY = State(Delta_ext=1.0, sigma_ext=0.5, omega=0.5, tau=2.0, TI=0.9)

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
    reason="System-check fixture: GDPR STOP signal.",
    scope="GDPR_ART_9",
    canon_level="CRITICAL",
)


# ── Public API ────────────────────────────────────────────────────────────────

def run_system_check() -> SystemCheckReport:
    """
    Run self-diagnostic checks on all TaoGate governance layers.

    Each check is independent and captures its own exceptions, so a single
    broken layer does not prevent other layers from being evaluated.

    Returns
    -------
    SystemCheckReport
        Structured report with per-layer :class:`CheckResult` entries and an
        ``overall`` field that is ``"OK"`` only when every check passes.
    """
    checks: list[CheckResult] = []

    # ── 1. GateParams default params valid ───────────────────────────────────
    checks.append(_run_check(
        name="GateParams: default params valid",
        fn=lambda: isinstance(GateParams(), GateParams),
        detail_ok="Default GateParams are valid.",
        detail_fail="Default GateParams raised an unexpected error.",
    ))

    # ── 2. instability(x) non-negative ───────────────────────────────────────
    v = instability(_HEALTHY, _PARAMS)
    checks.append(_run_check(
        name="instability(x): non-negative result",
        fn=lambda: instability(_HEALTHY, _PARAMS) >= 0.0,
        detail_ok=f"V(x) = {v:.4g} ≥ 0 for healthy state.",
        detail_fail="instability(x) returned a negative value — invariant violated.",
    ))

    # ── 3. omega_capacity non-negative when tau < sigma_ext ──────────────────
    checks.append(_run_check(
        name="omega_capacity: clamps to 0 when tau < sigma_ext",
        fn=lambda: omega_capacity(
            State(Delta_ext=0.0, sigma_ext=5.0, omega=0.0, tau=2.0, TI=1.0)
        ) == 0.0,
        detail_ok="omega_capacity correctly clamps to 0.0 when tau < sigma_ext.",
        detail_fail="omega_capacity returned a negative value — invariant violated.",
    ))

    # ── 4. GDPR STOP → BLOCK ──────────────────────────────────────────────────
    checks.append(_run_check(
        name="GDPR: STOP unconditionally forces BLOCK",
        fn=lambda: tao_gate_decide(
            _HEALTHY, True, gdpr_result=_GDPR_STOP, params=_PARAMS
        ) is Mode.BLOCK,
        detail_ok="GDPR STOP correctly forces Mode.BLOCK.",
        detail_fail="GDPR STOP did NOT produce Mode.BLOCK — governance invariant violated.",
    ))

    # ── 5. Cerberus: legitimacy_ok=False → BLOCK ──────────────────────────────
    checks.append(_run_check(
        name="Cerberus: legitimacy_ok=False forces BLOCK",
        fn=lambda: tao_gate_decide(
            _HEALTHY, False, gdpr_result=_GDPR_PASS, params=_PARAMS
        ) is Mode.BLOCK,
        detail_ok="Revoked legitimacy correctly forces Mode.BLOCK.",
        detail_fail="Revoked legitimacy did NOT produce Mode.BLOCK — governance invariant violated.",
    ))

    # ── 6. Barbatos: alpha=0 does not raise ZeroDivisionError ─────────────────
    checks.append(_run_check(
        name="Barbatos: alpha=0 handled safely (no ZeroDivisionError)",
        fn=lambda: tao_gate_decide(
            State(Delta_ext=999.0, sigma_ext=0.0, omega=0.0, tau=5.0, TI=1.0),
            True,
            gdpr_result=_GDPR_PASS,
            params=GateParams(alpha=0.0),
        ) is Mode.PASS,
        detail_ok="alpha=0 handled safely; large Delta_ext does not block.",
        detail_fail="alpha=0 produced an unexpected result or exception.",
    ))

    # ── 7. O36: omega > capacity → BLOCK ──────────────────────────────────────
    _o36_state = State(Delta_ext=0.5, sigma_ext=0.5, omega=3.0, tau=2.0, TI=0.8)
    checks.append(_run_check(
        name="O36: omega > tau − sigma_ext forces BLOCK",
        fn=lambda: tao_gate_decide(
            _o36_state, True, gdpr_result=_GDPR_PASS, params=_PARAMS
        ) is Mode.BLOCK,
        detail_ok="O36 carrying-capacity constraint correctly forces Mode.BLOCK.",
        detail_fail="O36 did NOT produce Mode.BLOCK — governance invariant violated.",
    ))

    # ── 8. SI/TI: TI < TI_min → BLOCK ────────────────────────────────────────
    _ti_state = State(Delta_ext=0.5, sigma_ext=0.1, omega=0.2, tau=1.0, TI=0.1)
    checks.append(_run_check(
        name="SI/TI: TI < TI_min forces BLOCK",
        fn=lambda: tao_gate_decide(
            _ti_state, True, gdpr_result=_GDPR_PASS, params=_PARAMS
        ) is Mode.BLOCK,
        detail_ok="TI < TI_min correctly forces Mode.BLOCK.",
        detail_fail="TI < TI_min did NOT produce Mode.BLOCK — governance invariant violated.",
    ))

    # ── 9. DYMPHNA: D_load > D_cap_eff → BLOCK ────────────────────────────────
    _dymphna_state = State(
        Delta_ext=1.0, sigma_ext=0.5, omega=0.5, tau=2.0, TI=0.9,
        D_load=12.0, D_cap_eff=10.0,
    )
    checks.append(_run_check(
        name="DYMPHNA: D_load > D_cap_eff forces BLOCK",
        fn=lambda: tao_gate_decide(
            _dymphna_state, True, gdpr_result=_GDPR_PASS, params=_PARAMS
        ) is Mode.BLOCK,
        detail_ok="DYMPHNA overload (D_l=12 > D_k^e=10) correctly forces Mode.BLOCK.",
        detail_fail="DYMPHNA overload did NOT produce Mode.BLOCK — governance invariant violated.",
    ))

    # ── 10. INUIT: Siku=0 tightens PASS → HOLD ───────────────────────────────
    _siku0 = InuitSignal(siku=0, reason="system check fixture", source="system_check")
    checks.append(_run_check(
        name="INUIT: Siku=0 tightens PASS to HOLD",
        fn=lambda: tao_gate_decide(
            _HEALTHY, True, gdpr_result=_GDPR_PASS,
            inuit_signal=_siku0, params=_PARAMS,
        ) is Mode.HOLD,
        detail_ok="INUIT Siku=0 correctly tightens PASS to HOLD.",
        detail_fail="INUIT Siku=0 did NOT tighten PASS to HOLD — monotone safety violated.",
    ))

    # ── 11. Monotone safety: hard BLOCK never relaxed by INUIT ───────────────
    _siku1 = InuitSignal(siku=1, reason="system check fixture", source="system_check")
    checks.append(_run_check(
        name="Monotone safety: hard BLOCK not relaxed by INUIT Siku=1",
        fn=lambda: tao_gate_decide(
            _ti_state, True, gdpr_result=_GDPR_PASS,
            inuit_signal=_siku1, params=_PARAMS,
        ) is Mode.BLOCK,
        detail_ok="Monotone safety holds: TI-BLOCK is not relaxed by INUIT Siku=1.",
        detail_fail="Hard BLOCK was relaxed — monotone safety invariant violated.",
    ))

    # ── 12. HOLD threshold: V(x) ≥ V_hold_ratio × V_max → HOLD ──────────────
    _hold_state = State(Delta_ext=1.0, sigma_ext=1.0, omega=2.8, tau=10.0, TI=0.9)
    v_hold = instability(_hold_state, _PARAMS)
    v_thresh = _PARAMS.V_hold_ratio * _PARAMS.V_max
    checks.append(_run_check(
        name="HOLD threshold: V(x) ≥ V_hold_ratio × V_max triggers HOLD",
        fn=lambda: tao_gate_decide(
            _hold_state, True, gdpr_result=_GDPR_PASS, params=_PARAMS
        ) is Mode.HOLD,
        detail_ok=(
            f"V(x)={v_hold:.4g} ≥ threshold={v_thresh:.4g}: HOLD correctly triggered."
        ),
        detail_fail="HOLD threshold did not trigger Mode.HOLD.",
    ))

    # ── 13. Valkyrie INUIT: all-clear context returns OK ─────────────────────
    _v_inuit_ok = valkyrie_inuit_check({})
    checks.append(_run_check(
        name="Valkyrie INUIT: all-clear context returns OK",
        fn=lambda: _v_inuit_ok.status is ValkyrieStatus.OK,
        detail_ok="Valkyrie INUIT all-clear returns OK.",
        detail_fail="Valkyrie INUIT all-clear did NOT return OK.",
    ))

    # ── 14. Valkyrie UX: all-clear context returns OK ────────────────────────
    _v_ux_ok = valkyrie_ux_check({})
    checks.append(_run_check(
        name="Valkyrie UX: all-clear context returns OK",
        fn=lambda: _v_ux_ok.status is ValkyrieStatus.OK,
        detail_ok="Valkyrie UX all-clear returns OK.",
        detail_fail="Valkyrie UX all-clear did NOT return OK.",
    ))

    # ── 15. User exposure firewall: PASS + OK + OK → PASS ────────────────────
    checks.append(_run_check(
        name="User exposure firewall: PASS + OK + OK → PASS",
        fn=lambda: user_exposure_check(Mode.PASS, _v_inuit_ok, _v_ux_ok) is Mode.PASS,
        detail_ok="User exposure firewall allows PASS when all checks clear.",
        detail_fail="User exposure firewall did NOT allow PASS with all checks OK.",
    ))

    # ── 16. Exposure firewall: Valkyries cannot relax BLOCK ──────────────────
    checks.append(_run_check(
        name="User exposure firewall: BLOCK + OK + OK → BLOCK (no relaxation)",
        fn=lambda: user_exposure_check(Mode.BLOCK, _v_inuit_ok, _v_ux_ok) is Mode.BLOCK,
        detail_ok="User exposure firewall correctly preserves BLOCK; Valkyries cannot relax it.",
        detail_fail="Valkyries relaxed BLOCK to a weaker mode — governance invariant violated.",
    ))

    # ── 17. explain_decision: all required audit keys present ────────────────
    _REQUIRED_KEYS = frozenset({
        "mode", "V", "V_max", "V_hold_threshold", "constraints", "inuit", "dymphna"
    })

    def _explain_keys_ok() -> bool:
        result = explain_decision(
            _HEALTHY, True, gdpr_result=_GDPR_PASS, params=_PARAMS
        )
        return _REQUIRED_KEYS.issubset(result.keys())

    checks.append(_run_check(
        name="explain_decision: all required audit keys present",
        fn=_explain_keys_ok,
        detail_ok=f"explain_decision returns all required keys: {sorted(_REQUIRED_KEYS)}.",
        detail_fail="explain_decision is missing one or more required audit keys.",
    ))

    # ── 18. Architecture docs are present and structured ──────────────────────
    _missing_arch_files, _missing_arch_anchors = _architecture_doc_gaps()
    checks.append(_run_check(
        name="Architecture docs: layer and flow documents present",
        fn=lambda: not _missing_arch_files and not _missing_arch_anchors,
        detail_ok=(
            "Architecture docs present: ARCHITECTURE.md and docs/system_architecture.md "
            "contain the expected section anchors."
        ),
        detail_fail=(
            "Architecture docs incomplete: "
            f"missing files={_missing_arch_files or 'none'}, "
            f"missing anchors={_missing_arch_anchors or 'none'}."
        ),
    ))

    # ── 19. Public server subsystem indexes exist ─────────────────────────────
    _missing_indexes = _missing_public_indexes()
    checks.append(_run_check(
        name="Architecture indexes: public server APIs exported via index.ts",
        fn=lambda: not _missing_indexes,
        detail_ok=(
            "All public server subsystem indexes exist: "
            + ", ".join(f"server/{name}/index.ts" for name in _SERVER_PUBLIC_SUBSYSTEMS)
            + "."
        ),
        detail_fail=f"Missing public subsystem indexes: {_missing_indexes}.",
    ))

    # ── 20. Cross-subsystem imports respect public boundaries ─────────────────
    _import_boundary_violations = _cross_subsystem_internal_import_violations()
    checks.append(_run_check(
        name="Architecture imports: cross-subsystem imports use public indexes",
        fn=lambda: not _import_boundary_violations,
        detail_ok=(
            "No cross-subsystem internal imports were found; TypeScript layers respect "
            "their public index boundaries."
        ),
        detail_fail=(
            "Found cross-subsystem imports that bypass public indexes: "
            f"{_import_boundary_violations}."
        ),
    ))

    # ── Aggregate ─────────────────────────────────────────────────────────────
    overall = "OK" if all(c.status == "OK" for c in checks) else "FAIL"
    timestamp = datetime.now(timezone.utc).isoformat()

    return SystemCheckReport(checks=checks, overall=overall, timestamp=timestamp)


# ── CLI entry point ───────────────────────────────────────────────────────────

def _print_report(report: SystemCheckReport) -> None:
    """Print a human-readable version of *report* to stdout."""
    width = 70
    print("=" * width)
    print("TaoGate — ORFHEUSS Governance Kernel · System Check")
    print(f"Timestamp : {report.timestamp}")
    print("=" * width)
    for check in report.checks:
        icon = "✓" if check.status == "OK" else "✗"
        print(f"\n  {icon} [{check.status}] {check.name}")
        print(f"      {check.detail}")
    print("\n" + "=" * width)
    if report.overall == "OK":
        print(f"✓ Overall: {report.overall} — all {len(report.checks)} checks passed.")
    else:
        failed = [c.name for c in report.checks if c.status != "OK"]
        print(f"✗ Overall: {report.overall} — {len(failed)} check(s) failed:")
        for name in failed:
            print(f"    • {name}")
    print("=" * width)


if __name__ == "__main__":
    import sys

    report = run_system_check()
    _print_report(report)
    sys.exit(0 if report.overall == "OK" else 1)
