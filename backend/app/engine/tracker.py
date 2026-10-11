import numpy as np
from typing import Dict, List, Tuple, Any

class AdaptiveExtendedKalmanFilter:
    """
    Adaptive Extended Kalman Filter (EKF) with Trust-Scaled Measurement Covariance.
    Tracks 2D position and velocity [x, y, vx, vy]^T.
    Dynamically scales measurement noise R_i inversely with anchor trust T_i,
    preventing NLOS biases or outliers from corrupting trajectory continuity.
    """
    def __init__(self, dt: float = 0.1, q_var: float = 0.4, r_base_var: float = 0.04):
        self.dt = dt
        self.state = np.array([25.0, 15.0, 0.0, 0.0], dtype=float)  # x, y, vx, vy
        self.P = np.eye(4) * 1.5
        
        # State transition matrix F
        self.F = np.array([
            [1.0, 0.0, dt,  0.0],
            [0.0, 1.0, 0.0, dt ],
            [0.0, 0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 1.0]
        ])
        
        # Continuous-white-noise process noise Q
        dt2 = dt**2 / 2.0
        G = np.array([
            [dt2, 0.0],
            [0.0, dt2],
            [dt,  0.0],
            [0.0, dt ]
        ])
        self.Q = (G @ G.T) * q_var
        self.r_base_var = r_base_var

    def reset(self, initial_x: float = 25.0, initial_y: float = 15.0):
        self.state = np.array([initial_x, initial_y, 0.0, 0.0], dtype=float)
        self.P = np.eye(4) * 1.5

    def predict(self) -> np.ndarray:
        """Predict step of EKF."""
        self.state = self.F @ self.state
        self.P = self.F @ self.P @ self.F.T + self.Q
        return self.state[:2]

    def update(
        self,
        anchors: List[Dict[str, Any]],
        measured_ranges: Dict[str, float],
        trust_weights: Dict[str, float]
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Update step with dynamic trust-weighted R covariance.
        Excludes completely rejected anchors (trust < 0.08).
        """
        valid_anchors = []
        z_list = []
        r_list = []
        
        for anc in anchors:
            aid = anc["id"]
            if aid in measured_ranges and measured_ranges[aid] is not None:
                tw = trust_weights.get(aid, 1.0)
                if tw >= 0.08:  # Only fuse non-rejected measurements
                    valid_anchors.append(anc)
                    z_list.append(measured_ranges[aid])
                    # Dynamic Covariance Scaling:
                    # Variance scales inversely with squared trust weight
                    scaled_variance = self.r_base_var / (tw ** 2)
                    r_list.append(scaled_variance)

        if len(valid_anchors) == 0:
            # No valid measurements: coast on dead-reckoning state
            return self.state[:2], self.P[:2, :2]

        m = len(valid_anchors)
        z = np.array(z_list)
        R = np.diag(r_list)
        
        # Compute predicted measurements h(x) and Jacobian H
        px, py = self.state[0], self.state[1]
        h_x = np.zeros(m)
        H = np.zeros((m, 4))
        
        for i, anc in enumerate(valid_anchors):
            ax, ay = anc["x"], anc["y"]
            d = float(np.sqrt((px - ax)**2 + (py - ay)**2))
            d_safe = max(d, 1e-4)
            h_x[i] = d
            H[i, 0] = (px - ax) / d_safe
            H[i, 1] = (py - ay) / d_safe
            H[i, 2] = 0.0
            H[i, 3] = 0.0

        # Innovation residual
        y = z - h_x
        
        # Innovation covariance S = H P H^T + R
        S = H @ self.P @ H.T + R
        
        # Kalman Gain K = P H^T S^-1
        try:
            K = self.P @ H.T @ np.linalg.pinv(S)
            # State update
            self.state = self.state + K @ y
            # Joseph form covariance update for numerical stability: (I - KH)P(I - KH)^T + KRK^T
            I_KH = np.eye(4) - K @ H
            self.P = I_KH @ self.P @ I_KH.T + K @ R @ K.T
        except Exception:
            pass

        return self.state[:2], self.P[:2, :2]
