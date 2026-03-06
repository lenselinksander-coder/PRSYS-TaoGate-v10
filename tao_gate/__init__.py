"""
tao_gate — ORFHEUSS Governance Kernel
======================================
ORFHEUSS operates as a Hybrid Dynamical System (HDS) with three discrete modes
(PASS, HOLD, BLOCK). TaoGate is the supervisory controller that decides which
mode to enter based on a continuous state vector x and external legitimacy/GDPR
checks. The safety invariant V(x) <= V_max bounds instability. If GDPR signals
STOP, TaoGate unconditionally emits BLOCK, ensuring no override is possible.
All logic is pure Python (stdlib only), deterministic and side-effect free.
"""

from tao_gate.state import Mode, State
from tao_gate.supervisor import tao_gate_decide
from tao_gate.gdpr_bridge import GdprDecision, gdpr_personal_data_check

__all__ = [
    "Mode",
    "State",
    "tao_gate_decide",
    "GdprDecision",
    "gdpr_personal_data_check",
]
