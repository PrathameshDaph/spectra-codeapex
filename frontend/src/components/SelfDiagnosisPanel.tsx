import React from 'react';
import { TelemetryFrame } from '../types';
import { ShieldAlert, AlertTriangle, CheckCircle, XCircle, HelpCircle, Terminal } from 'lucide-react';

interface SelfDiagnosisPanelProps {
  telemetry: TelemetryFrame | null;
}

export const SelfDiagnosisPanel: React.FC<SelfDiagnosisPanelProps> = ({ telemetry }) => {
  if (!telemetry) return null;

  const { diagnosis, measurements } = telemetry;

  return (
    <div className="bg-white dark:bg-[#11131b] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 shadow-xs transition-colors">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Self-Diagnosis & Trust Scoring Engine
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            diagnosis.overall_health === 'OPTIMAL'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800'
              : diagnosis.overall_health === 'DEGRADED'
              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800'
              : 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200/80 dark:border-red-800'
          }`}>
            HEALTH: {diagnosis.overall_health}
          </span>
        </div>
      </div>

      {/* Anchor Trust Breakdown Grid */}
      <div className="space-y-3">
        {measurements.map((m) => {
          let badgeColor = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
          let icon = <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />;
          let label = 'TRUSTED LOS';

          if (m.status === 'offline') {
            badgeColor = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
            icon = <XCircle className="w-3.5 h-3.5 text-slate-500" />;
            label = 'OFFLINE';
          } else if (m.status === 'dropped') {
            badgeColor = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
            icon = <HelpCircle className="w-3.5 h-3.5 text-slate-500" />;
            label = 'PACKET DROP';
          } else if (m.status === 'rejected') {
            badgeColor = 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
            icon = <AlertTriangle className="w-3.5 h-3.5 text-red-600" />;
            label = 'REJECTED';
          } else if (m.status === 'downweighted' || m.is_nlos) {
            badgeColor = 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
            icon = <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />;
            label = 'NLOS DOWN-WEIGHTED';
          }

          return (
            <div
              key={m.anchor_id}
              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
            >
              {/* Left Column: Anchor & Status */}
              <div className="flex items-center gap-2.5 min-w-[200px]">
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {m.anchor_id}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium border text-[10px] ${badgeColor}`}>
                  {icon}
                  {label}
                </span>
              </div>

              {/* Middle Column: Ranges & Residuals */}
              <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                {m.status !== 'dropped' && m.status !== 'offline' ? (
                  <>
                    <span>Raw: <strong className="text-slate-800 dark:text-white">{m.raw_distance.toFixed(2)}m</strong></span>
                    <span>True: {m.true_distance.toFixed(2)}m</span>
                    <span className={m.residual > 0.8 ? 'text-amber-600 font-bold' : m.residual < -0.8 ? 'text-blue-600 font-bold' : 'text-slate-500'}>
                      Res: {m.residual > 0 ? `+${m.residual.toFixed(2)}` : m.residual.toFixed(2)}m
                    </span>
                  </>
                ) : (
                  <span className="text-slate-400 italic">No telemetry packet received this epoch</span>
                )}
              </div>

              {/* Right Column: Trust Weight Progress Bar */}
              <div className="flex items-center gap-2 min-w-[160px]">
                <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      m.trust_weight > 0.7
                        ? 'bg-emerald-500'
                        : m.trust_weight > 0.25
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.round(m.trust_weight * 100)}%` }}
                  />
                </div>
                <span className="font-mono font-bold w-10 text-right text-slate-800 dark:text-slate-200">
                  {(m.trust_weight * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Real-time Narrative Console */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
          <Terminal className="w-3.5 h-3.5 text-indigo-500" />
          <span>Real-time Diagnosis Telemetry Log</span>
        </div>
        <div className="bg-slate-900 text-slate-300 p-3 rounded-xl font-mono text-[11px] space-y-1 max-h-36 overflow-y-auto border border-slate-800">
          {diagnosis.explanations.length > 0 ? (
            diagnosis.explanations.map((exp, idx) => (
              <div key={idx} className="flex items-start gap-1.5">
                <span className="text-slate-500 select-none">&gt;</span>
                <span className={exp.includes('NLOS') ? 'text-amber-300' : exp.includes('REJECTED') ? 'text-red-400' : 'text-slate-300'}>
                  {exp}
                </span>
              </div>
            ))
          ) : (
            <div className="text-slate-500 italic">&gt; Constellation operating within nominal Gaussian parameters.</div>
          )}
        </div>
      </div>
    </div>
  );
};
