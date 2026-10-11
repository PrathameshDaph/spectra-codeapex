import React from 'react';
import { Layers, Activity, Play, Moon, Sun, ShieldCheck, Compass, Sparkles, Database } from 'lucide-react';

interface HeaderProps {
  activeTab: 'live' | 'simulation' | 'benchmark' | 'history';
  setActiveTab: (tab: 'live' | 'simulation' | 'benchmark' | 'history') => void;
  activeFloor: number;
  setActiveFloor: (floor: number) => void;
  isConnected: boolean;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  onOpenDemo: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  activeFloor,
  setActiveFloor,
  isConnected,
  darkMode,
  setDarkMode,
  onOpenDemo,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#0c0d12]/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-6 py-3 transition-colors duration-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-500/20">
            <Compass className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-lg tracking-tight text-slate-900 dark:text-white">
                SPECTRA
              </span>
              <span className="px-2 py-0.5 text-[11px] font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-full border border-indigo-200/60 dark:border-indigo-800/60">
                2.5D Positioning
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-medium bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 rounded-full">
                NonChalants
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
              Reliable Indoor Positioning with Self-Diagnosis • Lead: Prathamesh P. Daph
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-slate-900/90 p-1 rounded-xl border border-slate-200/60 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('live')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === 'live'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            Live Dashboard & Map
          </button>
          <button
            onClick={() => setActiveTab('simulation')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === 'simulation'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Simulation Lab
          </button>
          <button
            onClick={() => setActiveTab('benchmark')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === 'benchmark'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Algorithm Benchmark
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === 'history'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Experiment History
          </button>
        </nav>

        {/* Floor Switcher & Status Controls */}
        <div className="flex items-center gap-3">
          {/* Floor Selection */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200/60 dark:border-slate-800">
            <span className="text-[11px] font-medium text-slate-500 px-2 flex items-center gap-1">
              <Layers className="w-3 h-3" />
              Floor:
            </span>
            {[1, 2, 3].map((f) => (
              <button
                key={f}
                onClick={() => setActiveFloor(f)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  activeFloor === f
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                0{f}
              </button>
            ))}
          </div>

          {/* Guided Demo Button */}
          <button
            onClick={onOpenDemo}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg hover:opacity-90 transition-opacity shadow-xs"
          >
            <Play className="w-3 h-3 fill-current" />
            <span className="hidden sm:inline">Guided Demo</span>
          </button>

          {/* Connection Status Indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-800">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
              }`}
            />
            <span className="text-[11px] font-mono">{isConnected ? 'LIVE (10Hz)' : 'CONNECTING'}</span>
          </div>

          {/* Dark / Light Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg border border-slate-200/60 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
            title="Toggle theme"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
