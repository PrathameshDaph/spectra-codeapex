import numpy as np
from typing import List, Dict, Any, Tuple

class SelfDiagnosisEngine:
    """
    SPECTRA Self-Diagnosis Engine.
    Evaluates measurement reliability, isolates NLOS multipath biases,
    detects anomalies, and dynamically computes continuous trust weights [0, 1].
    Produces interpretable, operator-friendly diagnostic narratives.
    """
    def __init__(self, base_noise_sigma: float = 0.20, nlos_threshold_m: float = 1.0, outlier_threshold_m: float = 3.2):
        self.base_noise_sigma = base_noise_sigma
        self.nlos_threshold_m = nlos_threshold_m
        self.outlier_threshold_m = outlier_threshold_m
        self.residual_history: Dict[str, List[float]] = {}

    def diagnose_measurements(
        self,
        anchors: List[Dict[str, Any]],
        raw_ranges: Dict[str, float],
        estimated_pos: Tuple[float, float],
        gdop: float
    ) -> Tuple[Dict[str, float], Dict[str, Any], List[str]]:
        """
        Diagnose each anchor range against estimated position (x, y).
        Returns:
            trust_weights: Dict[anchor_id, float] in [0.0, 1.0]
            per_anchor_info: Dict[anchor_id, Dict[str, Any]]
            explanations: List[str] human-readable diagnostic messages
        """
        exx, ey = estimated_pos
        trust_weights = {}
        per_anchor_info = {}
        explanations = []
        
        n_active = 0
        n_trusted = 0
        n_rejected = 0
        n_nlos = 0

        for anc in anchors:
            aid = anc["id"]
            name = anc.get("name", aid)
            ax = anc["x"]
            ay = anc["y"]
            
            # 1. Check for missing / dropped packet
            if aid not in raw_ranges or raw_ranges[aid] is None or anc.get("status") == "offline":
                trust_weights[aid] = 0.0
                per_anchor_info[aid] = {
                    "status": "offline" if anc.get("status") == "offline" else "dropped",
                    "trust_weight": 0.0,
                    "residual": 0.0,
                    "is_nlos": False,
                    "is_outlier": False,
                    "reason": "Anchor offline / packet dropped"
                }
                explanations.append(f"Anchor {name} ({aid}): Packet missing or anchor disabled.")
                continue

            n_active += 1
            measured_d = raw_ranges[aid]
            expected_d = float(np.sqrt((exx - ax)**2 + (ey - ay)**2))
            residual = float(measured_d - expected_d)
            
            # Maintain rolling history
            if aid not in self.residual_history:
                self.residual_history[aid] = []
            self.residual_history[aid].append(residual)
            if len(self.residual_history[aid]) > 10:
                self.residual_history[aid].pop(0)

            # Analyze residual
            is_outlier = abs(residual) > self.outlier_threshold_m
            # NLOS physically manifests as positive range delay (reflection path > LOS path)
            is_nlos = residual > self.nlos_threshold_m

            # Calculate continuous trust score:
            # High trust when |residual| is near 0; heavy penalty for positive NLOS bias; 0 for extreme outlier
            if is_outlier:
                weight = 0.05
                status = "rejected"
                n_rejected += 1
                reason = f"Extreme outlier ({residual:+.2f}m residual exceeds 3σ tolerance); rejected to preserve fix integrity."
                explanations.append(f"Anchor {name}: REJECTED — {reason}")
            elif is_nlos:
                # Exponential decay based on excess distance
                excess = residual - self.nlos_threshold_m
                weight = float(np.clip(np.exp(-excess * 0.9), 0.10, 0.45))
                status = "downweighted"
                n_nlos += 1
                reason = f"Positive bias {residual:+.2f}m detected (likely NLOS path multipath); down-weighted to trust {weight:.2f}."
                explanations.append(f"Anchor {name}: NLOS DETECTED — {reason}")
            else:
                # Nominal LOS measurement with Gaussian residual
                normalized_err = abs(residual) / max(self.base_noise_sigma * 2.0, 0.1)
                weight = float(np.clip(np.exp(-0.5 * normalized_err**2), 0.70, 1.0))
                status = "normal"
                n_trusted += 1
                reason = f"Consistent direct LOS geometry (residual: {residual:+.2f}m, trust: {weight:.2f})."

            trust_weights[aid] = weight
            per_anchor_info[aid] = {
                "status": status,
                "trust_weight": round(weight, 3),
                "residual": round(residual, 3),
                "is_nlos": is_nlos,
                "is_outlier": is_outlier,
                "reason": reason
            }

        # Overall System Health determination
        if gdop < 2.5:
            gdop_status = "EXCELLENT"
        elif gdop < 4.5:
            gdop_status = "GOOD"
        elif gdop < 8.0:
            gdop_status = "MODERATE"
        else:
            gdop_status = "POOR"

        if n_trusted >= 4 and n_rejected == 0 and gdop < 4.0:
            overall_health = "OPTIMAL"
        elif n_trusted >= 3 and gdop < 7.0:
            overall_health = "DEGRADED"
        else:
            overall_health = "CRITICAL"

        # Overall confidence aggregation
        active_weights = [v for k, v in trust_weights.items() if v > 0.1]
        mean_trust = np.mean(active_weights) if active_weights else 0.1
        gdop_factor = 1.0 / (1.0 + 0.15 * min(gdop, 20.0))
        system_conf = float(np.clip(mean_trust * 0.65 + gdop_factor * 0.35, 0.10, 0.98))

        diagnosis_report = {
            "overall_health": overall_health,
            "system_confidence": round(system_conf, 3),
            "active_anchors_count": n_active,
            "trusted_anchors_count": n_trusted,
            "rejected_anchors_count": n_rejected,
            "nlos_detected_count": n_nlos,
            "gdop_status": gdop_status,
            "gdop_value": round(gdop, 2),
            "explanations": explanations,
            "per_anchor_diagnostics": per_anchor_info
        }

        return trust_weights, diagnosis_report, explanations
