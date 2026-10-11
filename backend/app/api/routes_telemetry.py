from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
from app.models import TelemetryFrame, SimulationConfig
from app.engine.simulator import IndoorSimulator

router = APIRouter(prefix="/api", tags=["telemetry"])

# Global simulator instance
sim_instance = IndoorSimulator()

def get_simulator() -> IndoorSimulator:
    return sim_instance

@router.get("/telemetry/latest", response_model=TelemetryFrame)
def get_latest_telemetry():
    """Step 1 epoch and return real-time telemetry frame."""
    frame = sim_instance.step()
    return frame

@router.post("/telemetry/step", response_model=List[TelemetryFrame])
def step_simulation(count: int = 1):
    """Step simulation by specified count epochs."""
    count = min(max(count, 1), 50)
    frames = [sim_instance.step() for _ in range(count)]
    return frames

@router.post("/telemetry/reset", response_model=TelemetryFrame)
def reset_simulation():
    """Reset simulator state."""
    global sim_instance
    cfg = sim_instance.config
    sim_instance = IndoorSimulator(config=cfg)
    return sim_instance.step()

@router.get("/simulation/config", response_model=SimulationConfig)
def get_simulation_config():
    """Get active simulation configuration."""
    return sim_instance.config

@router.post("/simulation/config", response_model=SimulationConfig)
def update_simulation_config(new_config: SimulationConfig):
    """Update active simulation configuration."""
    sim_instance.update_config(new_config)
    return sim_instance.config
