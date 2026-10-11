import numpy as np
from typing import List, Dict, Any, Optional, Tuple

class AdaptiveMeasurementRecommender:
    """
    Geometry-driven Adaptive Measurement Recommender.
    Evaluates Fisher Information Matrix (FIM), Dilution of Precision,
    and anchor residuals to formulate mathematically grounded, actionable sensor polling requests.
    """
    def __init__(self):
        pass

    def evaluate_recommendation(
        self,
        current_pos: Tuple_XY,
        active_anchors: List[Dict[str, Any]],
        all_floor_anchors: List[Dict[str, Any]],
        trust_weights: Dict[str, float],
        gdop: float,
        system_confidence: float,
        floor_id: int,
        floor_confidence: float
    ) -> Dict[str, Any]:
        cx, cy = current_pos
        
        # 1. Floor uncertainty check
        if floor_confidence < 0.72:
            return {
                "action_type": "VERTICAL_SOUNDING",
                "target_anchor_id": None,
                "target_anchor_name": "Multi-floor Ceiling Reference",
                "priority": "HIGH",
                "rationale": f"Floor {floor_id} classification confidence is low ({floor_confidence*100:.1f}%). Vertical ambiguity detected.",
                "predicted_benefit": "Auxiliary cross-floor range query or barometric sync to guarantee 2.5D floor disambiguation.",
                "confidence_gain_est": 0.28
            }

        # 2. Check for NLOS-corrupted active anchors
        nlos_candidates = []
        for anc in active_anchors:
            aid = anc["id"]
            w = trust_weights.get(aid, 1.0)
            if 0.08 <= w <= 0.50:  # degraded by NLOS
                nlos_candidates.append(anc)
                
        if nlos_candidates:
            target = nlos_candidates[0]
            return {
                "action_type": "FREQUENCY_SHIFT",
                "target_anchor_id": target["id"],
                "target_anchor_name": target.get("name", target["id"]),
                "priority": "HIGH",
                "rationale": f"Anchor {target.get('name', target['id'])} is suffering from heavy NLOS multipath (trust weight: {trust_weights.get(target['id'], 0.2):.2f}).",
                "predicted_benefit": f"Request frequency hopping / dual-band UWB re-sounding on channel 5/9 to bypass reflection path delay.",
                "confidence_gain_est": 0.24
            }

        # 3. Geometric deficiency / Sparse anchor augmentation
        trusted_active_ids = {a["id"] for a in active_anchors if trust_weights.get(a["id"], 1.0) > 0.5}
        
        # Check if GDOP is poor or trusted anchors < 4
        if gdop > 3.5 or len(trusted_active_ids) < 4:
            # Find inactive or offline anchors on this floor that would provide the best GDOP reduction
            dormant_anchors = [a for a in all_floor_anchors if a["id"] not in trusted_active_ids]
            
            best_candidate = None
            best_gdop_reduction = 0.0
            
            if dormant_anchors:
                # Calculate current H matrix
                H_current = []
                for anc in active_anchors:
                    if anc["id"] in trusted_active_ids:
                        d = max(np.sqrt((cx - anc["x"])**2 + (cy - anc["y"])**2), 0.1)
                        H_current.append([(cx - anc["x"]) / d, (cy - anc["y"]) / d])
                
                H_curr_arr = np.array(H_current) if len(H_current) >= 2 else None
                
                for cand in dormant_anchors:
                    d_c = max(np.sqrt((cx - cand["x"])**2 + (cy - cand["y"])**2), 0.1)
                    h_row = np.array([[(cx - cand["x"]) / d_c, (cy - cand["y"]) / d_c]])
                    
                    if H_curr_arr is not None:
                        H_sim = np.vstack([H_curr_arr, h_row])
                    else:
                        H_sim = h_row
                        
                    try:
                        HTH = H_sim.T @ H_sim
                        sim_gdop = np.sqrt(np.trace(np.linalg.pinv(HTH)))
                        improvement = gdop - sim_gdop
                        if improvement > best_gdop_reduction:
                            best_gdop_reduction = improvement
                            best_candidate = cand
                    except Exception:
                        continue
                        
                if best_candidate and best_gdop_reduction > 0.5:
                    return {
                        "action_type": "GEOMETRIC_AUGMENT",
                        "target_anchor_id": best_candidate["id"],
                        "target_anchor_name": best_candidate.get("name", best_candidate["id"]),
                        "priority": "HIGH" if gdop > 5.0 else "MEDIUM",
                        "rationale": f"High GDOP ({gdop:.2f}) indicates poor geometric diversity. Current anchors leave high positional ambiguity along critical axis.",
                        "predicted_benefit": f"Awaken Anchor {best_candidate.get('name', best_candidate['id'])} at ({best_candidate['x']}m, {best_candidate['y']}m) to reduce GDOP by {best_gdop_reduction:.2f} points.",
                        "confidence_gain_est": float(np.clip(best_gdop_reduction * 0.08, 0.12, 0.35))
                    }

        # 4. Check packet drop rate
        dropped_anchors = [a for a in active_anchors if trust_weights.get(a["id"], 1.0) == 0.0 and a.get("status") != "offline"]
        if dropped_anchors:
            target = dropped_anchors[0]
            return {
                "action_type": "AUXILIARY_POLL",
                "target_anchor_id": target["id"],
                "target_anchor_name": target.get("name", target["id"]),
                "priority": "MEDIUM",
                "rationale": f"Anchor {target.get('name', target['id'])} dropped consecutive telemetry packets.",
                "predicted_benefit": "Issue synchronous 3-burst retry poll to re-acquire ranging sequence.",
                "confidence_gain_est": 0.15
            }

        # 5. Optimal nominal state
        return {
            "action_type": "MAINTAIN",
            "target_anchor_id": None,
            "target_anchor_name": "All Active Anchors",
            "priority": "NONE",
            "rationale": f"Constellation geometry is well-conditioned (GDOP: {gdop:.2f}, System Confidence: {system_confidence*100:.1f}%).",
            "predicted_benefit": "Sustain current poll interval (10 Hz). No corrective intervention required.",
            "confidence_gain_est": 0.0
        }

Tuple_XY = Tuple[float, float]
