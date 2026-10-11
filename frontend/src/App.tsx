import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { TelemetryCards } from './components/TelemetryCards';
import { FloorMap } from './components/FloorMap';
import { SelfDiagnosisPanel } from './components/SelfDiagnosisPanel';
import { AdaptiveActionCard } from './components/AdaptiveActionCard';
import { SimulationLab } from './components/SimulationLab';
import { BenchmarkView } from './components/BenchmarkView';
import { HistoryView } from './components/HistoryView';
import { GuidedDemoModal } from './components/GuidedDemoModal';

import { TelemetryFrame, SimulationConfig, AnchorConfig, AdaptiveAction } from './types';
import {
  fetchLatestTelemetry,
  resetSimulation,
  fetchSimulationConfig,
  updateSimulationConfig,
  toggleAnchor,
  TelemetryWebSocketClient
} from './services/api';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'live' | 'simulation' | 'benchmark' | 'history'>('live');
  const [activeFloor, setActiveFloor] = useState<number>(2);
  const [telemetry, setTelemetry] = useState<TelemetryFrame | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [showBaseline, setShowBaseline] = useState<boolean>(true);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isDemoOpen, setIsDemoOpen] = useState<boolean>(false);

  // Simulation Config
  const [config, setConfig] = useState<SimulationConfig>({
    motion_pattern: 'patrol',
    speed_mps: 1.2,
    noise_sigma: 0.20,
    nlos_bias: 2.5,
    nlos_target_anchor: 'A3',
    packet_loss_rate: 0.05,
    disabled_anchors: [],
    floor_id: 2,
    random_seed: 42,
  });

  // Default Anchor Constellation by Floor
  const [anchors, setAnchors] = useState<Record<number, AnchorConfig[]>>({
    1: [
      { id: 'F1-A1', name: 'F1 Lobby North', floor_id: 1, x: 6.0, y: 6.0, z: 2.8, status: 'active' },
      { id: 'F1-A2', name: 'F1 East Corridor', floor_id: 1, x: 44.0, y: 6.0, z: 2.8, status: 'active' },
      { id: 'F1-A3', name: 'F1 Central Hub', floor_id: 1, x: 25.0, y: 15.0, z: 3.0, status: 'active' },
      { id: 'F1-A4', name: 'F1 Logistics West', floor_id: 1, x: 6.0, y: 24.0, z: 2.8, status: 'active' },
      { id: 'F1-A5', name: 'F1 Dock South', floor_id: 1, x: 44.0, y: 24.0, z: 2.8, status: 'active' },
    ],
    2: [
      { id: 'F2-A1', name: 'Anchor A1 (NW Corner)', floor_id: 2, x: 6.0, y: 6.0, z: 2.8, status: 'active' },
      { id: 'F2-A2', name: 'Anchor A2 (NE Corner)', floor_id: 2, x: 44.0, y: 6.0, z: 2.8, status: 'active' },
      { id: 'F2-A3', name: 'Anchor A3 (East Pillar)', floor_id: 2, x: 38.0, y: 18.0, z: 2.8, status: 'active' },
      { id: 'F2-A4', name: 'Anchor A4 (SW Office)', floor_id: 2, x: 6.0, y: 24.0, z: 2.8, status: 'active' },
      { id: 'F2-A5', name: 'Anchor A5 (SE Lab)', floor_id: 2, x: 44.0, y: 24.0, z: 2.8, status: 'active' },
      { id: 'F2-A6', name: 'Anchor A6 (Atrium Center)', floor_id: 2, x: 25.0, y: 14.0, z: 3.2, status: 'active' },
    ],
    3: [
      { id: 'F3-A1', name: 'F3 Server North', floor_id: 3, x: 8.0, y: 6.0, z: 2.8, status: 'active' },
      { id: 'F3-A2', name: 'F3 Boardroom', floor_id: 3, x: 42.0, y: 6.0, z: 2.8, status: 'active' },
      { id: 'F3-A3', name: 'F3 Sky Lounge', floor_id: 3, x: 25.0, y: 15.0, z: 3.0, status: 'active' },
      { id: 'F3-A4', name: 'F3 West Terrace', floor_id: 3, x: 8.0, y: 24.0, z: 2.8, status: 'active' },
      { id: 'F3-A5', name: 'F3 Executive Suite', floor_id: 3, x: 42.0, y: 24.0, z: 2.8, status: 'active' },
    ],
  });

  const wsClientRef = useRef<TelemetryWebSocketClient | null>(null);

  // Sync dark mode class on root html
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Initialize WebSocket stream and fallback polling
  useEffect(() => {
    fetchSimulationConfig().then(setConfig).catch(console.error);

    // Initial fetch to populate telemetry immediately
    fetchLatestTelemetry().then(setTelemetry).catch(console.error);

    // Setup real-time WebSocket connection
    wsClientRef.current = new TelemetryWebSocketClient(
      (frame: TelemetryFrame) => {
        setTelemetry(frame);
        // Automatically reflect floor transitions
        if (frame.spectra_estimate.floor_id) {
          setActiveFloor(frame.spectra_estimate.floor_id);
        }
      },
      (connected: boolean) => {
        setIsConnected(connected);
      }
    );

    return () => {
      if (wsClientRef.current) {
        wsClientRef.current.destroy();
      }
    };
  }, []);

  // Update backend simulation config
  const handleUpdateConfig = async (newCfg: Partial<SimulationConfig>) => {
    const updated = { ...config, ...newCfg };
    setConfig(updated);
    try {
      await updateSimulationConfig(updated);
    } catch (e) {
      console.error(e);
    }
  };

  // Toggle anchor online/offline/nlos
  const handleToggleAnchor = async (anchorId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'offline' ? 'active' : 'offline';
    try {
      await toggleAnchor(anchorId, newStatus);
      setAnchors((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((fStr) => {
          const f = parseInt(fStr);
          next[f] = next[f].map((a) => (a.id === anchorId ? { ...a, status: newStatus as any } : a));
        });
        return next;
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Simulation controls
  const handleTogglePause = () => {
    const nextState = !isPaused;
    setIsPaused(nextState);
    if (wsClientRef.current) {
      wsClientRef.current.send({ type: nextState ? 'pause' : 'resume' });
    }
  };

  const handleReset = async () => {
    try {
      const frame = await resetSimulation();
      setTelemetry(frame);
    } catch (e) {
      console.error(e);
    }
  };

  const handleStep = async () => {
    try {
      const frame = await fetchLatestTelemetry();
      setTelemetry(frame);
    } catch (e) {
      console.error(e);
    }
  };

  // Execute adaptive recommendation action
  const handleApplyAdaptiveAction = async (action: AdaptiveAction) => {
    if (action.action_type === 'FREQUENCY_SHIFT' && action.target_anchor_id) {
      // Clear NLOS bias on targeted anchor
      await handleUpdateConfig({ nlos_bias: 0.0 });
    } else if (action.action_type === 'GEOMETRIC_AUGMENT' && action.target_anchor_id) {
      // Re-enable target anchor
      await handleToggleAnchor(action.target_anchor_id, 'offline');
    } else if (action.action_type === 'AUXILIARY_POLL') {
      // Lower packet loss
      await handleUpdateConfig({ packet_loss_rate: 0.01 });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090a0f] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Top Navigation & Controls */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeFloor={activeFloor}
        setActiveFloor={(f) => {
          setActiveFloor(f);
          if (wsClientRef.current) {
            wsClientRef.current.send({ type: 'set_floor', floor_id: f });
          }
        }}
        isConnected={isConnected}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onOpenDemo={() => setIsDemoOpen(true)}
      />

      {/* Main App Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* View Tab 1: Live Dashboard & Map */}
        {activeTab === 'live' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Top Telemetry KPI Cards */}
            <TelemetryCards telemetry={telemetry} />

            {/* Middle Section: Floor Map & Live Action Decision */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <FloorMap
                  telemetry={telemetry}
                  activeFloor={activeFloor}
                  anchors={anchors}
                  onToggleAnchor={handleToggleAnchor}
                  showBaseline={showBaseline}
                  setShowBaseline={setShowBaseline}
                />
              </div>

              <div className="space-y-4">
                <AdaptiveActionCard
                  action={telemetry?.adaptive_action || null}
                  onApplyAction={handleApplyAdaptiveAction}
                />

                <SelfDiagnosisPanel telemetry={telemetry} />
              </div>
            </div>
          </div>
        )}

        {/* View Tab 2: Simulation Lab */}
        {activeTab === 'simulation' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <SimulationLab
              config={config}
              onUpdateConfig={handleUpdateConfig}
              onReset={handleReset}
              onStep={handleStep}
              isPaused={isPaused}
              onTogglePause={handleTogglePause}
              anchors={anchors}
              activeFloor={activeFloor}
              onToggleAnchor={handleToggleAnchor}
            />

            <div className="p-4 bg-white dark:bg-[#11131b] rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                Live Spatial Response Preview
              </h4>
              <FloorMap
                telemetry={telemetry}
                activeFloor={activeFloor}
                anchors={anchors}
                onToggleAnchor={handleToggleAnchor}
                showBaseline={showBaseline}
                setShowBaseline={setShowBaseline}
              />
            </div>
          </div>
        )}

        {/* View Tab 3: Algorithm Benchmark */}
        {activeTab === 'benchmark' && (
          <div className="animate-in fade-in duration-200">
            <BenchmarkView />
          </div>
        )}

        {/* View Tab 4: SQLite Experiment History */}
        {activeTab === 'history' && (
          <div className="animate-in fade-in duration-200">
            <HistoryView />
          </div>
        )}
      </main>

      {/* Presentation-Ready Guided Demo Modal */}
      <GuidedDemoModal
        isOpen={isDemoOpen}
        onClose={() => setIsDemoOpen(false)}
        onUpdateConfig={handleUpdateConfig}
        onToggleAnchor={handleToggleAnchor}
        setActiveTab={setActiveTab}
        setShowBaseline={setShowBaseline}
      />
    </div>
  );
};

export default App;
