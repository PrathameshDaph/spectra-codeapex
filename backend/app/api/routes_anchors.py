from fastapi import APIRouter, HTTPException
from typing import Dict, List, Any
from app.api.routes_telemetry import get_simulator

router = APIRouter(prefix="/api/anchors", tags=["anchors"])

@router.get("")
def list_anchors() -> Dict[int, List[Dict[str, Any]]]:
    """Return all anchors organized by floor."""
    sim = get_simulator()
    return sim.anchors

@router.post("/{anchor_id}/status")
def set_anchor_status(anchor_id: str, status: str):
    """
    Update anchor operating status: 'active', 'offline', 'nlos', 'degraded'.
    """
    sim = get_simulator()
    valid_statuses = ["active", "offline", "nlos", "degraded"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")
    
    success = sim.toggle_anchor_status(anchor_id, status)
    if not success:
        raise HTTPException(status_code=404, detail=f"Anchor {anchor_id} not found")
        
    return {"anchor_id": anchor_id, "new_status": status, "success": True}
