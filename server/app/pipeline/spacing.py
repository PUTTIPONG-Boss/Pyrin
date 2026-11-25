"""Spacing curves: decide where each drawing sits between two keys."""

import numpy as np


def linear(x: np.ndarray) -> np.ndarray:
    return x


def ease_in_out(x: np.ndarray, power: float = 2.0) -> np.ndarray:
    return np.where(x < 0.5,
                    0.5 * (2 * x) ** power,
                    1 - 0.5 * (2 * (1 - x)) ** power)


def pick_drawings(dense: list[np.ndarray], n_drawings: int,
                  curve=ease_in_out) -> list[np.ndarray]:
    """Select n_drawings frames from evenly spaced model output, spaced by curve."""
    ts = curve(np.linspace(0, 1, n_drawings))
    idx = np.round(ts * (len(dense) - 1)).astype(int)
    return [dense[i] for i in idx]
