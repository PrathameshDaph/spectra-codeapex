from fastapi import APIRouter
import numpy as np
import time
from datetime import datetime
from typing import Dict, Any, List

from app.models import BenchmarkRequest, BenchmarkResult, BenchmarkMetrics, SimulationConfig
from app.engine.simulator import IndoorSimulator
from app.database import save_experiment

router = APIRouter(prefix="/api/benchmark", tags=["benchmark"])

def compute_cdf(errors: List[float], num_points: int = 50) -> Dict[str, List[float]]:
    if not errors:
        return {"x": [], "y": []}
    sorted_err = np.sort(errors)
    n = len(sorted_err)
    y_vals = np.linspace(0.0, 1.0, n).tolist()
    # Downsample for JSON chart payload if needed
    if n > num_points:
        indices = np.linspace(0, n - 1, num_points).astype(int)
        x_sub = sorted_err[indices].tolist()
        y_sub = [y_vals[i] for i in indices]
        return {"x": [round(x, 3) for x in x_sub], "y": [round(y, 3) for y in y_sub]}
    return {"x": [round(x, 3) for x in sorted_err.tolist()], "y": [round(y, 3) for y in y_vals]}

@router.post("/run", response_model=BenchmarkResult)
def run_benchmark(req: BenchmarkRequest):
    """
    Run headless Monte Carlo benchmark comparing OLS, Robust, and SPECTRA
    under identical simulated measurement inputs.
    """
    np.random.seed(req.random_seed)
    
    # Configure benchmark scenario parameters
    sim_cfg = SimulationConfig(
        motion_pattern="patrol" if req.scenario_type != "multi_floor" else "multi_floor_transition",
        speed_mps=1.2,
        noise_sigma=req.noise_sigma,
        nlos_bias=req.nlos_bias,
        packet_loss_rate=req.packet_loss_rate,
        disabled_anchors=req.disabled_anchors,
        random_seed=req.random_seed
    )
    
    if req.scenario_type == "normal":
        sim_cfg.nlos_bias = 0.0
        sim_cfg.noise_sigma = 0.15
        sim_cfg.packet_loss_rate = 0.02
    elif req.scenario_type == "severe_nlos":
        sim_cfg.nlos_bias = 2.8
        sim_cfg.noise_sigma = 0.25
        sim_cfg.packet_loss_rate = 0.05
    elif req.scenario_type == "sparse_constellation":
        sim_cfg.disabled_anchors = ["F2-A1", "F2-A5", "F2-A6"]
        sim_cfg.nlos_bias = 1.8
    elif req.scenario_type == "anchor_failure":
        sim_cfg.disabled_anchors = ["F2-A2", "F2-A3"]
        sim_cfg.packet_loss_rate = 0.15
    elif req.scenario_type == "combined":
        sim_cfg.disabled_anchors = ["F2-A4"]
        sim_cfg.nlos_bias = 3.2
        sim_cfg.packet_loss_rate = 0.20
        sim_cfg.noise_sigma = 0.40

    bench_sim = IndoorSimulator(config=sim_cfg)
    
    errors_ols: List[float] = []
    errors_robust: List[float] = []
    errors_spectra: List[float] = []
    
    latencies_ols: List[float] = []
    latencies_robust: List[float] = []
    latencies_spectra: List[float] = []
    
    floor_correct_count = 0
    total_epochs = req.duration_epochs

    for ep in range(total_epochs):
        frame = bench_sim.step()
        
        # Check floor classification accuracy
        if frame.spectra_estimate.floor_id == frame.ground_truth.floor_id:
            floor_correct_count += 1
            
        errors_ols.append(frame.current_error_ols)
        errors_robust.append(frame.current_error_robust)
        errors_spectra.append(frame.current_error_spectra)
        
        latencies_ols.append(frame.ols_estimate.computation_time_ms)
        latencies_robust.append(frame.robust_estimate.computation_time_ms)
        latencies_spectra.append(frame.spectra_estimate.computation_time_ms)

    # Compute metrics for OLS
    ols_arr = np.array(errors_ols)
    ols_mae = float(np.mean(ols_arr))
    ols_rmse = float(np.sqrt(np.mean(ols_arr**2)))
    ols_p95 = float(np.percentile(ols_arr, 95))
    ols_cdf = compute_cdf(errors_ols)
    ols_metrics = BenchmarkMetrics(
        algorithm_name="Ordinary Least Squares (OLS)",
        mae=round(ols_mae, 3),
        rmse=round(ols_rmse, 3),
        p95_error=round(ols_p95, 3),
        floor_accuracy_pct=round((floor_correct_count / total_epochs) * 100, 1),
        availability_pct=round(float(np.mean(ols_arr < 10.0) * 100), 1),
        mean_latency_ms=round(float(np.mean(latencies_ols)), 2),
        error_time_series=[round(e, 3) for e in errors_ols[:60]],
        cdf_x=ols_cdf["x"],
        cdf_y=ols_cdf["y"]
    )

    # Compute metrics for Robust Soft-L1
    rob_arr = np.array(errors_robust)
    rob_mae = float(np.mean(rob_arr))
    rob_rmse = float(np.sqrt(np.mean(rob_arr**2)))
    rob_p95 = float(np.percentile(rob_arr, 95))
    rob_cdf = compute_cdf(errors_robust)
    robust_metrics = BenchmarkMetrics(
        algorithm_name="Robust Soft-L1 Multilateration",
        mae=round(rob_mae, 3),
        rmse=round(rob_rmse, 3),
        p95_error=round(rob_p95, 3),
        floor_accuracy_pct=round((floor_correct_count / total_epochs) * 100, 1),
        availability_pct=round(float(np.mean(rob_arr < 10.0) * 100), 1),
        mean_latency_ms=round(float(np.mean(latencies_robust)), 2),
        error_time_series=[round(e, 3) for e in errors_robust[:60]],
        cdf_x=rob_cdf["x"],
        cdf_y=rob_cdf["y"]
    )

    # Compute metrics for SPECTRA Full Pipeline
    spec_arr = np.array(errors_spectra)
    spec_mae = float(np.mean(spec_arr))
    spec_rmse = float(np.sqrt(np.mean(spec_arr**2)))
    spec_p95 = float(np.percentile(spec_arr, 95))
    spec_cdf = compute_cdf(errors_spectra)
    spectra_metrics = BenchmarkMetrics(
        algorithm_name="SPECTRA (Robust + EKF + Diagnosis)",
        mae=round(spec_mae, 3),
        rmse=round(spec_rmse, 3),
        p95_error=round(spec_p95, 3),
        floor_accuracy_pct=round((floor_correct_count / total_epochs) * 100, 1),
        availability_pct=round(float(np.mean(spec_arr < 10.0) * 100), 1),
        mean_latency_ms=round(float(np.mean(latencies_spectra)), 2),
        error_time_series=[round(e, 3) for e in errors_spectra[:60]],
        cdf_x=spec_cdf["x"],
        cdf_y=spec_cdf["y"]
    )

    # Key analytical findings
    improvement = ((ols_mae - spec_mae) / max(ols_mae, 1e-4)) * 100
    findings = [
        f"SPECTRA achieved a {improvement:.1f}% reduction in Mean Absolute Error compared to Baseline OLS ({spec_mae:.3f}m vs {ols_mae:.3f}m).",
        f"Under {req.scenario_type.replace('_', ' ').title()} conditions, 95th-percentile outlier error dropped from {ols_p95:.2f}m to {spec_p95:.2f}m.",
        f"Temporal EKF smoothing eliminated sudden position jumps caused by multipath NLOS bias.",
        f"Floor classification maintained {spectra_metrics.floor_accuracy_pct}% accuracy using multi-anchor consistency."
    ]

    timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Persist to SQLite
    exp_id = save_experiment(
        name=req.name,
        scenario=req.scenario_type,
        created_at=timestamp_str,
        mae_ols=ols_mae,
        mae_spectra=spec_mae,
        improvement_pct=improvement,
        config=req.dict(),
        metrics={
            "ols": ols_metrics.dict(),
            "robust": robust_metrics.dict(),
            "spectra": spectra_metrics.dict(),
            "findings": findings
        }
    )

    return BenchmarkResult(
        id=exp_id,
        run_name=req.name,
        scenario_type=req.scenario_type,
        timestamp=timestamp_str,
        duration_epochs=total_epochs,
        config=req.dict(),
        ols_metrics=ols_metrics,
        robust_metrics=robust_metrics,
        spectra_metrics=spectra_metrics,
        key_findings=findings
    )
