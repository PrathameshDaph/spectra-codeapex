import React, { useState } from 'react';
import { AdaptiveAction } from '../types';
import { Sparkles, ArrowRight, Check, Zap, AlertCircle, Radio } from 'lucide-react';

interface AdaptiveActionCardProps {
  action: AdaptiveAction | null;
  onApplyAction: (action: AdaptiveAction) => void;
}

export const AdaptiveActionCard: React.FC<AdaptiveActionCardProps> = ({ action, onApplyAction }) => {
  const [isApplying, setIsApplying] = useState(false);
  const [justApplied, setJustApplied] = useState(false);

  if (!action) return null;

  const handleApply = async () => {
    setIsApplying(true);
    await onApplyAction(action);
    setIsApplying(false);
    setJustApplied(true);
    setTimeout(() => setJustApplied(false), 2500);
  };

  const isNominal = action.action_type === 'MAINTAIN';

  return (
    <div className={`rounded-2xl border p-5 shadow-xs transition-all ${
      isNominal
        ? 'bg-white dark:bg-[#11131b] border-slate-200/80 dark:border-slate-800'
        : 'bg-gradient-to-br from-indigo-500/5 via-white to-blue-500/5 dark:from-indigo-950/20 dark:via-[#11131b] dark:to-blue-950/20 border-indigo-200 dark:border-indigo-800/80'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Adaptive Sensing Decision Engine
            </h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {action.action_type.replace('_', ' ')}
              </span>
              <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                action.priority === 'HIGH'
                  ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
                  : action.priority === 'MEDIUM'
                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                  : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
              }`}>
                {action.priority} PRIORITY
              </span>
            </div>
          </div>
        </div>

        {!isNominal && (
          <button
            onClick={handleApply}
            disabled={isApplying || justApplied}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all shadow-xs ${
              justApplied
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95'
            }`}
          >
            {justApplied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Executed
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                {isApplying ? 'Applying...' : 'Apply Correction'}
              </>
            )}
          </button>
        )}
      </div>

      {/* Rationale & Predicted Benefit */}
      <div className="space-y-2 text-xs">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800">
          <p className="text-slate-700 dark:text-slate-300 font-medium">
            <span className="text-slate-500 dark:text-slate-400 font-normal">Diagnosis Rationale: </span>
            {action.rationale}
          </p>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 px-1">
          <span className="flex items-center gap-1">
            <Radio className="w-3 h-3 text-indigo-500" />
            Predicted Impact: <strong className="text-slate-900 dark:text-white font-medium">{action.predicted_benefit}</strong>
          </span>
          {action.confidence_gain_est > 0 && (
            <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
              +{Math.round(action.confidence_gain_est * 100)}% est. confidence
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
