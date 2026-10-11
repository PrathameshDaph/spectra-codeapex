import React from 'react';
import { TelemetryFrame } from '../types';
import { MapPin, ShieldCheck, Activity, Gauge, TrendingDown, AlertCircle } from 'lucide-react';

interface TelemetryCardsProps {
  telemetry: TelemetryFrame | null;
}

export const TelemetryCards: React.FC<TelemetryCardsProps> = ({ telemetry }) => {
  if (!telemetry) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 animate-pulse">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800/50 rounded-2xl border border-slate-200/60 dark:border-slate-800" />
        ))}
      </div>
    );
  }

  const { spectra_estimate, ols_estimate, ground_truth, diagnosis, current_error_spectra, current_error_ols, floor_classification_confidence } = telemetry;
  
  // Calculate relative error reduction vs baseline
  const errReductionPct = current_error_ols > 0.05
    ? Math.max(0, Math.min(99, ((current_error_ols - current_error_spectra) / current_error_ols) * 100))
    : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {/* 1. 2.5D Position Fix */}
      <div className="p-4 bg-white dark:bg-[#11131b] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            2.5D Position Fix
          </span>
          <MapPin className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div className="mt-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">
              F0{spectra_estimate.floor_id}
            </span>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              ({spectra_estimate.x.toFixed(1)}m, {spectra_estimate.y.toFixed(1)}m)
            </span>
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
            Floor Conf: {(floor_classification_confidence * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      {/* 2. System Confidence */}
      <div className="p-4 bg-white dark:bg-[#11131b] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Fix Confidence
          </span>
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="mt-2">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">
              {(spectra_estimate.confidence * 100).toFixed(0)}%
            </span>
            <span className="text-[11px] px-1.5 py-0.5 font-medium rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800">
              {spectra_estimate.confidence > 0.75 ? 'GUARDED' : 'ADAPTIVE'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            95% Radius: ±{spectra_estimate.uncertainty_semi_major.toFixed(2)}m
          </p>
        </div>
      </div>

      {/* 3. Positioning Error vs Baseline */}
      <div className="p-4 bg-white dark:bg-[#11131b] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Instantaneous Error
          </span>
          <TrendingDown className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div className="mt-2">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
              {current_error_spectra.toFixed(2)}m
            </span>
            {errReductionPct > 10 && (
              <span className="text-[11px] font-mono font-medium px-1.5 py-0.2 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                -{errReductionPct.toFixed(0)}% vs OLS
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Baseline OLS: <span className="font-mono text-red-500">{current_error_ols.toFixed(2)}m</span>
          </p>
        </div>
      </div>

      {/* 4. Anchor Constellation */}
      <div className="p-4 bg-white dark:bg-[#11131b] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Anchor Health
          </span>
          <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="mt-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">
              {diagnosis.trusted_anchors_count} / {diagnosis.active_anchors_count}
            </span>
            <span className="text-xs text-slate-500">Trusted</span>
          </div>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
            {diagnosis.nlos_detected_count > 0 ? `${diagnosis.nlos_detected_count} NLOS Isolated` : 'All Direct LOS'}
          </p>
        </div>
      </div>

      {/* 5. Geometric Quality (GDOP) */}
      <div className="p-4 bg-white dark:bg-[#11131b] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Constellation GDOP
          </span>
          <Gauge className="w-4 h-4 text-purple-600 dark:text-purple-400" />
        </div>
        <div className="mt-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">
              {diagnosis.gdop_value.toFixed(2)}
            </span>
            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
              diagnosis.gdop_status === 'EXCELLENT' || diagnosis.gdop_status === 'GOOD'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
            }`}>
              {diagnosis.gdop_status}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            System: <span className="font-semibold text-slate-700 dark:text-slate-300">{diagnosis.overall_health}</span>
          </p>
        </div>
      </div>
    </div>
  );
};
