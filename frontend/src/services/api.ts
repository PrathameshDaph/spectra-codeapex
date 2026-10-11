import { TelemetryFrame, SimulationConfig, BenchmarkRequest, BenchmarkResult, ExperimentRecord } from '../types';
import { clientSim } from './clientEngine';

const API_BASE = 'http://127.0.0.1:8000/api';
const WS_URL = 'ws://127.0.0.1:8000/ws/telemetry';

export async function fetchLatestTelemetry(): Promise<TelemetryFrame> {
  try {
    const res = await fetch(`${API_BASE}/telemetry/latest`, { signal: AbortSignal.timeout(1000) });
    if (!res.ok) throw new Error('API offline');
    return await res.json();
  } catch (e) {
    return clientSim.step();
  }
}

export async function resetSimulation(): Promise<TelemetryFrame> {
  try {
    const res = await fetch(`${API_BASE}/telemetry/reset`, { method: 'POST', signal: AbortSignal.timeout(1000) });
    if (!res.ok) throw new Error('API offline');
    return await res.json();
  } catch (e) {
    clientSim.reset();
    return clientSim.step();
  }
}

export async function fetchSimulationConfig(): Promise<SimulationConfig> {
  try {
    const res = await fetch(`${API_BASE}/simulation/config`, { signal: AbortSignal.timeout(1000) });
    if (!res.ok) throw new Error('API offline');
    return await res.json();
  } catch (e) {
    return clientSim.config;
  }
}

export async function updateSimulationConfig(cfg: Partial<SimulationConfig>): Promise<SimulationConfig> {
  try {
    const res = await fetch(`${API_BASE}/simulation/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
      signal: AbortSignal.timeout(1000),
    });
    if (!res.ok) throw new Error('API offline');
    return await res.json();
  } catch (e) {
    clientSim.config = { ...clientSim.config, ...cfg };
    return clientSim.config;
  }
}

export async function toggleAnchor(anchorId: string, status: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/anchors/${anchorId}/status?status=${status}`, {
      method: 'POST',
      signal: AbortSignal.timeout(1000),
    });
    if (!res.ok) throw new Error('API offline');
    return await res.json();
  } catch (e) {
    for (const f in clientSim.anchorsByFloor) {
      const anc = clientSim.anchorsByFloor[f].find((a) => a.id === anchorId);
      if (anc) anc.status = status;
    }
    return { anchor_id: anchorId, new_status: status, success: true };
  }
}

export async function runBenchmark(req: BenchmarkRequest): Promise<BenchmarkResult> {
  try {
    const res = await fetch(`${API_BASE}/benchmark/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) throw new Error('API offline');
    return await res.json();
  } catch (e) {
    const res = clientSim.runBenchmark(req.duration_epochs, req.scenario_type);
    // Save to localStorage
    const saved = JSON.parse(localStorage.getItem('spectra_experiments') || '[]');
    saved.unshift({
      id: res.id,
      name: res.run_name,
      scenario: res.scenario_type,
      created_at: res.timestamp,
      mae_ols: res.ols_metrics.mae,
      mae_spectra: res.spectra_metrics.mae,
      improvement_pct: Number((((res.ols_metrics.mae - res.spectra_metrics.mae) / res.ols_metrics.mae) * 100).toFixed(1)),
    });
    localStorage.setItem('spectra_experiments', JSON.stringify(saved.slice(0, 20)));
    return res;
  }
}

export async function fetchExperiments(): Promise<ExperimentRecord[]> {
  try {
    const res = await fetch(`${API_BASE}/experiments`, { signal: AbortSignal.timeout(1000) });
    if (!res.ok) throw new Error('API offline');
    return await res.json();
  } catch (e) {
    return JSON.parse(localStorage.getItem('spectra_experiments') || '[]');
  }
}

export async function fetchExperimentDetails(id: number): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/experiments/${id}`, { signal: AbortSignal.timeout(1000) });
    if (!res.ok) throw new Error('API offline');
    return await res.json();
  } catch (e) {
    const saved = JSON.parse(localStorage.getItem('spectra_experiments') || '[]');
    return saved.find((x: any) => x.id === id) || null;
  }
}

export async function deleteExperiment(id: number): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/experiments/${id}`, { method: 'DELETE', signal: AbortSignal.timeout(1000) });
    if (!res.ok) throw new Error('API offline');
    return await res.json();
  } catch (e) {
    const saved = JSON.parse(localStorage.getItem('spectra_experiments') || '[]');
    const filtered = saved.filter((x: any) => x.id !== id);
    localStorage.setItem('spectra_experiments', JSON.stringify(filtered));
    return { id, deleted: true };
  }
}

export function getExportCsvUrl(id: number): string {
  return `${API_BASE}/experiments/${id}/export/csv`;
}

export function getExportJsonUrl(id: number): string {
  return `${API_BASE}/experiments/${id}/export/json`;
}

export class TelemetryWebSocketClient {
  private ws: WebSocket | null = null;
  private onMessageCallback: (frame: TelemetryFrame) => void;
  private onStatusChange: (connected: boolean) => void;
  private isDestroyed = false;
  private fallbackInterval: any = null;

  constructor(
    onMessage: (frame: TelemetryFrame) => void,
    onStatus: (connected: boolean) => void
  ) {
    this.onMessageCallback = onMessage;
    this.onStatusChange = onStatus;
    this.connect();
  }

  public connect() {
    if (this.isDestroyed) return;
    try {
      this.ws = new WebSocket(WS_URL);
      this.ws.onopen = () => {
        this.stopFallback();
        this.onStatusChange(true);
      };
      this.ws.onmessage = (event) => {
        try {
          const frame: TelemetryFrame = JSON.parse(event.data);
          this.onMessageCallback(frame);
        } catch (e) {
          console.error('Error parsing telemetry frame:', e);
        }
      };
      this.ws.onclose = () => {
        this.startFallback();
      };
      this.ws.onerror = () => {
        this.startFallback();
      };
    } catch (e) {
      this.startFallback();
    }
  }

  private startFallback() {
    this.onStatusChange(true); // Connected to client simulation engine
    if (!this.fallbackInterval && !this.isDestroyed) {
      this.fallbackInterval = setInterval(() => {
        const frame = clientSim.step();
        this.onMessageCallback(frame);
      }, 100); // 10 Hz real-time
    }
  }

  private stopFallback() {
    if (this.fallbackInterval) {
      clearInterval(this.fallbackInterval);
      this.fallbackInterval = null;
    }
  }

  public send(data: Record<string, any>) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      if (data.type === 'set_floor') {
        clientSim.setFloor(data.floor_id);
      } else if (data.type === 'reset') {
        clientSim.reset();
      }
    }
  }

  public destroy() {
    this.isDestroyed = true;
    this.stopFallback();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
