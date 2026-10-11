export interface AnchorConfig {
  id: string;
  name: string;
  floor_id: number;
  x: number;
  y: number;
  z: number;
  status: 'active' | 'offline' | 'nlos' | 'degraded';
}

export interface Measurement {
  anchor_id: string;
  raw_distance: number;
  true_distance: number;
  residual: number;
  trust_weight: number;
  is_nlos: boolean;
  is_outlier: boolean;
  is_dropped: boolean;
  status: 'normal' | 'downweighted' | 'rejected' | 'dropped' | 'offline';
  diagnosis_reason: string;
}

export interface PositionEstimate {
  floor_id: number;
  x: number;
  y: number;
  z: number;
  confidence: number;
  uncertainty_semi_major: number;
  uncertainty_semi_minor: number;
  uncertainty_angle_deg: number;
  gdop: number;
  algorithm: string;
  computation_time_ms: number;
}

export interface GroundTruth {
  floor_id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
}

export interface SelfDiagnosisReport {
  overall_health: 'OPTIMAL' | 'DEGRADED' | 'CRITICAL';
  system_confidence: number;
  active_anchors_count: number;
  trusted_anchors_count: number;
  rejected_anchors_count: number;
  nlos_detected_count: number;
  gdop_status: 'EXCELLENT' | 'GOOD' | 'MODERATE' | 'POOR';
  gdop_value: number;
  explanations: string[];
  per_anchor_diagnostics: Record<string, {
    status: string;
    trust_weight: number;
    residual: number;
    is_nlos: boolean;
    is_outlier: boolean;
    reason: string;
  }>;
}

export interface AdaptiveAction {
  action_type: 'AUXILIARY_POLL' | 'FREQUENCY_SHIFT' | 'GEOMETRIC_AUGMENT' | 'VERTICAL_SOUNDING' | 'MAINTAIN';
  target_anchor_id: string | null;
  target_anchor_name: string | null;
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  rationale: string;
  predicted_benefit: string;
  confidence_gain_est: number;
}

export interface TelemetryFrame {
  timestamp: number;
  epoch: number;
  ground_truth: GroundTruth;
  ols_estimate: PositionEstimate;
  robust_estimate: PositionEstimate;
  spectra_estimate: PositionEstimate;
  measurements: Measurement[];
  diagnosis: SelfDiagnosisReport;
  adaptive_action: AdaptiveAction;
  current_error_ols: number;
  current_error_robust: number;
  current_error_spectra: number;
  floor_classification_confidence: number;
}

export interface SimulationConfig {
  motion_pattern: 'patrol' | 'random_walk' | 'stop_and_go' | 'multi_floor_transition';
  speed_mps: number;
  noise_sigma: number;
  nlos_bias: number;
  nlos_target_anchor: string | null;
  packet_loss_rate: number;
  disabled_anchors: string[];
  floor_id: number;
  random_seed: number;
}

export interface BenchmarkRequest {
  name: string;
  scenario_type: string;
  duration_epochs: number;
  noise_sigma: number;
  nlos_bias: number;
  packet_loss_rate: number;
  disabled_anchors: string[];
  random_seed: number;
}

export interface BenchmarkMetrics {
  algorithm_name: string;
  mae: number;
  rmse: number;
  p95_error: number;
  floor_accuracy_pct: number;
  availability_pct: number;
  mean_latency_ms: number;
  error_time_series: number[];
  cdf_x: number[];
  cdf_y: number[];
}

export interface BenchmarkResult {
  id?: number;
  run_name: string;
  scenario_type: string;
  timestamp: string;
  duration_epochs: number;
  config: Record<string, any>;
  ols_metrics: BenchmarkMetrics;
  robust_metrics: BenchmarkMetrics;
  spectra_metrics: BenchmarkMetrics;
  key_findings: string[];
}

export interface ExperimentRecord {
  id: number;
  name: string;
  scenario: string;
  created_at: string;
  mae_ols: number;
  mae_spectra: number;
  improvement_pct: number;
}
