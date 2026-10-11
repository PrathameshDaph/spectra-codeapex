import numpy as np
from typing import Dict, List, Tuple, Any

class FloorClassifier:
    """
    Two-stage 2.5D Floor Classifier.
    Estimates discrete Floor ID (1, 2, or 3) and posterior confidence
    using multi-floor anchor consistency, 3D residual fitting, and vertical altitude evidence.
    Includes temporal hysteresis to eliminate floor fluttering.
    """
    def __init__(self, floor_height_m: float = 3.5):
        self.floor_height_m = floor_height_m
        self.current_floor: int = 2
        self.consecutive_count: int = 0
        self.last_candidate_floor: int = 2
        self.floor_heights: Dict[int, float] = {
            1: 1.2,
            2: 1.2 + floor_height_m,
            3: 1.2 + 2 * floor_height_m
        }

    def classify_floor(
        self,
        anchors_by_floor: Dict[int, List[Dict[str, Any]]],
        measurements: Dict[str, float],
        estimated_z: float,
        previous_floor: int
    ) -> Tuple[int, float, Dict[int, float]]:
        """
        Calculates floor probabilities across Floor 1, Floor 2, Floor 3.
        Returns: (selected_floor, confidence, floor_probabilities)
        """
        floor_scores = {}
        
        for f_id in [1, 2, 3]:
            f_anchors = anchors_by_floor.get(f_id, [])
            active_f_ranges = []
            
            for anc in f_anchors:
                aid = anc["id"]
                if aid in measurements and measurements[aid] is not None:
                    active_f_ranges.append(measurements[aid])
            
            # 1. Anchor presence score (anchors on current floor have higher packet reception)
            n_received = len(active_f_ranges)
            n_total = max(len(f_anchors), 1)
            reception_ratio = n_received / n_total
            
            # 2. Vertical altitude evidence score
            target_expected_z = self.floor_heights.get(f_id, 4.7)
            z_diff = abs(estimated_z - target_expected_z)
            # Gaussian score for vertical distance (sigma = 1.2m)
            z_score = np.exp(-0.5 * (z_diff / 1.2) ** 2)
            
            # 3. Floor continuity prior (slight bonus for current floor to resist flutter)
            continuity_prior = 1.15 if f_id == previous_floor else 1.0
            
            # Combined unnormalized score
            score = (reception_ratio * 0.45 + z_score * 0.55) * continuity_prior
            floor_scores[f_id] = max(score, 1e-4)

        # Softmax normalization
        total_score = sum(floor_scores.values())
        probabilities = {f: float(floor_scores[f] / total_score) for f in floor_scores}
        
        # Candidate is floor with highest probability
        candidate_floor = max(probabilities, key=probabilities.get)
        confidence = probabilities[candidate_floor]
        
        # Temporal Hysteresis:
        # Require candidate to win with confidence >= 0.65 or repeat twice before switching
        if candidate_floor != self.current_floor:
            if candidate_floor == self.last_candidate_floor:
                self.consecutive_count += 1
                if self.consecutive_count >= 2 or confidence > 0.82:
                    self.current_floor = candidate_floor
                    self.consecutive_count = 0
            else:
                self.last_candidate_floor = candidate_floor
                self.consecutive_count = 1
        else:
            self.last_candidate_floor = candidate_floor
            self.consecutive_count = 0
            
        return self.current_floor, float(confidence), probabilities
