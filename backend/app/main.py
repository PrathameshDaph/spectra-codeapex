from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
import logging

from app.database import init_db
from app.api.routes_telemetry import router as telemetry_router, get_simulator
from app.api.routes_anchors import router as anchors_router
from app.api.routes_benchmark import router as benchmark_router
from app.api.routes_experiments import router as experiments_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("spectra")

app = FastAPI(
    title="SPECTRA Indoor Positioning API",
    description="Trust-aware 2.5D indoor localization backend with real-time self-diagnosis, robust M-estimation, and geometry-adaptive sensing.",
    version="1.0.0"
)

# Enable CORS for local development and IDE previews
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(telemetry_router)
app.include_router(anchors_router)
app.include_router(benchmark_router)
app.include_router(experiments_router)

@app.on_event("startup")
def startup_event():
    init_db()
    logger.info("SPECTRA database initialized.")

@app.get("/health")
@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "SPECTRA Indoor Positioning Engine",
        "version": "1.0.0",
        "active_floor": get_simulator().target_floor
    }

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in list(self.active_connections):
            try:
                await connection.send_text(message)
            except Exception:
                self.disconnect(connection)

manager = ConnectionManager()

@app.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    sim = get_simulator()
    is_paused = False
    try:
        while True:
            # Check for incoming client messages with non-blocking timeout
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=0.1)
                msg = json.loads(data)
                if msg.get("type") == "pause":
                    is_paused = True
                elif msg.get("type") == "resume":
                    is_paused = False
                elif msg.get("type") == "reset":
                    sim = get_simulator()
                    sim.epoch = 0
                    sim.target_x = 10.0
                    sim.target_y = 15.0
                elif msg.get("type") == "set_floor":
                    sim.target_floor = int(msg.get("floor_id", 2))
                    sim.target_z = 1.2 + (sim.target_floor - 1) * 3.5
            except asyncio.TimeoutError:
                pass

            if not is_paused:
                frame = sim.step()
                await websocket.send_text(frame.json())
            
            await asyncio.sleep(0.08)  # ~12 FPS real-time smooth rate
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WebSocket client disconnected: {e}")
        manager.disconnect(websocket)
