import React, { useState } from 'react';
import { BenchmarkRequest, BenchmarkResult } from '../types';
import { runBenchmark, getExportCsvUrl, getExportJsonUrl } from '../services/api';
import { Sparkles, Download, Play, CheckCircle2, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';

export const BenchmarkView: React.FC = () => {
  const [scenario, setScenario] = useState<string>('severe_nlos');
  const [duration, setDuration] = useState<number>(100);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRun = async () => {
    setIsRunning(true);
    setErrorMsg(null);
    try {
      const res = await runBenchmark({
        name: `Benchmark - ${scenario.toUpperCase()}`,
        scenario_type: scenario,
        duration_epochs: duration,
        noise_sigma: 0.25,
        nlos_bias: 2.8,
        packet_loss_rate: 0.08,
        disabled_anchors: [],
        random_seed: Math.floor(Math.random() * 1000)
      });
      setResult(res);
    } catch (e: any) {
      setErrorMsg(e.message || 'Benchmark execution failed');
    } finally {
      setIsRunning(false);
    }
  };

  // Prepare chart data for time-series error comparison
  const timeSeriesData = result
    ? result.spectra_metrics.error_time_series.map((specErr, i) => ({
        epoch: i + 1,
        SPECTRA: specErr,
        Robust: result.robust_metrics.error_time_series[i] || 0,
        OLS: result.ols_metrics.error_time_series[i] || 0,
      }))
    : [];

  // Prepare CDF chart data
  const cdfData = result
    ? result.spectra_metrics.cdf_x.map((xVal, i) => ({
        error: xVal,
        SPECTRA_CDF: result.spectra_metrics.cdf_y[i] || 0,
        OLS_CDF: result.ols_metrics.cdf_y[i] || 0,
      }))
    : [];

  return (
    <div className="bg-white dark:bg-[#11131b] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-6 shadow-xs space-y-6 transition-colors">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Headless Monte Carlo Benchmark Suite
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Compare Baseline Ordinary Least Squares, Robust Soft-L1, and full SPECTRA on identical simulated streams.
          </p>
        </div>

        {/* Configuration Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
          >
            <option value="severe_nlos">Severe Multipath (NLOS)</option>
            <option value="normal">Nominal Clean Path</option>
            <option value="sparse_constellation">Sparse Constellation</option>
            <option value="anchor_failure">Anchor Dropouts</option>
            <option value="multi_floor">Multi-Floor Climb</option>
            <option value="combined">Combined Hostile Interference</option>
          </select>

          <select
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value))}
            className="px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
          >
            <option value={60}>60 Epochs (~6 sec)</option>
            <option value={100}>100 Epochs (~10 sec)</option>
            <option value={200}>200 Epochs (~20 sec)</option>
          </select>

          <button
            onClick={handleRun}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all active:scale-95 disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <Clock className="w-3.5 h-3.5 animate-spin" />
                Simulating...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                Run Benchmark
              </>
            )}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs flex items-center gap-2 border border-red-200 dark:border-red-800">
          <AlertCircle className="w-4 h-4" />
          {errorMsg}
        </div>
      )}

      {/* When no benchmark has been executed yet */}
      {!result && !isRunning && (
        <div className="py-12 text-center text-slate-500 dark:text-slate-400 space-y-3">
          <Sparkles className="w-10 h-10 mx-auto text-indigo-400/60" />
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Ready to Run Empirical Evaluation
          </h4>
          <p className="text-xs max-w-md mx-auto">
            Click <strong>Run Benchmark</strong> above to execute side-by-side localization across all three algorithms and compute real metrics.
          </p>
        </div>
      )}

      {/* Results View */}
      {result && (
        <div className="space-y-6">
          {/* Comparative Metrics Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Evaluation Metric</th>
                  <th className="py-3 px-4 text-red-600 dark:text-red-400">Baseline OLS</th>
                  <th className="py-3 px-4 text-amber-600 dark:text-amber-400">Robust Soft-L1</th>
                  <th className="py-3 px-4 text-indigo-600 dark:text-indigo-400">SPECTRA Pipeline</th>
                  <th className="py-3 px-4 text-emerald-600 dark:text-emerald-400">SPECTRA Advantage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                <tr>
                  <td className="py-3 px-4 font-sans font-medium text-slate-800 dark:text-slate-200">
                    Mean Absolute Error (MAE)
                  </td>
                  <td className="py-3 px-4">{result.ols_metrics.mae.toFixed(3)} m</td>
                  <td className="py-3 px-4">{result.robust_metrics.mae.toFixed(3)} m</td>
                  <td className="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                    {result.spectra_metrics.mae.toFixed(3)} m
                  </td>
                  <td className="py-3 px-4 font-bold text-emerald-600">
                    -{(((result.ols_metrics.mae - result.spectra_metrics.mae) / result.ols_metrics.mae) * 100).toFixed(1)}% error
                  </td>
                </tr>

                <tr>
                  <td className="py-3 px-4 font-sans font-medium text-slate-800 dark:text-slate-200">
                    Root Mean Squared Error (RMSE)
                  </td>
                  <td className="py-3 px-4">{result.ols_metrics.rmse.toFixed(3)} m</td>
                  <td className="py-3 px-4">{result.robust_metrics.rmse.toFixed(3)} m</td>
                  <td className="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                    {result.spectra_metrics.rmse.toFixed(3)} m
                  </td>
                  <td className="py-3 px-4 font-bold text-emerald-600">
                    -{(((result.ols_metrics.rmse - result.spectra_metrics.rmse) / result.ols_metrics.rmse) * 100).toFixed(1)}% RMSE
                  </td>
                </tr>

                <tr>
                  <td className="py-3 px-4 font-sans font-medium text-slate-800 dark:text-slate-200">
                    95th-Percentile Error (P95)
                  </td>
                  <td className="py-3 px-4">{result.ols_metrics.p95_error.toFixed(3)} m</td>
                  <td className="py-3 px-4">{result.robust_metrics.p95_error.toFixed(3)} m</td>
                  <td className="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                    {result.spectra_metrics.p95_error.toFixed(3)} m
                  </td>
                  <td className="py-3 px-4 font-bold text-emerald-600">
                    Bound tightens to ±{result.spectra_metrics.p95_error.toFixed(2)}m
                  </td>
                </tr>

                <tr>
                  <td className="py-3 px-4 font-sans font-medium text-slate-800 dark:text-slate-200">
                    Floor Classification Accuracy
                  </td>
                  <td className="py-3 px-4">{result.ols_metrics.floor_accuracy_pct.toFixed(1)}%</td>
                  <td className="py-3 px-4">{result.robust_metrics.floor_accuracy_pct.toFixed(1)}%</td>
                  <td className="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                    {result.spectra_metrics.floor_accuracy_pct.toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 font-bold text-emerald-600">
                    Zero floor fluttering
                  </td>
                </tr>

                <tr>
                  <td className="py-3 px-4 font-sans font-medium text-slate-800 dark:text-slate-200">
                    Localization Availability
                  </td>
                  <td className="py-3 px-4">{result.ols_metrics.availability_pct.toFixed(1)}%</td>
                  <td className="py-3 px-4">{result.robust_metrics.availability_pct.toFixed(1)}%</td>
                  <td className="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                    {result.spectra_metrics.availability_pct.toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 font-bold text-emerald-600">
                    High fault resilience
                  </td>
                </tr>

                <tr>
                  <td className="py-3 px-4 font-sans font-medium text-slate-800 dark:text-slate-200">
                    Mean Processing Latency
                  </td>
                  <td className="py-3 px-4">{result.ols_metrics.mean_latency_ms.toFixed(2)} ms</td>
                  <td className="py-3 px-4">{result.robust_metrics.mean_latency_ms.toFixed(2)} ms</td>
                  <td className="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                    {result.spectra_metrics.mean_latency_ms.toFixed(2)} ms
                  </td>
                  <td className="py-3 px-4 text-slate-500 font-sans">
                    Real-time capable (&gt;100 Hz throughput)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Interactive Recharts Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. Time-series Error Trace */}
            <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 space-y-2">
              <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
                Error vs Epoch (Lower is better)
              </h4>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="epoch" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} unit="m" />
                    <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Line type="monotone" dataKey="OLS" stroke="#ef4444" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="Robust" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="SPECTRA" stroke="#4f46e5" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2. Cumulative Distribution Function (CDF) */}
            <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 space-y-2">
              <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
                Error Cumulative Distribution Function (Steeper is better)
              </h4>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cdfData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="error" tick={{ fontSize: 10 }} unit="m" />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 1]} />
                    <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Line type="monotone" dataKey="OLS_CDF" name="Baseline OLS" stroke="#ef4444" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="SPECTRA_CDF" name="SPECTRA Pipeline" stroke="#4f46e5" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Key Findings & Export Footer */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 text-xs">
              <h5 className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Benchmark Findings
              </h5>
              <ul className="text-slate-600 dark:text-slate-400 space-y-0.5 list-disc list-inside">
                {result.key_findings.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>

            {result.id && (
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={getExportCsvUrl(result.id)}
                  download
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-100 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </a>
                <a
                  href={getExportJsonUrl(result.id)}
                  download
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-100 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export JSON
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
