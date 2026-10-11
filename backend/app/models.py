from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field

class AnchorConfig(BaseModel):
    id: str
    name: str
    floor_id: int
    x: float
    y: float
    z: float = 2.5
    status: str = "active"  # active, degraded, nlos, offline
    hardware_model: str = "UWB-DWM1000"
    base_noise_std: float = 0.15
    nlos_bias: float = 0.0
    packet_loss_rate: float = 0.0

class Measurement(BaseModel):
    anchor_id: str
    raw_distance: float
    true_distance: float
    residual: float = 0.0
    trust_weight: float = 1.0
    is_nlos: bool = False
    is_outlier: bool = False
    is_dropped: bool = False
    status: str = "normal"  # normal, downweighted, rejected, dropped
    diagnosis_reason: str = "Healthy Line-of-Sight"

class PositionEstimate(BaseModel):
    floor_id: int
    x: float
    y: float
    z: float = 1.2
    confidence: float
    uncertainty_semi_major: float
    uncertainty_semi_minor: float
    uncertainty_angle_deg: float
    gdop: float
    algorithm: str  # "ols", "robust", "spectra_ekf"
    computation_time_ms: float

class GroundTruth(BaseModel):
    floor_id: int
    x: float
    y: float
    z: float = 1.2
    vx: float = 0.0
    vy: float = 0.0

class SelfDiagnosisReport(BaseModel):
    overall_health: str  # "OPTIMAL", "DEGRADED", "CRITICAL"
    system_confidence: float
    active_anchors_count: int
    trusted_anchors_count: int
    rejected_anchors_count: int
    nlos_detected_count: int
    gdop_status: str  # "EXCELLENT", "GOOD", "MODERATE", "POOR"
    gdop_value: float
    explanations: List[str]
    per_anchor_diagnostics: Dict[str, Dict[str, Any]]

class AdaptiveAction(BaseModel):
    action_type: str  # "AUXILIARY_POLL", "FREQUENCY_SHIFT", "GEOMETRIC_AUGMENT", "MAINTAIN"
    target_anchor_id: Optional[str] = None
    target_anchor_name: Optional[str] = None
    priority: str  # "HIGH", "MEDIUM", "LOW", "NONE"
    rationale: str
    predicted_benefit: str
    confidence_gain_est: float

class TelemetryFrame(BaseModel):
    timestamp: float
    epoch: int
    ground_truth: GroundTruth
    ols_estimate: PositionEstimate
    robust_estimate: PositionEstimate
    spectra_estimate: PositionEstimate
    measurements: List[Measurement]
    diagnosis: SelfDiagnosisReport
    adaptive_action: AdaptiveAction
    current_error_ols: float
    current_error_robust: float
    current_error_spectra: float
    floor_classification_confidence: float

class SimulationConfig(BaseModel):
    motion_pattern: str = "patrol"  # "patrol", "random_walk", "stop_and_go", "multi_floor_transition"
    speed_mps: float = 1.2
    noise_sigma: float = 0.20
    nlos_bias: float = 2.5
    nlos_target_anchor: Optional[str] = "A3"
    packet_loss_rate: float = 0.05
    disabled_anchors: List[str] = []
    floor_id: int = 2
    random_seed: int = 42

class BenchmarkRequest(BaseModel):
    name: str = "Benchmark Evaluation Run"
    scenario_type: str = "severe_nlos"  # normal, severe_nlos, sparse_constellation, anchor_failure, multi_floor, combined
    duration_epochs: int = 120
    noise_sigma: float = 0.25
    nlos_bias: float = 2.8
    packet_loss_rate: float = 0.10
    disabled_anchors: List[str] = []
    random_seed: int = 42

class BenchmarkMetrics(BaseModel):
    algorithm_name: str
    mae: float
    rmse: float
    p95_error: float
    floor_accuracy_pct: float
    availability_pct: float
    mean_latency_ms: float
    error_time_series: List[float] = []
    cdf_x: List[float] = []
    cdf_y: List[float] = []

class BenchmarkResult(BaseModel):
    id: Optional[int] = None
    run_name: str
    scenario_type: str
    timestamp: str
    duration_epochs: int
    config: Dict[str, Any]
    ols_metrics: BenchmarkMetrics
    robust_metrics: BenchmarkMetrics
    spectra_metrics: BenchmarkMetrics
    key_findings: List[str]

class ExperimentRecord(BaseModel):
    id: Optional[int] = None
    name: str
    scenario: str
    created_at: str
    mae_ols: float
    mae_spectra: float
    improvement_pct: float
    config_json: str
    metrics_json: str
