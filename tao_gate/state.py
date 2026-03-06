"""
tao_gate/state.py — Core types for the ORFHEUSS governance kernel.

Defines:
  - Mode        : discrete modes of ORFHEUSS (PASS / HOLD / BLOCK).
  - State       : continuous state vector x = (Delta_ext, sigma_ext, omega, tau, TI).
  - GateParams  : tunable coefficients (alpha, beta, gamma, V_max, TI_min).
  - instability : V(x) = alpha * Delta_ext^2 + beta * sigma_ext^2 + gamma * omega^2.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class Mode(str, Enum):
    """
    Discrete operating modes of ORFHEUSS.

    PASS  — all constraints satisfied; execution may proceed.
    HOLD  — instability approaching V_max; execution paused pending review.
    BLOCK — one or more constraints violated; execution unconditionally stopped.
    """

    PASS = "PASS"
    HOLD = "HOLD"
    BLOCK = "BLOCK"


@dataclass(frozen=True)
class State:
    """
    Continuous state vector x for ORFHEUSS.

    Attributes
    ----------
    Delta_ext : float
        External pressure / deviation signal (Barbatos feed).
    sigma_ext : float
        External uncertainty / noise spread.
    omega : float
        Human carrying-capacity load (O36 signal).
    tau : float
        Current temporal reference point (mandate horizon).
    TI : float
        Temporal integrity index — must stay >= TI_min.
    """

    Delta_ext: float
    sigma_ext: float
    omega: float
    tau: float
    TI: float


@dataclass(frozen=True)
class GateParams:
    """
    Tunable coefficients for the TaoGate supervisor.

    Attributes
    ----------
    alpha : float
        Weight of Delta_ext^2 in V(x).  Must be >= 0.
    beta : float
        Weight of sigma_ext^2 in V(x).  Must be >= 0.
    gamma : float
        Weight of omega^2 in V(x).  Must be >= 0.
    V_max : float
        Upper bound of the safety invariant set S.  Must be > 0.
    V_hold_ratio : float
        Fraction of V_max at which HOLD is triggered.
        Must satisfy 0 < V_hold_ratio < 1.
    TI_min : float
        Minimum acceptable temporal integrity index.  Must be >= 0.

    Raises
    ------
    ValueError
        If any parameter is outside its valid range.
    """

    alpha: float = 1.0
    beta: float = 1.0
    gamma: float = 1.0
    V_max: float = 10.0
    V_hold_ratio: float = 0.75
    TI_min: float = 0.5

    def __post_init__(self) -> None:
        if self.alpha < 0:
            raise ValueError(f"alpha must be >= 0, got {self.alpha!r}")
        if self.beta < 0:
            raise ValueError(f"beta must be >= 0, got {self.beta!r}")
        if self.gamma < 0:
            raise ValueError(f"gamma must be >= 0, got {self.gamma!r}")
        if self.V_max <= 0:
            raise ValueError(f"V_max must be > 0, got {self.V_max!r}")
        if not (0.0 < self.V_hold_ratio < 1.0):
            raise ValueError(
                f"V_hold_ratio must be in (0, 1), got {self.V_hold_ratio!r}"
            )
        if self.TI_min < 0:
            raise ValueError(f"TI_min must be >= 0, got {self.TI_min!r}")


def instability(state: State, params: GateParams) -> float:
    """
    Compute the instability measure V(x).

    V(x) = alpha * Delta_ext^2 + beta * sigma_ext^2 + gamma * omega^2

    Parameters
    ----------
    state : State
        The current continuous state vector.
    params : GateParams
        Coefficients alpha, beta, gamma.

    Returns
    -------
    float
        Non-negative scalar representing system instability.
    """
    return (
        params.alpha * state.Delta_ext ** 2
        + params.beta * state.sigma_ext ** 2
        + params.gamma * state.omega ** 2
    )


def omega_capacity(state: State) -> float:
    """
    Compute the O36 human carrying-capacity bound.

    The bound is defined as max(0, tau - sigma_ext), reflecting that
    available human bandwidth shrinks as external uncertainty grows.

    Parameters
    ----------
    state : State
        The current continuous state vector.

    Returns
    -------
    float
        Maximum permissible omega value.
    """
    return max(0.0, state.tau - state.sigma_ext)
