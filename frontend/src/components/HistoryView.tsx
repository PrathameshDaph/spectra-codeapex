import React, { useEffect, useState } from 'react';
import { ExperimentRecord } from '../types';
import { fetchExperiments, deleteExperiment, getExportCsvUrl, getExportJsonUrl } from '../services/api';
import { Database, Download, Trash2, RefreshCw, FileText, CheckCircle2 } from 'lucide-react';

export const HistoryView: React.FC = () => {
  const [experiments, setExperiments] = useState<ExperimentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await fetchExperiments();
      setExperiments(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (id: number) => {
    if (confirm('Delete this experiment record?')) {
      await deleteExperiment(id);
      loadData();
    }
  };

  return (
    <div className="bg-white dark:bg-[#11131b] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-6 shadow-xs space-y-4 transition-colors">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              SQLite Experiment Registry
            </h3>
            <p className="text-xs text-slate-500">
              Persisted evaluation runs with reproducible seeds, configuration snapshots, and downloadable telemetry logs.
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {experiments.length === 0 ? (
        <div className="py-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
          <FileText className="w-8 h-8 mx-auto opacity-50" />
          <p className="text-xs">No benchmark runs recorded in SQLite yet.</p>
          <p className="text-[11px] text-slate-400">Run a scenario in the Algorithm Benchmark tab to persist records.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Run ID</th>
                <th className="py-3 px-4">Run Name & Scenario</th>
                <th className="py-3 px-4">Recorded Date</th>
                <th className="py-3 px-4 text-red-600">OLS MAE</th>
                <th className="py-3 px-4 text-indigo-600">SPECTRA MAE</th>
                <th className="py-3 px-4 text-emerald-600">Improvement</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
              {experiments.map((exp) => (
                <tr key={exp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300">#{exp.id}</td>
                  <td className="py-3 px-4 font-sans font-medium text-slate-900 dark:text-white">
                    <div>{exp.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono uppercase">{exp.scenario}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-500 font-sans">{exp.created_at}</td>
                  <td className="py-3 px-4 text-red-600">{exp.mae_ols.toFixed(3)}m</td>
                  <td className="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                    {exp.mae_spectra.toFixed(3)}m
                  </td>
                  <td className="py-3 px-4 text-emerald-600 font-bold">
                    +{exp.improvement_pct.toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5 font-sans">
                      <a
                        href={getExportCsvUrl(exp.id)}
                        download
                        title="Download CSV"
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => handleDelete(exp.id)}
                        title="Delete Run"
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-red-50 text-slate-600 hover:text-red-600 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
