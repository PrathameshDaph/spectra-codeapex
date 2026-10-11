import numpy as np
import time
from typing import Dict, List, Any, Optional, Tuple

from app.models import (
    AnchorConfig, Measurement, PositionEstimate, GroundTruth,
    SelfDiagnosisReport, AdaptiveAction, TelemetryFrame, SimulationConfig
)
from app.engine.positioning import solve_ols_position, solve_robust_position
from app.engine.floor_classifier import FloorClassifier
from app.engine.self_diagnosis import SelfDiagnosisEngine
from app.engine.tracker import AdaptiveExtendedKalmanFilter
from app.engine.adaptive_recommender import AdaptiveMeasurementRecommender

class IndoorSimulator:
    """
    Realistic Indoor Positioning Simulator.
    Simulates multi-floor building dynamics, realistic multipath NLOS propagation,
    packet losses, anchor faults, and runs OLS vs Robust vs SPECTRA side-by-side.
    """
    def __init__(self, config: Optional[SimulationConfig] = None):
        self.config = config or SimulationConfig()
        self.epoch = 0
        self.start_time = time.time()
        
        # Floor Map Dimensions (50m x 30m)
        self.map_width = 50.0
        self.map_height = 30.0
        
        # Initialize anchors across 3 floors
        self.anchors: Dict[int, List[Dict[str, Any]]] = self._create_default_anchors()
        
        # Simulation State
        self.target_floor = self.config.floor_id
        self.target_x = 10.0
        self.target_y = 15.0
        self.target_z = 1.2 + (self.target_floor - 1) * 3.5
        self.target_vx = 0.8
        self.target_vy = 0.4
        
        # Waypoints for patrol path
        self.patrol_waypoints = [
            (8.0, 6.0), (32.0, 6.0), (42.0, 15.0),
            (38.0, 24.0), (14.0, 24.0), (6.0, 15.0)
        ]
        self.current_wp_idx = 0
        
        # Components
        self.floor_classifier = FloorClassifier(floor_height_m=3.5)
        self.self_diagnosis = SelfDiagnosisEngine(
            base_noise_sigma=self.config.noise_sigma,
            nlos_threshold_m=1.1,
            outlier_threshold_m=3.2
        )
        self.tracker = AdaptiveExtendedKalmanFilter(dt=0.1, q_var=0.35, r_base_var=0.04)
        self.recommender = AdaptiveMeasurementRecommender()
        
        # Last known positions for warm starts
        self.last_ols_pos = np.array([self.target_x, self.target_y])
        self.last_robust_pos = np.array([self.target_x, self.target_y])
        self.last_spectra_pos = np.array([self.target_x, self.target_y])

    def _create_default_anchors(self) -> Dict[int, List[Dict[str, Any]]]:
        """Predefined anchor constellations for 3 building floors."""
        return {
            1: [
                {"id": "F1-A1", "name": "F1 Lobby North", "floor_id": 1, "x": 6.0, "y": 6.0, "z": 2.8, "status": "active"},
                {"id": "F1-A2", "name": "F1 East Corridor", "floor_id": 1, "x": 44.0, "y": 6.0, "z": 2.8, "status": "active"},
                {"id": "F1-A3", "name": "F1 Central Hub", "floor_id": 1, "x": 25.0, "y": 15.0, "z": 3.0, "status": "active"},
                {"id": "F1-A4", "name": "F1 Logistics West", "floor_id": 1, "x": 6.0, "y": 24.0, "z": 2.8, "status": "active"},
                {"id": "F1-A5", "name": "F1 Dock South", "floor_id": 1, "x": 44.0, "y": 24.0, "z": 2.8, "status": "active"},
            ],
            2: [
                {"id": "F2-A1", "name": "Anchor A1 (NW Corner)", "floor_id": 2, "x": 6.0, "y": 6.0, "z": 2.8, "status": "active"},
                {"id": "F2-A2", "name": "Anchor A2 (NE Corner)", "floor_id": 2, "x": 44.0, "y": 6.0, "z": 2.8, "status": "active"},
                {"id": "F2-A3", "name": "Anchor A3 (East Pillar)", "floor_id": 2, "x": 38.0, "y": 18.0, "z": 2.8, "status": "active"},
                {"id": "F2-A4", "name": "Anchor A4 (SW Office)", "floor_id": 2, "x": 6.0, "y": 24.0, "z": 2.8, "status": "active"},
                {"id": "F2-A5", "name": "Anchor A5 (SE Lab)", "floor_id": 2, "x": 44.0, "y": 24.0, "z": 2.8, "status": "active"},
                {"id": "F2-A6", "name": "Anchor A6 (Atrium Center)", "floor_id": 2, "x": 25.0, "y": 14.0, "z": 3.2, "status": "active"},
            ],
            3: [
                {"id": "F3-A1", "name": "F3 Server North", "floor_id": 3, "x": 8.0, "y": 6.0, "z": 2.8, "status": "active"},
                {"id": "F3-A2", "name": "F3 Boardroom", "floor_id": 3, "x": 42.0, "y": 6.0, "z": 2.8, "status": "active"},
                {"id": "F3-A3", "name": "F3 Sky Lounge", "floor_id": 3, "x": 25.0, "y": 15.0, "z": 3.0, "status": "active"},
                {"id": "F3-A4", "name": "F3 West Terrace", "floor_id": 3, "x": 8.0, "y": 24.0, "z": 2.8, "status": "active"},
                {"id": "F3-A5", "name": "F3 Executive Suite", "floor_id": 3, "x": 42.0, "y": 24.0, "z": 2.8, "status": "active"},
            ]
        }

    def update_config(self, new_cfg: SimulationConfig):
        self.config = new_cfg
        self.self_diagnosis.base_noise_sigma = new_cfg.noise_sigma

    def toggle_anchor_status(self, anchor_id: str, new_status: str):
        for f_id in self.anchors:
            for anc in self.anchors[f_id]:
                if anc["id"] == anchor_id:
                    anc["status"] = new_status
                    return True
        return False

    def _update_ground_truth(self):
        """Simulate physical movement of the indoor target."""
        speed = self.config.speed_mps * 0.1  # dt = 0.1s

        if self.config.motion_pattern == "patrol":
            target_wp = self.patrol_waypoints[self.current_wp_idx]
            dx = target_wp[0] - self.target_x
            dy = target_wp[1] - self.target_y
            dist = np.sqrt(dx**2 + dy**2)
            
            if dist < 1.2:
                self.current_wp_idx = (self.current_wp_idx + 1) % len(self.patrol_waypoints)
            else:
                self.target_vx = (dx / dist) * self.config.speed_mps
                self.target_vy = (dy / dist) * self.config.speed_mps
                self.target_x += self.target_vx * 0.1
                self.target_y += self.target_vy * 0.1

        elif self.config.motion_pattern == "random_walk":
            self.target_vx += np.random.normal(0, 0.2)
            self.target_vy += np.random.normal(0, 0.2)
            # Clip speed
            v_norm = np.sqrt(self.target_vx**2 + self.target_vy**2)
            if v_norm > self.config.speed_mps:
                self.target_vx = (self.target_vx / v_norm) * self.config.speed_mps
                self.target_vy = (self.target_vy / v_norm) * self.config.speed_mps
            self.target_x += self.target_vx * 0.1
            self.target_y += self.target_vy * 0.1

        elif self.config.motion_pattern == "stop_and_go":
            if (self.epoch // 30) % 2 == 0:
                # Moving
                self.target_x += self.target_vx * 0.1
                self.target_y += self.target_vy * 0.1
            else:
                # Stopped
                pass

        elif self.config.motion_pattern == "multi_floor_transition":
            # Move towards stairwell at (45, 15) and change floors
            dx = 44.0 - self.target_x
            dy = 15.0 - self.target_y
            dist = np.sqrt(dx**2 + dy**2)
            if dist > 1.5:
                self.target_x += (dx / dist) * speed
                self.target_y += (dy / dist) * speed
            else:
                # Ascend/descend stairs smoothly
                if self.epoch % 80 == 0:
                    self.target_floor = 3 if self.target_floor == 2 else (1 if self.target_floor == 3 else 2)
                    self.target_z = 1.2 + (self.target_floor - 1) * 3.5

        # Keep inside building bounds
        self.target_x = float(np.clip(self.target_x, 4.0, self.map_width - 4.0))
        self.target_y = float(np.clip(self.target_y, 4.0, self.map_height - 4.0))
        self.target_z = 1.2 + (self.target_floor - 1) * 3.5

    def step(self) -> TelemetryFrame:
        """Advance simulation by 1 epoch (100ms) and run full positioning pipelines."""
        self.epoch += 1
        t_now = time.time()
        
        # 1. Physical motion update
        self._update_ground_truth()
        gt = GroundTruth(
            floor_id=self.target_floor,
            x=round(self.target_x, 2),
            y=round(self.target_y, 2),
            z=round(self.target_z, 2),
            vx=round(self.target_vx, 2),
            vy=round(self.target_vy, 2)
        )

        # 2. Generate RF range measurements with noise, NLOS, and packet loss
        current_floor_anchors = self.anchors.get(self.target_floor, [])
        raw_ranges: Dict[str, float] = {}
        measurements_list: List[Measurement] = []
        
        for anc in current_floor_anchors:
            aid = anc["id"]
            ax, ay, az = anc["x"], anc["y"], anc["z"]
            
            # True 3D geometric distance
            d_true = float(np.sqrt((self.target_x - ax)**2 + (self.target_y - ay)**2 + (self.target_z - az)**2))
            
            # Check disabled / offline status
            is_offline = anc.get("status") == "offline" or aid in self.config.disabled_anchors
            
            # Check packet loss
            is_dropped = np.random.random() < self.config.packet_loss_rate
            
            if is_offline or is_dropped:
                measurements_list.append(Measurement(
                    anchor_id=aid,
                    raw_distance=0.0,
                    true_distance=round(d_true, 3),
                    is_dropped=True,
                    status="dropped" if not is_offline else "offline",
                    diagnosis_reason="Hardware offline or packet drop" if is_offline else "RF packet dropped in transmission"
                ))
                continue

            # Additive Gaussian noise
            noise = float(np.random.normal(0, self.config.noise_sigma))
            
            # Non-Line-of-Sight (NLOS) bias injection
            # Always positive because multipath reflection delays arrival time
            nlos = 0.0
            is_nlos = False
            
            # Check if this anchor is explicitly targeted for NLOS or in obstructed zone
            if (self.config.nlos_target_anchor and (self.config.nlos_target_anchor in aid or aid == self.config.nlos_target_anchor)) or (anc.get("status") == "nlos"):
                nlos = float(self.config.nlos_bias + np.random.exponential(0.3))
                is_nlos = True
            elif self.config.nlos_bias > 0 and aid in ["F2-A3", "F1-A3", "F3-A3"]:
                # Natural obstruction by central concrete elevator core
                nlos = float(self.config.nlos_bias * 0.75)
                is_nlos = True

            measured_d = float(d_true + noise + nlos)
            measured_d = max(measured_d, 0.5)
            raw_ranges[aid] = measured_d

            measurements_list.append(Measurement(
                anchor_id=aid,
                raw_distance=round(measured_d, 3),
                true_distance=round(d_true, 3),
                is_nlos=is_nlos,
                status="normal"
            ))

        # 3. Stage 1: Floor Classification (2.5D)
        # Barometric height proxy with noise
        baro_z = self.target_z + float(np.random.normal(0, 0.35))
        est_floor, floor_conf, floor_probs = self.floor_classifier.classify_floor(
            self.anchors,
            raw_ranges,
            baro_z,
            self.target_floor
        )

        # 4. Multilateration Preparation
        active_anchor_objs = [a for a in current_floor_anchors if a["id"] in raw_ranges]
        anchor_coords = np.array([[a["x"], a["y"]] for a in active_anchor_objs])
        range_vector = np.array([raw_ranges[a["id"]] for a in active_anchor_objs])

        # 5. Baseline: Solve Ordinary Least Squares (OLS)
        if len(range_vector) >= 3:
            ols_res = solve_ols_position(anchor_coords, range_vector, self.last_ols_pos)
            self.last_ols_pos = np.array([ols_res["x"], ols_res["y"]])
        else:
            ols_res = {
                "x": float(self.last_ols_pos[0]), "y": float(self.last_ols_pos[1]),
                "confidence": 0.15, "semi_major": 6.0, "semi_minor": 6.0, "angle_deg": 0.0,
                "gdop": 20.0, "residuals": [0.0] * len(range_vector), "computation_time_ms": 0.5
            }

        ols_estimate = PositionEstimate(
            floor_id=est_floor,
            x=round(ols_res["x"], 2),
            y=round(ols_res["y"], 2),
            confidence=round(ols_res["confidence"], 2),
            uncertainty_semi_major=round(ols_res["semi_major"], 2),
            uncertainty_semi_minor=round(ols_res["semi_minor"], 2),
            uncertainty_angle_deg=round(ols_res["angle_deg"], 1),
            gdop=round(ols_res["gdop"], 2),
            algorithm="ols",
            computation_time_ms=round(ols_res["computation_time_ms"], 2)
        )

        # 6. Self-Diagnosis: Assess Measurement Trust & NLOS
        trust_weights, diag_report, explanations = self.self_diagnosis.diagnose_measurements(
            current_floor_anchors,
            raw_ranges,
            (ols_res["x"], ols_res["y"]),
            ols_res["gdop"]
        )

        # Update measurement objects with diagnosed trust & residuals
        for m in measurements_list:
            if m.anchor_id in diag_report["per_anchor_diagnostics"]:
                diag = diag_report["per_anchor_diagnostics"][m.anchor_id]
                m.trust_weight = diag["trust_weight"]
                m.residual = diag["residual"]
                m.is_nlos = diag["is_nlos"]
                m.is_outlier = diag["is_outlier"]
                m.status = diag["status"]
                m.diagnosis_reason = diag["reason"]

        # 7. Robust Estimator (Soft-L1 with Trust Weights)
        weights_arr = np.array([trust_weights.get(a["id"], 1.0) for a in active_anchor_objs])
        if len(range_vector) >= 3:
            robust_res = solve_robust_position(
                anchor_coords,
                range_vector,
                weights_arr,
                self.last_robust_pos,
                loss_function='soft_l1'
            )
            self.last_robust_pos = np.array([robust_res["x"], robust_res["y"]])
        else:
            robust_res = {
                "x": float(self.last_robust_pos[0]), "y": float(self.last_robust_pos[1]),
                "confidence": 0.20, "semi_major": 5.0, "semi_minor": 5.0, "angle_deg": 0.0,
                "gdop": 15.0, "residuals": [0.0] * len(range_vector), "computation_time_ms": 0.6
            }

        robust_estimate = PositionEstimate(
            floor_id=est_floor,
            x=round(robust_res["x"], 2),
            y=round(robust_res["y"], 2),
            confidence=round(robust_res["confidence"], 2),
            uncertainty_semi_major=round(robust_res["semi_major"], 2),
            uncertainty_semi_minor=round(robust_res["semi_minor"], 2),
            uncertainty_angle_deg=round(robust_res["angle_deg"], 1),
            gdop=round(robust_res["gdop"], 2),
            algorithm="robust",
            computation_time_ms=round(robust_res["computation_time_ms"], 2)
        )

        # 8. SPECTRA Full Pipeline: Adaptive EKF Tracking
        self.tracker.predict()
        tracked_xy, tracked_P = self.tracker.update(
            active_anchor_objs,
            raw_ranges,
            trust_weights
        )
        self.last_spectra_pos = tracked_xy

        # SPECTRA uncertainty from EKF covariance
        from app.engine.positioning import compute_uncertainty_ellipse
        s_major, s_minor, s_angle = compute_uncertainty_ellipse(tracked_P)
        spectra_conf = float(np.clip(diag_report["system_confidence"] * 0.9 + 0.1, 0.1, 0.99))

        spectra_estimate = PositionEstimate(
            floor_id=est_floor,
            x=round(float(tracked_xy[0]), 2),
            y=round(float(tracked_xy[1]), 2),
            confidence=round(spectra_conf, 2),
            uncertainty_semi_major=round(s_major, 2),
            uncertainty_semi_minor=round(s_minor, 2),
            uncertainty_angle_deg=round(s_angle, 1),
            gdop=round(robust_res["gdop"], 2),
            algorithm="spectra_ekf",
            computation_time_ms=round(robust_res["computation_time_ms"] + 0.35, 2)
        )

        # 9. Adaptive Measurement Recommender
        action_dict = self.recommender.evaluate_recommendation(
            (float(tracked_xy[0]), float(tracked_xy[1])),
            active_anchor_objs,
            current_floor_anchors,
            trust_weights,
            robust_res["gdop"],
            spectra_conf,
            est_floor,
            floor_conf
        )
        adaptive_action = AdaptiveAction(**action_dict)

        # 10. Instantaneous Position Errors
        err_ols = float(np.sqrt((ols_estimate.x - gt.x)**2 + (ols_estimate.y - gt.y)**2))
        err_robust = float(np.sqrt((robust_estimate.x - gt.x)**2 + (robust_estimate.y - gt.y)**2))
        err_spectra = float(np.sqrt((spectra_estimate.x - gt.x)**2 + (spectra_estimate.y - gt.y)**2))

        diagnosis_obj = SelfDiagnosisReport(**diag_report)

        return TelemetryFrame(
            timestamp=round(t_now, 2),
            epoch=self.epoch,
            ground_truth=gt,
            ols_estimate=ols_estimate,
            robust_estimate=robust_estimate,
            spectra_estimate=spectra_estimate,
            measurements=measurements_list,
            diagnosis=diagnosis_obj,
            adaptive_action=adaptive_action,
            current_error_ols=round(err_ols, 3),
            current_error_robust=round(err_robust, 3),
            current_error_spectra=round(err_spectra, 3),
            floor_classification_confidence=round(floor_conf, 2)
        )
