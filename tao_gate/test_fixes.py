"""
tao_gate/test_fixes.py — Targeted tests for the debug/improve fixes.

Tests cover:
  1. GateParams validation (__post_init__ raises ValueError for bad inputs).
  2. Barbatos guard: alpha=0 no longer causes ZeroDivisionError.
  3. GDPR fail-safe: PrivacyGate exception → STOP.
  4. Governance invariants: GDPR STOP always produces BLOCK; no BLOCK→PASS relaxation.
  5. INUIT · BIOLOGY: Siku ∈ {0,1}; Siku=0 tightens PASS→HOLD; cannot relax BLOCK.
  6. DYMPHNA: D_l > D_k^e forces BLOCK; DymphnaSignal validation; explain_decision keys.
  7. Valkyrie layer: user-exposure firewall (V_INUIT, V_UX checks, user_exposure_check).

Run with:
    python -m tao_gate.test_fixes
"""

from __future__ import annotations

import sys
import unittest
from dataclasses import dataclass
from unittest.mock import patch

from tao_gate.gdpr_bridge import DecisionResult, GdprDecision
from tao_gate.inuit import InuitSignal, inuit_context_check
from tao_gate.state import GateParams, Mode, State, instability, omega_capacity
from tao_gate.supervisor import explain_decision, tao_gate_decide
from tao_gate.valkyrie import (
    ValkyrieSignal,
    ValkyrieStatus,
    user_exposure_check,
    valkyrie_inuit_check,
    valkyrie_ux_check,
)


# ── Helpers ──────────────────────────────────────────────────────────────────

_HEALTHY_STATE = State(Delta_ext=1.0, sigma_ext=0.5, omega=0.5, tau=2.0, TI=0.9)
_GDPR_PASS = DecisionResult(
    decision=GdprDecision.PASS,
    escalate=False,
    reason="ok",
    scope="GDPR_PERSONAL_DATA",
    canon_level="INFORMATIONAL",
)
_GDPR_STOP = DecisionResult(
    decision=GdprDecision.STOP,
    escalate=True,
    reason="blocked",
    scope="GDPR_ART_9_MEDICAL_DATA",
    canon_level="CRITICAL",
)


# ── Test suite ────────────────────────────────────────────────────────────────

class TestGateParamsValidation(unittest.TestCase):
    """GateParams.__post_init__ must reject invalid coefficient values."""

    def test_default_params_are_valid(self) -> None:
        p = GateParams()
        self.assertIsInstance(p, GateParams)

    def test_negative_alpha_raises(self) -> None:
        with self.assertRaises(ValueError):
            GateParams(alpha=-0.1)

    def test_negative_beta_raises(self) -> None:
        with self.assertRaises(ValueError):
            GateParams(beta=-1.0)

    def test_negative_gamma_raises(self) -> None:
        with self.assertRaises(ValueError):
            GateParams(gamma=-0.001)

    def test_zero_v_max_raises(self) -> None:
        with self.assertRaises(ValueError):
            GateParams(V_max=0.0)

    def test_negative_v_max_raises(self) -> None:
        with self.assertRaises(ValueError):
            GateParams(V_max=-5.0)

    def test_v_hold_ratio_zero_raises(self) -> None:
        with self.assertRaises(ValueError):
            GateParams(V_hold_ratio=0.0)

    def test_v_hold_ratio_one_raises(self) -> None:
        with self.assertRaises(ValueError):
            GateParams(V_hold_ratio=1.0)

    def test_v_hold_ratio_above_one_raises(self) -> None:
        with self.assertRaises(ValueError):
            GateParams(V_hold_ratio=1.5)

    def test_negative_ti_min_raises(self) -> None:
        with self.assertRaises(ValueError):
            GateParams(TI_min=-0.1)

    def test_zero_alpha_is_valid(self) -> None:
        """alpha=0 is allowed; Delta_ext has zero weight in V(x)."""
        p = GateParams(alpha=0.0)
        self.assertEqual(p.alpha, 0.0)

    def test_zero_beta_is_valid(self) -> None:
        p = GateParams(beta=0.0)
        self.assertEqual(p.beta, 0.0)

    def test_zero_gamma_is_valid(self) -> None:
        p = GateParams(gamma=0.0)
        self.assertEqual(p.gamma, 0.0)

    def test_zero_ti_min_is_valid(self) -> None:
        p = GateParams(TI_min=0.0)
        self.assertEqual(p.TI_min, 0.0)


class TestBarbatosDivisionByZeroGuard(unittest.TestCase):
    """When alpha=0, tao_gate_decide must not raise ZeroDivisionError."""

    def test_alpha_zero_healthy_state_returns_pass(self) -> None:
        """Large Delta_ext with alpha=0 should not block on Barbatos."""
        params = GateParams(alpha=0.0)
        state = State(Delta_ext=999.0, sigma_ext=0.0, omega=0.0, tau=5.0, TI=1.0)
        mode = tao_gate_decide(state, legitimacy_ok=True, gdpr_result=_GDPR_PASS, params=params)
        self.assertEqual(mode, Mode.PASS)

    def test_alpha_zero_explain_decision_no_error(self) -> None:
        params = GateParams(alpha=0.0)
        state = State(Delta_ext=999.0, sigma_ext=0.0, omega=0.0, tau=5.0, TI=1.0)
        result = explain_decision(state, legitimacy_ok=True, gdpr_result=_GDPR_PASS, params=params)
        self.assertEqual(result["constraints"]["delta_in_bounds"], True)

    def test_alpha_zero_other_constraints_still_apply(self) -> None:
        """With alpha=0, other constraints (legitimacy, TI, omega) still BLOCK."""
        params = GateParams(alpha=0.0)
        state = State(Delta_ext=999.0, sigma_ext=0.0, omega=0.0, tau=5.0, TI=0.1)
        mode = tao_gate_decide(state, legitimacy_ok=True, gdpr_result=_GDPR_PASS, params=params)
        self.assertEqual(mode, Mode.BLOCK)  # TI < TI_min blocks


class TestGdprFailSafe(unittest.TestCase):
    """PrivacyGate exceptions must be treated as STOP (fail-safe)."""

    def test_privacy_gate_exception_returns_stop(self) -> None:
        from tao_gate import gdpr_bridge

        with patch.object(
            gdpr_bridge.PrivacyGate,
            "evaluate",
            side_effect=RuntimeError("connection refused"),
        ):
            result = gdpr_bridge.gdpr_personal_data_check({"actie": "test"})

        self.assertEqual(result.decision, GdprDecision.STOP)
        self.assertTrue(result.escalate)
        self.assertIn("connection refused", result.reason)
        self.assertEqual(result.canon_level, "CRITICAL")

    def test_privacy_gate_exception_forces_block_in_supervisor(self) -> None:
        """GDPR fail-safe STOP must propagate to Mode.BLOCK."""
        from tao_gate import gdpr_bridge

        with patch.object(
            gdpr_bridge.PrivacyGate,
            "evaluate",
            side_effect=RuntimeError("connection refused"),
        ):
            result = gdpr_bridge.gdpr_personal_data_check({"actie": "test"})

        mode = tao_gate_decide(_HEALTHY_STATE, legitimacy_ok=True, gdpr_result=result)
        self.assertEqual(mode, Mode.BLOCK)


class TestGovernanceInvariants(unittest.TestCase):
    """Core governance properties must hold unconditionally."""

    def test_gdpr_stop_always_block(self) -> None:
        """GDPR STOP must produce BLOCK regardless of state and legitimacy."""
        mode = tao_gate_decide(_HEALTHY_STATE, legitimacy_ok=True, gdpr_result=_GDPR_STOP)
        self.assertEqual(mode, Mode.BLOCK)

    def test_gdpr_stop_overrides_legitimacy_true(self) -> None:
        mode = tao_gate_decide(_HEALTHY_STATE, legitimacy_ok=True, gdpr_result=_GDPR_STOP)
        self.assertEqual(mode, Mode.BLOCK)

    def test_block_never_relaxed_to_pass(self) -> None:
        """tao_gate_decide must never return PASS when any hard constraint fails."""
        blocked_state = State(Delta_ext=0.1, sigma_ext=0.0, omega=0.0, tau=5.0, TI=0.1)
        mode = tao_gate_decide(blocked_state, legitimacy_ok=True, gdpr_result=_GDPR_PASS)
        # TI=0.1 < TI_min=0.5 → must be BLOCK, not PASS
        self.assertNotEqual(mode, Mode.PASS)

    def test_instability_non_negative_with_valid_params(self) -> None:
        """With valid (non-negative) alpha/beta/gamma, V(x) must be >= 0."""
        params = GateParams(alpha=1.0, beta=2.0, gamma=0.5)
        for delta, sigma, omega in [
            (0.0, 0.0, 0.0),
            (1.0, -2.0, 3.0),
            (-5.0, -5.0, -5.0),
        ]:
            v = instability(State(delta, sigma, omega, tau=5.0, TI=1.0), params)
            self.assertGreaterEqual(v, 0.0, msg=f"V(x) < 0 for delta={delta}")

    def test_omega_capacity_non_negative(self) -> None:
        """omega_capacity must always return a non-negative value."""
        # tau < sigma_ext → should clamp at 0
        state = State(Delta_ext=0.0, sigma_ext=5.0, omega=1.0, tau=2.0, TI=1.0)
        cap = omega_capacity(state)
        self.assertEqual(cap, 0.0)


class TestInuitSiku(unittest.TestCase):
    """INUIT · BIOLOGY sensor and its integration with tao_gate_decide."""

    def test_siku_1_allows_pass(self) -> None:
        """Siku=1 (sufficient capacity) must not prevent PASS."""
        from tao_gate.inuit import inuit_context_check
        signal = inuit_context_check({"siku": 1})
        mode = tao_gate_decide(_HEALTHY_STATE, legitimacy_ok=True,
                               gdpr_result=_GDPR_PASS, inuit_signal=signal)
        self.assertEqual(mode, Mode.PASS)

    def test_siku_0_tightens_pass_to_hold(self) -> None:
        """Siku=0 must tighten a would-be PASS to HOLD."""
        from tao_gate.inuit import inuit_context_check
        signal = inuit_context_check({"relational_capacity_ok": False})
        self.assertEqual(signal.siku, 0)
        mode = tao_gate_decide(_HEALTHY_STATE, legitimacy_ok=True,
                               gdpr_result=_GDPR_PASS, inuit_signal=signal)
        self.assertEqual(mode, Mode.HOLD)

    def test_siku_0_does_not_relax_block(self) -> None:
        """Siku=0 must never relax an existing BLOCK to HOLD."""
        from tao_gate.inuit import inuit_context_check
        signal = inuit_context_check({"biology_signal_ok": False})
        # TI=0.1 < TI_min=0.5 → hard BLOCK
        blocked_state = State(Delta_ext=0.1, sigma_ext=0.0, omega=0.0, tau=5.0, TI=0.1)
        mode = tao_gate_decide(blocked_state, legitimacy_ok=True,
                               gdpr_result=_GDPR_PASS, inuit_signal=signal)
        self.assertEqual(mode, Mode.BLOCK)

    def test_inuit_invalid_siku_raises(self) -> None:
        """inuit_context_check must raise ValueError for siku ∉ {0,1}."""
        from tao_gate.inuit import inuit_context_check
        with self.assertRaises(ValueError):
            inuit_context_check({"siku": 2})

    def test_inuit_signal_invalid_siku_raises_on_construct(self) -> None:
        """Directly constructing InuitSignal with siku=2 must raise ValueError."""
        from tao_gate.inuit import InuitSignal
        with self.assertRaises(ValueError):
            InuitSignal(siku=2, reason="bad", source="test")

    def test_inuit_all_clear_returns_siku_1(self) -> None:
        """Empty context dict (all defaults True) must return Siku=1."""
        from tao_gate.inuit import inuit_context_check
        signal = inuit_context_check({})
        self.assertEqual(signal.siku, 1)

    def test_inuit_cultural_context_false_sets_siku_0(self) -> None:
        """cultural_context_ok=False must yield Siku=0."""
        from tao_gate.inuit import inuit_context_check
        signal = inuit_context_check({"cultural_context_ok": False})
        self.assertEqual(signal.siku, 0)
        self.assertEqual(signal.source, "cultural_context")

    def test_explain_decision_includes_inuit_key(self) -> None:
        """explain_decision must include an 'inuit' key in its output."""
        from tao_gate.inuit import inuit_context_check
        signal = inuit_context_check({"siku": 1})
        result = explain_decision(_HEALTHY_STATE, legitimacy_ok=True,
                                  gdpr_result=_GDPR_PASS, inuit_signal=signal)
        self.assertIn("inuit", result)
        self.assertEqual(result["inuit"]["siku"], 1)


class TestDymphna(unittest.TestCase):
    """DYMPHNA cumulative-load sensor and its integration with tao_gate_decide."""

    def test_no_overload_allows_pass(self) -> None:
        """D_load < D_cap_eff must not prevent PASS."""
        from tao_gate.dymphna import dymphna_check
        state = State(Delta_ext=1.0, sigma_ext=0.5, omega=0.5, tau=2.0, TI=0.9,
                      D_load=5.0, D_cap_eff=10.0)
        sig = dymphna_check(state)
        self.assertFalse(sig.overloaded)
        mode = tao_gate_decide(state, legitimacy_ok=True, gdpr_result=_GDPR_PASS)
        self.assertEqual(mode, Mode.PASS)

    def test_overload_forces_block(self) -> None:
        """D_load > D_cap_eff must force Mode.BLOCK (dysregulation)."""
        state = State(Delta_ext=1.0, sigma_ext=0.5, omega=0.5, tau=2.0, TI=0.9,
                      D_load=12.0, D_cap_eff=10.0)
        mode = tao_gate_decide(state, legitimacy_ok=True, gdpr_result=_GDPR_PASS)
        self.assertEqual(mode, Mode.BLOCK)

    def test_overload_block_not_relaxed_by_inuit(self) -> None:
        """DYMPHNA BLOCK must not be relaxed to HOLD by a Siku=1 INUIT signal."""
        from tao_gate.inuit import inuit_context_check
        state = State(Delta_ext=1.0, sigma_ext=0.5, omega=0.5, tau=2.0, TI=0.9,
                      D_load=20.0, D_cap_eff=10.0)
        inuit = inuit_context_check({"siku": 1})
        mode = tao_gate_decide(state, legitimacy_ok=True,
                               gdpr_result=_GDPR_PASS, inuit_signal=inuit)
        self.assertEqual(mode, Mode.BLOCK)

    def test_equal_load_capacity_not_overloaded(self) -> None:
        """D_load == D_cap_eff is NOT overloaded (strict > required)."""
        from tao_gate.dymphna import dymphna_check
        state = State(Delta_ext=1.0, sigma_ext=0.5, omega=0.5, tau=2.0, TI=0.9,
                      D_load=10.0, D_cap_eff=10.0)
        sig = dymphna_check(state)
        self.assertFalse(sig.overloaded)
        mode = tao_gate_decide(state, legitimacy_ok=True, gdpr_result=_GDPR_PASS)
        self.assertEqual(mode, Mode.PASS)

    def test_default_state_not_overloaded(self) -> None:
        """State with default D_load=0 and D_cap_eff=inf must never overload."""
        from tao_gate.dymphna import dymphna_check
        sig = dymphna_check(_HEALTHY_STATE)
        self.assertFalse(sig.overloaded)
        self.assertEqual(_HEALTHY_STATE.D_load, 0.0)
        self.assertEqual(_HEALTHY_STATE.D_cap_eff, float("inf"))

    def test_dymphna_signal_inconsistency_raises(self) -> None:
        """DymphnaSignal with overloaded inconsistent with D_load/D_cap_eff must raise."""
        from tao_gate.dymphna import DymphnaSignal
        with self.assertRaises(ValueError):
            # D_load=5 < D_cap_eff=10 but overloaded=True → inconsistent
            DymphnaSignal(D_load=5.0, D_cap_eff=10.0, overloaded=True, reason="bad")

    def test_dymphna_negative_d_load_raises(self) -> None:
        """DymphnaSignal with D_load < 0 must raise ValueError."""
        from tao_gate.dymphna import DymphnaSignal
        with self.assertRaises(ValueError):
            DymphnaSignal(D_load=-1.0, D_cap_eff=10.0, overloaded=False, reason="bad")

    def test_explain_decision_includes_dymphna_key(self) -> None:
        """explain_decision must include a 'dymphna' key in its output."""
        state = State(Delta_ext=1.0, sigma_ext=0.5, omega=0.5, tau=2.0, TI=0.9,
                      D_load=3.0, D_cap_eff=10.0)
        result = explain_decision(state, legitimacy_ok=True, gdpr_result=_GDPR_PASS)
        self.assertIn("dymphna", result)
        self.assertFalse(result["dymphna"]["overloaded"])
        self.assertEqual(result["dymphna"]["D_load"], 3.0)

    def test_explain_decision_dymphna_overload_in_constraints(self) -> None:
        """explain_decision constraints dict must report dymphna_ok=False on overload."""
        state = State(Delta_ext=1.0, sigma_ext=0.5, omega=0.5, tau=2.0, TI=0.9,
                      D_load=15.0, D_cap_eff=10.0)
        result = explain_decision(state, legitimacy_ok=True, gdpr_result=_GDPR_PASS)
        self.assertEqual(result["mode"], Mode.BLOCK.value)
        self.assertFalse(result["constraints"]["dymphna_ok"])


class TestValkyrieLayer(unittest.TestCase):
    """Valkyrie layer — user-exposure firewall (V_INUIT + V_UX checks)."""

    # ── ValkyrieStatus enum ───────────────────────────────────────────────

    def test_valkyrie_status_values(self) -> None:
        """ValkyrieStatus must have OK and FAIL members."""
        self.assertEqual(ValkyrieStatus.OK.value, "OK")
        self.assertEqual(ValkyrieStatus.FAIL.value, "FAIL")

    # ── Valkyrie INUIT ────────────────────────────────────────────────────

    def test_valkyrie_inuit_all_clear_returns_ok(self) -> None:
        """Empty context (all defaults True) must return OK."""
        sig = valkyrie_inuit_check({})
        self.assertEqual(sig.status, ValkyrieStatus.OK)
        self.assertEqual(sig.source, "all_clear")

    def test_valkyrie_inuit_field_access_false_returns_fail(self) -> None:
        """field_access_ok=False must produce FAIL."""
        sig = valkyrie_inuit_check({"field_access_ok": False})
        self.assertEqual(sig.status, ValkyrieStatus.FAIL)
        self.assertEqual(sig.source, "field_access")

    def test_valkyrie_inuit_timing_false_returns_fail(self) -> None:
        """timing_ok=False must produce FAIL."""
        sig = valkyrie_inuit_check({"timing_ok": False})
        self.assertEqual(sig.status, ValkyrieStatus.FAIL)
        self.assertEqual(sig.source, "timing")

    def test_valkyrie_inuit_both_conditions_true_returns_ok(self) -> None:
        """Explicit True for all keys must return OK."""
        sig = valkyrie_inuit_check({"field_access_ok": True, "timing_ok": True})
        self.assertEqual(sig.status, ValkyrieStatus.OK)

    # ── Valkyrie UX ───────────────────────────────────────────────────────

    def test_valkyrie_ux_all_clear_returns_ok(self) -> None:
        """Empty context (all defaults True) must return OK."""
        sig = valkyrie_ux_check({})
        self.assertEqual(sig.status, ValkyrieStatus.OK)
        self.assertEqual(sig.source, "all_clear")

    def test_valkyrie_ux_dark_patterns_detected_returns_fail(self) -> None:
        """dark_patterns_absent=False must produce FAIL."""
        sig = valkyrie_ux_check({"dark_patterns_absent": False})
        self.assertEqual(sig.status, ValkyrieStatus.FAIL)
        self.assertEqual(sig.source, "dark_patterns")

    def test_valkyrie_ux_ab_testing_unsafe_returns_fail(self) -> None:
        """ab_testing_safe=False must produce FAIL."""
        sig = valkyrie_ux_check({"ab_testing_safe": False})
        self.assertEqual(sig.status, ValkyrieStatus.FAIL)
        self.assertEqual(sig.source, "ab_testing")

    def test_valkyrie_ux_coercion_detected_returns_fail(self) -> None:
        """no_coercion=False must produce FAIL."""
        sig = valkyrie_ux_check({"no_coercion": False})
        self.assertEqual(sig.status, ValkyrieStatus.FAIL)
        self.assertEqual(sig.source, "coercion")

    def test_valkyrie_ux_all_explicit_true_returns_ok(self) -> None:
        """Explicit True for all keys must return OK."""
        sig = valkyrie_ux_check({
            "dark_patterns_absent": True,
            "ab_testing_safe": True,
            "no_coercion": True,
        })
        self.assertEqual(sig.status, ValkyrieStatus.OK)

    # ── user_exposure_check — the combined firewall ───────────────────────

    def test_pass_both_ok_allows_exposure(self) -> None:
        """Mode.PASS + both Valkyries OK → effective mode is PASS."""
        v_inuit = valkyrie_inuit_check({})
        v_ux = valkyrie_ux_check({})
        result = user_exposure_check(Mode.PASS, v_inuit, v_ux)
        self.assertEqual(result, Mode.PASS)

    def test_pass_inuit_fail_holds_exposure(self) -> None:
        """Mode.PASS + V_INUIT FAIL → effective mode is HOLD (boundary hold)."""
        v_inuit = valkyrie_inuit_check({"field_access_ok": False})
        v_ux = valkyrie_ux_check({})
        result = user_exposure_check(Mode.PASS, v_inuit, v_ux)
        self.assertEqual(result, Mode.HOLD)

    def test_pass_ux_fail_holds_exposure(self) -> None:
        """Mode.PASS + V_UX FAIL → effective mode is HOLD (boundary hold)."""
        v_inuit = valkyrie_inuit_check({})
        v_ux = valkyrie_ux_check({"dark_patterns_absent": False})
        result = user_exposure_check(Mode.PASS, v_inuit, v_ux)
        self.assertEqual(result, Mode.HOLD)

    def test_pass_both_fail_holds_exposure(self) -> None:
        """Mode.PASS + both Valkyries FAIL → effective mode is HOLD."""
        v_inuit = valkyrie_inuit_check({"timing_ok": False})
        v_ux = valkyrie_ux_check({"no_coercion": False})
        result = user_exposure_check(Mode.PASS, v_inuit, v_ux)
        self.assertEqual(result, Mode.HOLD)

    def test_hold_both_ok_stays_hold(self) -> None:
        """Mode.HOLD + both Valkyries OK → effective mode remains HOLD."""
        v_inuit = valkyrie_inuit_check({})
        v_ux = valkyrie_ux_check({})
        result = user_exposure_check(Mode.HOLD, v_inuit, v_ux)
        self.assertEqual(result, Mode.HOLD)

    def test_hold_both_fail_stays_hold(self) -> None:
        """Valkyries cannot relax HOLD; result stays HOLD regardless of their status."""
        v_inuit = valkyrie_inuit_check({"field_access_ok": False})
        v_ux = valkyrie_ux_check({"ab_testing_safe": False})
        result = user_exposure_check(Mode.HOLD, v_inuit, v_ux)
        self.assertEqual(result, Mode.HOLD)

    def test_block_both_ok_stays_block(self) -> None:
        """Mode.BLOCK + both Valkyries OK → effective mode remains BLOCK."""
        v_inuit = valkyrie_inuit_check({})
        v_ux = valkyrie_ux_check({})
        result = user_exposure_check(Mode.BLOCK, v_inuit, v_ux)
        self.assertEqual(result, Mode.BLOCK)

    def test_block_both_fail_stays_block(self) -> None:
        """Valkyries cannot relax BLOCK; result stays BLOCK regardless of their status."""
        v_inuit = valkyrie_inuit_check({"timing_ok": False})
        v_ux = valkyrie_ux_check({"no_coercion": False})
        result = user_exposure_check(Mode.BLOCK, v_inuit, v_ux)
        self.assertEqual(result, Mode.BLOCK)

    def test_valkyries_cannot_convert_hold_to_pass(self) -> None:
        """Valkyries with both OK must never elevate HOLD to PASS."""
        v_inuit = valkyrie_inuit_check({})
        v_ux = valkyrie_ux_check({})
        result = user_exposure_check(Mode.HOLD, v_inuit, v_ux)
        self.assertNotEqual(result, Mode.PASS)

    def test_valkyries_cannot_convert_block_to_pass(self) -> None:
        """Valkyries with both OK must never elevate BLOCK to PASS."""
        v_inuit = valkyrie_inuit_check({})
        v_ux = valkyrie_ux_check({})
        result = user_exposure_check(Mode.BLOCK, v_inuit, v_ux)
        self.assertNotEqual(result, Mode.PASS)

    # ── End-to-end integration ────────────────────────────────────────────

    def test_end_to_end_pass_with_clear_valkyries(self) -> None:
        """Full pipeline: HDS decides PASS + clear Valkyries → user sees PASS."""
        hds_mode = tao_gate_decide(_HEALTHY_STATE, legitimacy_ok=True,
                                   gdpr_result=_GDPR_PASS)
        self.assertEqual(hds_mode, Mode.PASS)
        v_inuit = valkyrie_inuit_check({})
        v_ux = valkyrie_ux_check({})
        exposure = user_exposure_check(hds_mode, v_inuit, v_ux)
        self.assertEqual(exposure, Mode.PASS)

    def test_end_to_end_pass_blocked_by_valkyrie_ux(self) -> None:
        """Full pipeline: HDS decides PASS but UX check fails → user sees HOLD."""
        hds_mode = tao_gate_decide(_HEALTHY_STATE, legitimacy_ok=True,
                                   gdpr_result=_GDPR_PASS)
        self.assertEqual(hds_mode, Mode.PASS)
        v_inuit = valkyrie_inuit_check({})
        v_ux = valkyrie_ux_check({"dark_patterns_absent": False})
        exposure = user_exposure_check(hds_mode, v_inuit, v_ux)
        self.assertEqual(exposure, Mode.HOLD)

    def test_end_to_end_block_not_affected_by_valkyries(self) -> None:
        """Full pipeline: HDS decides BLOCK → user sees BLOCK regardless of Valkyries."""
        blocked_state = State(Delta_ext=0.1, sigma_ext=0.0, omega=0.0,
                              tau=5.0, TI=0.1)
        hds_mode = tao_gate_decide(blocked_state, legitimacy_ok=True,
                                   gdpr_result=_GDPR_PASS)
        self.assertEqual(hds_mode, Mode.BLOCK)
        v_inuit = valkyrie_inuit_check({})
        v_ux = valkyrie_ux_check({})
        exposure = user_exposure_check(hds_mode, v_inuit, v_ux)
        self.assertEqual(exposure, Mode.BLOCK)


# ── Runner ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromModule(__import__(__name__))
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
