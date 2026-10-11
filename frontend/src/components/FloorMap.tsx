import React, { useState } from 'react';
import { TelemetryFrame, AnchorConfig } from '../types';
import { Eye, EyeOff, Radio, RefreshCw, ZoomIn, ZoomOut, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface FloorMapProps {
  telemetry: TelemetryFrame | null;
  activeFloor: number;
  anchors: Record<number, AnchorConfig[]>;
  onToggleAnchor: (anchorId: string, currentStatus: string) => void;
  showBaseline: boolean;
  setShowBaseline: (show: boolean) => void;
}

export const FloorMap: React.FC<FloorMapProps> = ({
  telemetry,
  activeFloor,
  anchors,
  onToggleAnchor,
  showBaseline,
  setShowBaseline,
}) => {
  const [showRays, setShowRays] = useState(true);
  const [showTrails, setShowTrails] = useState(true);
  const [hoveredAnchor, setHoveredAnchor] = useState<string | null>(null);

  // Map coordinate conversion (50m x 30m room mapped to SVG viewBox 0 0 1000 600)
  const toSvgX = (x: number) => (x / 50.0) * 1000;
  const toSvgY = (y: number) => (y / 30.0) * 600;

  const currentFloorAnchors = anchors[activeFloor] || [];
  const gt = telemetry?.ground_truth;
  const spectra = telemetry?.spectra_estimate;
  const ols = telemetry?.ols_estimate;

  // Measurement lookup by anchor id
  const measurementMap: Record<string, any> = {};
  if (telemetry?.measurements) {
    telemetry.measurements.forEach((m) => {
      measurementMap[m.anchor_id] = m;
    });
  }

  return (
    <div className="relative flex flex-col bg-white dark:bg-[#11131b] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden transition-colors">
      {/* Map Header Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Floor 0{activeFloor} Architectural Blueprint
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            Dimensions: 50.0m × 30.0m
          </span>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBaseline(!showBaseline)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
              showBaseline
                ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
            }`}
          >
            {showBaseline ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            Compare Baseline OLS
          </button>

          <button
            onClick={() => setShowRays(!showRays)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
              showRays
                ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            Range Vectors
          </button>
        </div>
      </div>

      {/* SVG Interactive Map Area */}
      <div className="relative w-full aspect-[1000/600] bg-slate-50 dark:bg-[#0a0b10] bg-grid-pattern p-4 flex items-center justify-center">
        <svg
          viewBox="0 0 1000 600"
          className="w-full h-full select-none"
          style={{ maxHeight: '620px' }}
        >
          <defs>
            {/* Grid pattern */}
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-slate-200 dark:text-slate-800/80" />
            </pattern>
            {/* Radar gradient */}
            <radialGradient id="target-radar" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
            </radialGradient>
            <radialGradient id="ols-radar" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
            </radialGradient>
          </defs>

          {/* Background Grid */}
          <rect width="1000" height="600" fill="url(#grid)" />

          {/* Architectural Layout: Outer Walls */}
          <rect
            x="30"
            y="30"
            width="940"
            height="540"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-slate-300 dark:text-slate-700"
            rx="8"
          />

          {/* Architectural Rooms */}
          {/* Room 1: West Wing Offices */}
          <rect x="30" y="30" width="220" height="240" fill="currentColor" stroke="currentColor" strokeWidth="1.5" className="text-slate-100/60 dark:text-slate-800/40 text-slate-300 dark:text-slate-700" />
          <text x="50" y="60" className="text-[12px] font-medium fill-slate-400 dark:fill-slate-500">Logistics & Lab A</text>

          {/* Room 2: South West Conference */}
          <rect x="30" y="330" width="220" height="240" fill="currentColor" stroke="currentColor" strokeWidth="1.5" className="text-slate-100/60 dark:text-slate-800/40 text-slate-300 dark:text-slate-700" />
          <text x="50" y="360" className="text-[12px] font-medium fill-slate-400 dark:fill-slate-500">Boardroom West</text>

          {/* Room 3: East Wing Server & Tech Lab */}
          <rect x="750" y="30" width="220" height="240" fill="currentColor" stroke="currentColor" strokeWidth="1.5" className="text-slate-100/60 dark:text-slate-800/40 text-slate-300 dark:text-slate-700" />
          <text x="770" y="60" className="text-[12px] font-medium fill-slate-400 dark:fill-slate-500">High-Density Compute</text>

          {/* Room 4: South East Research Zone */}
          <rect x="750" y="330" width="220" height="240" fill="currentColor" stroke="currentColor" strokeWidth="1.5" className="text-slate-100/60 dark:text-slate-800/40 text-slate-300 dark:text-slate-700" />
          <text x="770" y="360" className="text-[12px] font-medium fill-slate-400 dark:fill-slate-500">Robotics Workshop</text>

          {/* Central Structural Concrete Core / Elevator Shaft (NLOS Multipath Cause) */}
          <rect
            x="460"
            y="250"
            width="80"
            height="100"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="2"
            className="text-slate-200 dark:text-slate-800 text-slate-400 dark:text-slate-600"
            rx="4"
          />
          <text x="472" y="295" className="text-[10px] font-semibold fill-slate-500 dark:fill-slate-400">ELEVATOR</text>
          <text x="474" y="310" className="text-[9px] fill-amber-600 dark:fill-amber-400 font-medium">NLOS CORE</text>

          {/* Staircase (Multi-Floor Transition Zone) */}
          <rect x="880" y="270" width="90" height="60" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" className="text-slate-400 dark:text-slate-600" />
          <text x="895" y="305" className="text-[11px] font-medium fill-slate-500 dark:fill-slate-400">STAIRWELL</text>

          {/* Measurement Ranging Vectors from Anchors to Estimate */}
          {showRays && spectra && currentFloorAnchors.map((anc) => {
            const meas = measurementMap[anc.id];
            if (!meas || meas.status === 'offline' || meas.status === 'dropped') return null;

            const ax = toSvgX(anc.x);
            const ay = toSvgY(anc.y);
            const tx = toSvgX(spectra.x);
            const ty = toSvgY(spectra.y);

            // Color-code vector by trust and NLOS
            let strokeColor = '#10b981'; // green LOS
            let strokeDash = 'none';
            if (meas.status === 'rejected') {
              strokeColor = '#ef4444'; // red
              strokeDash = '4 4';
            } else if (meas.status === 'downweighted' || meas.is_nlos) {
              strokeColor = '#f59e0b'; // amber NLOS
              strokeDash = '6 3';
            }

            return (
              <g key={`ray-${anc.id}`}>
                <line
                  x1={ax}
                  y1={ay}
                  x2={tx}
                  y2={ty}
                  stroke={strokeColor}
                  strokeWidth="1.5"
                  strokeDasharray={strokeDash}
                  opacity="0.6"
                />
                {/* Distance label midpoint */}
                <circle cx={(ax + tx) / 2} cy={(ay + ty) / 2} r="10" fill="white" className="dark:fill-slate-900" stroke={strokeColor} strokeWidth="1" />
                <text
                  x={(ax + tx) / 2}
                  y={(ay + ty) / 2 + 3}
                  textAnchor="middle"
                  className="text-[9px] font-mono font-medium fill-slate-700 dark:fill-slate-300"
                >
                  {meas.raw_distance.toFixed(1)}m
                </text>
              </g>
            );
          })}

          {/* Baseline OLS Ghost Marker & Error Vector */}
          {showBaseline && ols && gt && (
            <g>
              {/* Divergence Line between Ground Truth and OLS */}
              <line
                x1={toSvgX(gt.x)}
                y1={toSvgY(gt.y)}
                x2={toSvgX(ols.x)}
                y2={toSvgY(ols.y)}
                stroke="#ef4444"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                opacity="0.8"
              />
              {/* OLS Puck */}
              <circle
                cx={toSvgX(ols.x)}
                cy={toSvgY(ols.y)}
                r="18"
                fill="url(#ols-radar)"
              />
              <circle
                cx={toSvgX(ols.x)}
                cy={toSvgY(ols.y)}
                r="7"
                fill="#ef4444"
                stroke="white"
                strokeWidth="2"
              />
              <text
                x={toSvgX(ols.x)}
                y={toSvgY(ols.y) - 12}
                textAnchor="middle"
                className="text-[10px] font-bold fill-red-600 dark:fill-red-400"
              >
                OLS Error: {telemetry?.current_error_ols.toFixed(2)}m
              </text>
            </g>
          )}

          {/* SPECTRA 95% Uncertainty Ellipse */}
          {spectra && (
            <ellipse
              cx={toSvgX(spectra.x)}
              cy={toSvgY(spectra.y)}
              rx={(spectra.uncertainty_semi_major / 50.0) * 1000}
              ry={(spectra.uncertainty_semi_minor / 30.0) * 600}
              transform={`rotate(${spectra.uncertainty_angle_deg} ${toSvgX(spectra.x)} ${toSvgY(spectra.y)})`}
              fill="#6366f1"
              fillOpacity="0.12"
              stroke="#6366f1"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
          )}

          {/* Ground Truth Target Marker */}
          {gt && (
            <g>
              <rect
                x={toSvgX(gt.x) - 7}
                y={toSvgY(gt.y) - 7}
                width="14"
                height="14"
                fill="#0f172a"
                className="dark:fill-white"
                stroke="#64748b"
                strokeWidth="2"
                transform={`rotate(45 ${toSvgX(gt.x)} ${toSvgY(gt.y)})`}
              />
              <text
                x={toSvgX(gt.x)}
                y={toSvgY(gt.y) + 20}
                textAnchor="middle"
                className="text-[10px] font-mono font-medium fill-slate-600 dark:fill-slate-400"
              >
                Truth ({gt.x.toFixed(1)}, {gt.y.toFixed(1)})
              </text>
            </g>
          )}

          {/* SPECTRA Estimated Position Marker */}
          {spectra && (
            <g>
              <circle
                cx={toSvgX(spectra.x)}
                cy={toSvgY(spectra.y)}
                r="24"
                fill="url(#target-radar)"
              />
              <circle
                cx={toSvgX(spectra.x)}
                cy={toSvgY(spectra.y)}
                r="8"
                fill="#4338ca"
                className="dark:fill-indigo-500"
                stroke="white"
                strokeWidth="2.5"
              />
              <text
                x={toSvgX(spectra.x)}
                y={toSvgY(spectra.y) - 14}
                textAnchor="middle"
                className="text-[11px] font-bold fill-indigo-700 dark:fill-indigo-300"
              >
                SPECTRA ({spectra.x.toFixed(1)}, {spectra.y.toFixed(1)})
              </text>
            </g>
          )}

          {/* Fixed Anchors Plotted on Map */}
          {currentFloorAnchors.map((anc) => {
            const ax = toSvgX(anc.x);
            const ay = toSvgY(anc.y);
            const isHovered = hoveredAnchor === anc.id;
            const meas = measurementMap[anc.id];

            let anchorBg = '#10b981'; // Active Green
            let statusText = 'HEALTHY LOS';
            if (anc.status === 'offline') {
              anchorBg = '#94a3b8'; // Offline Gray
              statusText = 'OFFLINE';
            } else if (anc.status === 'nlos' || meas?.is_nlos) {
              anchorBg = '#f59e0b'; // NLOS Amber
              statusText = 'NLOS DETECTED';
            } else if (meas?.status === 'rejected') {
              anchorBg = '#ef4444'; // Outlier Red
              statusText = 'OUTLIER REJECTED';
            }

            return (
              <g
                key={anc.id}
                className="cursor-pointer transition-transform hover:scale-110"
                onClick={() => onToggleAnchor(anc.id, anc.status)}
                onMouseEnter={() => setHoveredAnchor(anc.id)}
                onMouseLeave={() => setHoveredAnchor(null)}
              >
                {/* Pulse ring for active anchors */}
                {anc.status === 'active' && (
                  <circle cx={ax} cy={ay} r="16" fill={anchorBg} opacity="0.2" className="animate-ping" />
                )}

                {/* Anchor Base Pin */}
                <circle
                  cx={ax}
                  cy={ay}
                  r="11"
                  fill={anchorBg}
                  stroke="white"
                  strokeWidth="2"
                  className="shadow-md"
                />
                <text
                  x={ax}
                  y={ay + 3.5}
                  textAnchor="middle"
                  className="text-[9px] font-bold fill-white select-none pointer-events-none"
                >
                  {anc.id.split('-')[1] || anc.id}
                </text>

                {/* Tooltip on Hover */}
                {isHovered && (
                  <g>
                    <rect
                      x={ax - 60}
                      y={ay - 48}
                      width="120"
                      height="40"
                      rx="6"
                      fill="#0f172a"
                      opacity="0.95"
                    />
                    <text x={ax} y={ay - 34} textAnchor="middle" className="text-[10px] font-bold fill-white">
                      {anc.name}
                    </text>
                    <text x={ax} y={ay - 20} textAnchor="middle" className="text-[9px] fill-amber-300 font-mono">
                      {statusText} (Click to toggle)
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Floating Map Legend */}
        <div className="absolute bottom-4 left-6 flex flex-wrap items-center gap-3 px-3.5 py-2 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 shadow-sm">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
            <span className="font-medium">SPECTRA Fix</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rotate-45 bg-slate-900 dark:bg-white" />
            <span className="font-medium">Ground Truth</span>
          </div>
          {showBaseline && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="font-medium">Baseline OLS</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-700 pl-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Active LOS</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>NLOS Flagged</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span>Offline</span>
          </div>
        </div>
      </div>
    </div>
  );
};
