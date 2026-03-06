"""
tao_gate/test_fixes.py — Targeted tests for the debug/improve fixes.

Tests cover:
  1. GateParams validation (__post_init__ raises ValueError for bad inputs).
  2. Barbatos guard: alpha=0 no longer causes ZeroDivisionError.
  3. GDPR fail-safe: PrivacyGate exception → STOP.
  4. Governance invariants: GDPR STOP always produces BLOCK; no BLOCK→PASS relaxation.

Run with:
    python -m tao_gate.test_fixes
"""

from __future__ import annotations

import sys
import unittest
from dataclasses import dataclass
from unittest.mock import patch

from tao_gate.gdpr_bridge import DecisionResult, GdprDecision
from tao_gate.state import GateParams, Mode, State, instability, omega_capacity
from tao_gate.supervisor import explain_decision, tao_gate_decide


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


# ── Runner ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromModule(__import__(__name__))
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
