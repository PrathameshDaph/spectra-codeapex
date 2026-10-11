import numpy as np
from scipy.optimize import least_squares
import time
from typing import List, Tuple, Dict, Any, Optional

def compute_gdop(H: np.ndarray) -> float:
    """Compute Geometric Dilution of Precision from Jacobian H."""
    if H.shape[0] < 2:
        return 99.9
    try:
        HTH = H.T @ H
        inv_HTH = np.linalg.pinv(HTH)
        gdop = np.sqrt(np.trace(inv_HTH))
        return float(np.clip(gdop, 0.5, 99.9))
    except Exception:
        return 99.9

def compute_uncertainty_ellipse(cov: np.ndarray, confidence: float = 0.95) -> Tuple[float, float, float]:
    """
    Compute semi-major axis, semi-minor axis, and orientation angle (degrees)
    from a 2x2 covariance matrix.
    """
    try:
        # Scale for 95% confidence (chi2 with 2 DOF is ~5.991)
        scale = 2.4477  # sqrt(5.991)
        eigvals, eigvecs = np.linalg.eigh(cov)
        eigvals = np.maximum(eigvals, 1e-4)
        
        # Sort eigenvalues largest first
        order = np.argsort(eigvals)[::-1]
        eigvals = eigvals[order]
        eigvecs = eigvecs[:, order]
        
        semi_major = float(scale * np.sqrt(eigvals[0]))
        semi_minor = float(scale * np.sqrt(eigvals[1]))
        angle_rad = np.arctan2(eigvecs[1, 0], eigvecs[0, 0])
        angle_deg = float(np.degrees(angle_rad))
        
        # Clip to realistic visual boundaries
        semi_major = float(np.clip(semi_major, 0.2, 15.0))
        semi_minor = float(np.clip(semi_minor, 0.1, 15.0))
        return semi_major, semi_minor, angle_deg
    except Exception:
        return 3.0, 3.0, 0.0

def solve_ols_position(
    anchor_coords: np.ndarray,
    measured_ranges: np.ndarray,
    initial_guess: np.ndarray,
    bounds: Tuple[np.ndarray, np.ndarray] = (np.array([0.0, 0.0]), np.array([50.0, 30.0]))
) -> Dict[str, Any]:
    """
    Baseline Ordinary Least Squares (OLS) Multilateration.
    Minimizes: sum((||p - a_i|| - d_i)^2)
    All measurements have equal influence.
    """
    t0 = time.perf_counter()
    n_anchors = len(measured_ranges)
    
    if n_anchors < 3:
        # Degraded case: not enough anchors for full 2D fix
        dt = (time.perf_counter() - t0) * 1000
        return {
            "x": float(initial_guess[0]),
            "y": float(initial_guess[1]),
            "confidence": 0.20,
            "semi_major": 6.0,
            "semi_minor": 6.0,
            "angle_deg": 0.0,
            "gdop": 20.0,
            "residuals": [0.0] * n_anchors,
            "computation_time_ms": float(dt)
        }
    
    def residuals(p):
        dists = np.linalg.norm(anchor_coords - p, axis=1)
        return dists - measured_ranges

    res = least_squares(
        residuals,
        initial_guess,
        bounds=bounds,
        loss='linear',  # Standard squared loss (OLS)
        ftol=1e-5,
        xtol=1e-5,
        max_nfev=50
    )
    
    pos = res.x
    calc_dists = np.linalg.norm(anchor_coords - pos, axis=1)
    calc_res = (measured_ranges - calc_dists).tolist()
    
    # Jacobian H for GDOP and Covariance
    epsilon = 1e-6
    dists_safe = np.maximum(calc_dists, epsilon)[:, np.newaxis]
    H = (pos - anchor_coords) / dists_safe
    gdop = compute_gdop(H)
    
    # Baseline Covariance Estimate
    mse = np.mean(res.fun**2) if len(res.fun) > 0 else 0.2
    try:
        inv_HTH = np.linalg.pinv(H.T @ H)
        cov = mse * inv_HTH
    except Exception:
        cov = np.eye(2) * 2.0
        
    semi_maj, semi_min, angle = compute_uncertainty_ellipse(cov)
    conf = float(np.clip(1.0 / (1.0 + 0.25 * gdop + 0.4 * np.sqrt(mse)), 0.1, 0.99))
    dt = (time.perf_counter() - t0) * 1000

    return {
        "x": float(pos[0]),
        "y": float(pos[1]),
        "confidence": conf,
        "semi_major": semi_maj,
        "semi_minor": semi_min,
        "angle_deg": angle,
        "gdop": gdop,
        "residuals": calc_res,
        "computation_time_ms": float(dt)
    }

def solve_robust_position(
    anchor_coords: np.ndarray,
    measured_ranges: np.ndarray,
    weights: np.ndarray,
    initial_guess: np.ndarray,
    bounds: Tuple[np.ndarray, np.ndarray] = (np.array([0.0, 0.0]), np.array([50.0, 30.0])),
    loss_function: str = 'soft_l1'
) -> Dict[str, Any]:
    """
    SPECTRA Robust Multilateration with Soft-L1 / Huber loss and trust weights.
    Minimizes: sum( rho( w_i * (||p - a_i|| - d_i) ) )
    Large outlier residuals are penalized sub-linearly, preserving accuracy under NLOS.
    """
    t0 = time.perf_counter()
    n_anchors = len(measured_ranges)
    
    if n_anchors < 3:
        dt = (time.perf_counter() - t0) * 1000
        return {
            "x": float(initial_guess[0]),
            "y": float(initial_guess[1]),
            "confidence": 0.25,
            "semi_major": 5.0,
            "semi_minor": 5.0,
            "angle_deg": 0.0,
            "gdop": 15.0,
            "residuals": [0.0] * n_anchors,
            "computation_time_ms": float(dt)
        }
        
    w = np.sqrt(np.clip(weights, 0.05, 1.0))
    
    def residuals(p):
        dists = np.linalg.norm(anchor_coords - p, axis=1)
        return w * (dists - measured_ranges)

    res = least_squares(
        residuals,
        initial_guess,
        bounds=bounds,
        loss=loss_function,  # 'soft_l1' provides bounded influence against NLOS
        f_scale=0.8,         # Scale parameter for transition to linear penalty
        ftol=1e-5,
        xtol=1e-5,
        max_nfev=50
    )
    
    pos = res.x
    calc_dists = np.linalg.norm(anchor_coords - pos, axis=1)
    calc_res = (measured_ranges - calc_dists).tolist()
    
    epsilon = 1e-6
    dists_safe = np.maximum(calc_dists, epsilon)[:, np.newaxis]
    H_raw = (pos - anchor_coords) / dists_safe
    
    # Weighted Jacobian
    W_diag = np.diag(w)
    H_w = W_diag @ H_raw
    gdop = compute_gdop(H_raw)
    
    # Robust covariance estimate using weighted residual scale
    robust_var = np.median(np.abs(res.fun))**2 * 1.4826**2 if len(res.fun) > 0 else 0.1
    try:
        inv_HTH = np.linalg.pinv(H_w.T @ H_w)
        cov = robust_var * inv_HTH
    except Exception:
        cov = np.eye(2) * 1.0
        
    semi_maj, semi_min, angle = compute_uncertainty_ellipse(cov)
    conf = float(np.clip(1.0 / (1.0 + 0.18 * gdop + 0.25 * np.sqrt(robust_var)), 0.15, 0.99))
    dt = (time.perf_counter() - t0) * 1000

    return {
        "x": float(pos[0]),
        "y": float(pos[1]),
        "confidence": conf,
        "semi_major": semi_maj,
        "semi_minor": semi_min,
        "angle_deg": angle,
        "gdop": gdop,
        "residuals": calc_res,
        "computation_time_ms": float(dt)
    }
