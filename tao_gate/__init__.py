"""
tao_gate — ORFHEUSS Governance Kernel
======================================
ORFHEUSS operates as a Hybrid Dynamical System (HDS) with three discrete modes
(PASS, HOLD, BLOCK). TaoGate is the supervisory controller that decides which
mode to enter based on a continuous state vector x and external legitimacy/GDPR
checks. The safety invariant V(x) <= V_max bounds instability. If GDPR signals
STOP, TaoGate unconditionally emits BLOCK, ensuring no override is possible.
INUIT · BIOLOGY is a pre-reflexive context sensor: Siku = 0 prevents PASS.
DYMPHNA is a cumulative-load sensor: D_l > D_k^e forces BLOCK.
Valkyrie layer provides user-exposure guards: even when HDS mode is PASS,
both Valkyrie INUIT (field access & timing) and Valkyrie UX (ethics firewall)
must clear before any outcome may reach a human.
All logic is pure Python (stdlib only), deterministic and side-effect free.
"""

from tao_gate.state import Mode, State
from tao_gate.supervisor import tao_gate_decide
from tao_gate.gdpr_bridge import GdprDecision, gdpr_personal_data_check
from tao_gate.inuit import InuitSignal, inuit_context_check
from tao_gate.dymphna import DymphnaSignal, dymphna_check
from tao_gate.valkyrie import (
    ValkyrieStatus,
    ValkyrieSignal,
    valkyrie_inuit_check,
    valkyrie_ux_check,
    user_exposure_check,
)

__all__ = [
    "Mode",
    "State",
    "tao_gate_decide",
    "GdprDecision",
    "gdpr_personal_data_check",
    "InuitSignal",
    "inuit_context_check",
    "DymphnaSignal",
    "dymphna_check",
    "ValkyrieStatus",
    "ValkyrieSignal",
    "valkyrie_inuit_check",
    "valkyrie_ux_check",
    "user_exposure_check",
]
