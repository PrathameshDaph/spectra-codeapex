import React, { useState } from 'react';
import { SimulationConfig, AnchorConfig } from '../types';
import { Sliders, Play, Pause, RotateCcw, FastForward, ShieldAlert, Zap, Radio, Layers } from 'lucide-react';

interface SimulationLabProps {
  config: SimulationConfig;
  onUpdateConfig: (newCfg: Partial<SimulationConfig>) => void;
  onReset: () => void;
  onStep: () => void;
  isPaused: boolean;
  onTogglePause: () => void;
  anchors: Record<number, AnchorConfig[]>;
  activeFloor: number;
  onToggleAnchor: (anchorId: string, currentStatus: string) => void;
}

export const SimulationLab: React.FC<SimulationLabProps> = ({
  config,
  onUpdateConfig,
  onReset,
  onStep,
  isPaused,
  onTogglePause,
  anchors,
  activeFloor,
  onToggleAnchor,
}) => {
  const currentFloorAnchors = anchors[activeFloor] || [];

  const handlePreset = (preset: string) => {
    if (preset === 'nominal') {
      onUpdateConfig({
        noise_sigma: 0.15,
        nlos_bias: 0.0,
        packet_loss_rate: 0.01,
        motion_pattern: 'patrol',
        disabled_anchors: [],
      });
    } else if (preset === 'nlos') {
      onUpdateConfig({
        noise_sigma: 0.25,
        nlos_bias: 2.8,
        packet_loss_rate: 0.05,
        motion_pattern: 'patrol',
      });
    } else if (preset === 'sparse') {
      onUpdateConfig({
        noise_sigma: 0.20,
        nlos_bias: 1.5,
        packet_loss_rate: 0.05,
        disabled_anchors: ['F2-A1', 'F2-A5'],
      });
    } else if (preset === 'failures') {
      onUpdateConfig({
        noise_sigma: 0.30,
        nlos_bias: 2.0,
        packet_loss_rate: 0.20,
        disabled_anchors: ['F2-A2', 'F2-A3'],
      });
    } else if (preset === 'multifloor') {
      onUpdateConfig({
        motion_pattern: 'multi_floor_transition',
        speed_mps: 1.5,
        nlos_bias: 1.2,
      });
    } else if (preset === 'hostile') {
      onUpdateConfig({
        noise_sigma: 0.45,
        nlos_bias: 3.5,
        packet_loss_rate: 0.25,
        disabled_anchors: ['F2-A4'],
      });
    }
  };

  return (
    <div className="bg-white dark:bg-[#11131b] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-6 shadow-xs space-y-6 transition-colors">
      {/* Header and Playback Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Simulation Control Lab
            </h3>
            <p className="text-xs text-slate-500">
              Inject real-world RF impairments and evaluate estimator robustness in real time.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onTogglePause}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
              isPaused
                ? 'bg-indigo-600 text-white border-transparent'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          <button
            onClick={onStep}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-colors"
          >
            <FastForward className="w-3.5 h-3.5" />
            Step 1
          </button>
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>

      {/* Preset Scenarios */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
          Predefined Stress Scenarios (1-Click)
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <button
            onClick={() => handlePreset('nominal')}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 bg-slate-50/50 dark:bg-slate-900/40 text-left transition-all text-xs"
          >
            <span className="font-semibold block text-slate-800 dark:text-slate-200">1. Nominal LOS</span>
            <span className="text-[10px] text-slate-500">Low noise, 0 NLOS</span>
          </button>
          <button
            onClick={() => handlePreset('nlos')}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-400 bg-slate-50/50 dark:bg-slate-900/40 text-left transition-all text-xs"
          >
            <span className="font-semibold block text-amber-600 dark:text-amber-400">2. Severe NLOS</span>
            <span className="text-[10px] text-slate-500">+2.8m multipath</span>
          </button>
          <button
            onClick={() => handlePreset('sparse')}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-purple-400 bg-slate-50/50 dark:bg-slate-900/40 text-left transition-all text-xs"
          >
            <span className="font-semibold block text-purple-600 dark:text-purple-400">3. Sparse Constellation</span>
            <span className="text-[10px] text-slate-500">High GDOP layout</span>
          </button>
          <button
            onClick={() => handlePreset('failures')}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-red-400 bg-slate-50/50 dark:bg-slate-900/40 text-left transition-all text-xs"
          >
            <span className="font-semibold block text-red-600 dark:text-red-400">4. Anchor Dropout</span>
            <span className="text-[10px] text-slate-500">2 nodes dropped offline</span>
          </button>
          <button
            onClick={() => handlePreset('multifloor')}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-400 bg-slate-50/50 dark:bg-slate-900/40 text-left transition-all text-xs"
          >
            <span className="font-semibold block text-blue-600 dark:text-blue-400">5. Multi-Floor Shift</span>
            <span className="text-[10px] text-slate-500">Staircase transition</span>
          </button>
          <button
            onClick={() => handlePreset('hostile')}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-rose-400 bg-slate-50/50 dark:bg-slate-900/40 text-left transition-all text-xs"
          >
            <span className="font-semibold block text-rose-600 dark:text-rose-400">6. Combined Hostile</span>
            <span className="text-[10px] text-slate-500">NLOS + Loss + Fault</span>
          </button>
        </div>
      </div>

      {/* Sliders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
        {/* Noise Sigma */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-300">Gaussian Noise (σ)</span>
            <span className="font-mono font-bold text-indigo-600">{config.noise_sigma.toFixed(2)}m</span>
          </div>
          <input
            type="range"
            min="0.05"
            max="1.50"
            step="0.05"
            value={config.noise_sigma}
            onChange={(e) => onUpdateConfig({ noise_sigma: parseFloat(e.target.value) })}
            className="w-full accent-indigo-600 cursor-pointer"
          />
          <span className="text-[10px] text-slate-400 block">Typical UWB is 0.15m; noisy BLE is &gt;0.5m</span>
        </div>

        {/* NLOS Multipath Bias */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-300">NLOS Multipath Bias</span>
            <span className="font-mono font-bold text-amber-600">+{config.nlos_bias.toFixed(2)}m</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="5.0"
            step="0.2"
            value={config.nlos_bias}
            onChange={(e) => onUpdateConfig({ nlos_bias: parseFloat(e.target.value) })}
            className="w-full accent-amber-500 cursor-pointer"
          />
          <span className="text-[10px] text-slate-400 block">Injected positive reflection delay</span>
        </div>

        {/* Packet Loss */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-300">Packet Drop Rate</span>
            <span className="font-mono font-bold text-rose-600">{(config.packet_loss_rate * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="0.45"
            step="0.05"
            value={config.packet_loss_rate}
            onChange={(e) => onUpdateConfig({ packet_loss_rate: parseFloat(e.target.value) })}
            className="w-full accent-rose-500 cursor-pointer"
          />
          <span className="text-[10px] text-slate-400 block">Random dropped ranging packets</span>
        </div>

        {/* Target Velocity */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-300">Target Speed</span>
            <span className="font-mono font-bold text-emerald-600">{config.speed_mps.toFixed(1)} m/s</span>
          </div>
          <input
            type="range"
            min="0.3"
            max="3.0"
            step="0.1"
            value={config.speed_mps}
            onChange={(e) => onUpdateConfig({ speed_mps: parseFloat(e.target.value) })}
            className="w-full accent-emerald-500 cursor-pointer"
          />
          <span className="text-[10px] text-slate-400 block">Walking speed: 1.2 m/s; Cart: 2.5 m/s</span>
        </div>
      </div>

      {/* Motion Pattern & Hardware Kill-Switch Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
        {/* Motion Patterns */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Target Trajectory Pattern
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { id: 'patrol', label: 'Waypoint Patrol', desc: 'Looping perimeter circuit' },
              { id: 'random_walk', label: 'Random Walk', desc: 'Brownian motion inside rooms' },
              { id: 'stop_and_go', label: 'Stop-and-Go', desc: 'Inspection pauses at benches' },
              { id: 'multi_floor_transition', label: 'Stairwell Climb', desc: 'Transitions floors 1 ↔ 2 ↔ 3' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => onUpdateConfig({ motion_pattern: p.id as any })}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  config.motion_pattern === p.id
                    ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="font-semibold">{p.label}</div>
                <div className="text-[10px] text-slate-500">{p.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Anchor Availability Kill-Switches */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Floor 0{activeFloor} Anchor Kill-Switches (Click to toggle offline)
          </label>
          <div className="grid grid-cols-3 gap-2">
            {currentFloorAnchors.map((anc) => {
              const isOffline = anc.status === 'offline';
              return (
                <button
                  key={anc.id}
                  onClick={() => onToggleAnchor(anc.id, anc.status)}
                  className={`p-2 rounded-xl border text-xs font-medium transition-all flex items-center justify-between ${
                    isOffline
                      ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
                      : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                  }`}
                >
                  <span className="font-mono">{anc.id.split('-')[1] || anc.id}</span>
                  <span className="text-[10px] font-bold">{isOffline ? 'OFFLINE' : 'ONLINE'}</span>
                </button>
              );
            })}
          </div>
          <span className="text-[10px] text-slate-400 block mt-2">
            Taking anchors offline forces the system to cope with sparse geometry and raises GDOP.
          </span>
        </div>
      </div>
    </div>
  );
};
