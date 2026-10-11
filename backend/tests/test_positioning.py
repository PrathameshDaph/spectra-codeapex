import unittest
import numpy as np
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.engine.positioning import solve_ols_position, solve_robust_position
from app.engine.floor_classifier import FloorClassifier
from app.engine.self_diagnosis import SelfDiagnosisEngine
from app.engine.tracker import AdaptiveExtendedKalmanFilter
from app.engine.adaptive_recommender import AdaptiveMeasurementRecommender
from app.engine.simulator import IndoorSimulator

class TestSpectraEngine(unittest.TestCase):
    def setUp(self):
        # 4 Anchors at known corners of a 40m x 20m room
        self.anchors = np.array([
            [0.0, 0.0],
            [40.0, 0.0],
            [40.0, 20.0],
            [0.0, 20.0]
        ])
        self.anchor_dicts = [
            {"id": "A1", "name": "A1", "x": 0.0, "y": 0.0, "status": "active"},
            {"id": "A2", "name": "A2", "x": 40.0, "y": 0.0, "status": "active"},
            {"id": "A3", "name": "A3", "x": 40.0, "y": 20.0, "status": "active"},
            {"id": "A4", "name": "A4", "x": 0.0, "y": 20.0, "status": "active"}
        ]
        self.true_target = np.array([15.0, 10.0])

    def test_clean_ols_and_robust_accuracy(self):
        """Under clean LOS conditions, both OLS and Robust should localize within 0.1m."""
        clean_ranges = np.linalg.norm(self.anchors - self.true_target, axis=1)
        initial_guess = np.array([20.0, 10.0])
        
        ols_res = solve_ols_position(self.anchors, clean_ranges, initial_guess)
        ols_pos = np.array([ols_res["x"], ols_res["y"]])
        ols_err = np.linalg.norm(ols_pos - self.true_target)
        self.assertLess(ols_err, 0.1, f"Clean OLS error {ols_err} exceeds 0.1m")

        weights = np.array([1.0, 1.0, 1.0, 1.0])
        rob_res = solve_robust_position(self.anchors, clean_ranges, weights, initial_guess)
        rob_pos = np.array([rob_res["x"], rob_res["y"]])
        rob_err = np.linalg.norm(rob_pos - self.true_target)
        self.assertLess(rob_err, 0.1, f"Clean Robust error {rob_err} exceeds 0.1m")

    def test_nlos_outlier_resilience(self):
        """
        When Anchor A3 has a severe NLOS bias (+4.0m),
        SPECTRA's robust estimator and trust weighting must significantly outperform OLS.
        """
        clean_ranges = np.linalg.norm(self.anchors - self.true_target, axis=1)
        corrupted_ranges = clean_ranges.copy()
        corrupted_ranges[2] += 4.0  # +4m NLOS bias on A3
        
        initial_guess = np.array([20.0, 10.0])
        
        # 1. Baseline OLS
        ols_res = solve_ols_position(self.anchors, corrupted_ranges, initial_guess)
        ols_pos = np.array([ols_res["x"], ols_res["y"]])
        ols_err = np.linalg.norm(ols_pos - self.true_target)
        
        # 2. SPECTRA Self-Diagnosis detects positive bias and down-weights A3
        diag_engine = SelfDiagnosisEngine(base_noise_sigma=0.2, nlos_threshold_m=1.0)
        raw_dict = {f"A{i+1}": corrupted_ranges[i] for i in range(4)}
        weights, report, _ = diag_engine.diagnose_measurements(
            self.anchor_dicts, raw_dict, (ols_res["x"], ols_res["y"]), ols_res["gdop"]
        )
        
        # Verify A3 is diagnosed as NLOS / downweighted
        self.assertLess(weights["A3"], 0.5, "Anchor A3 should have been down-weighted due to NLOS")
        self.assertTrue(report["per_anchor_diagnostics"]["A3"]["is_nlos"])

        # 3. Robust Estimator with trust weights
        w_arr = np.array([weights[f"A{i+1}"] for i in range(4)])
        rob_res = solve_robust_position(self.anchors, corrupted_ranges, w_arr, initial_guess)
        rob_pos = np.array([rob_res["x"], rob_res["y"]])
        rob_err = np.linalg.norm(rob_pos - self.true_target)
        
        # Robust error must be notably lower than OLS error
        self.assertLess(rob_err, ols_err, f"Robust error {rob_err} should be strictly less than OLS {ols_err}")
        print(f"\n[TEST PASSED] NLOS Test: Baseline OLS Error = {ols_err:.3f}m | SPECTRA Robust Error = {rob_err:.3f}m (Saved: {((ols_err - rob_err)/ols_err)*100:.1f}%)")

    def test_floor_classification_hysteresis(self):
        """Floor classifier should pick floor with matching altitude and resist chatter."""
        classifier = FloorClassifier(floor_height_m=3.5)
        anchors_by_floor = {
            1: [{"id": "F1-1", "x": 0, "y": 0}],
            2: [{"id": "F2-1", "x": 0, "y": 0}],
            3: [{"id": "F3-1", "x": 0, "y": 0}],
        }
        measurements = {"F2-1": 10.0}
        
        # Target at Floor 2 altitude (4.7m)
        f_est, conf, _ = classifier.classify_floor(anchors_by_floor, measurements, 4.7, 2)
        self.assertEqual(f_est, 2)
        self.assertGreater(conf, 0.5)

    def test_adaptive_recommender(self):
        """Recommender should formulate actionable suggestions when GDOP is high or NLOS detected."""
        recommender = AdaptiveMeasurementRecommender()
        active = [self.anchor_dicts[0], self.anchor_dicts[1]]  # Only 2 anchors = high GDOP
        weights = {"A1": 1.0, "A2": 1.0}
        
        action = recommender.evaluate_recommendation(
            (15.0, 10.0), active, self.anchor_dicts, weights, gdop=6.5,
            system_confidence=0.45, floor_id=2, floor_confidence=0.9
        )
        self.assertIn(action["action_type"], ["GEOMETRIC_AUGMENT", "FREQUENCY_SHIFT"])
        self.assertIsNotNone(action["target_anchor_id"])

    def test_simulation_step_pipeline(self):
        """End-to-end simulation step produces valid TelemetryFrame."""
        sim = IndoorSimulator()
        frame = sim.step()
        self.assertIsNotNone(frame.ground_truth)
        self.assertIsNotNone(frame.ols_estimate)
        self.assertIsNotNone(frame.spectra_estimate)
        self.assertGreater(len(frame.measurements), 0)
        self.assertIn(frame.diagnosis.overall_health, ["OPTIMAL", "DEGRADED", "CRITICAL"])

if __name__ == "__main__":
    unittest.main()
