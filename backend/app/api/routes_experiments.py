from fastapi import APIRouter, HTTPException, Response
from typing import List, Dict, Any
import csv
import io
import json

from app.database import list_experiments, get_experiment_by_id, delete_experiment

router = APIRouter(prefix="/api/experiments", tags=["experiments"])

@router.get("", response_model=List[Dict[str, Any]])
def get_experiments_list():
    """List all saved benchmark experiment runs."""
    return list_experiments()

@router.get("/{exp_id}")
def get_experiment_details(exp_id: int):
    """Retrieve full configuration and metrics for a specific experiment run."""
    record = get_experiment_by_id(exp_id)
    if not record:
        raise HTTPException(status_code=404, detail="Experiment run not found")
    return record

@router.get("/{exp_id}/export/csv")
def export_experiment_csv(exp_id: int):
    """Export experiment results as a CSV file."""
    record = get_experiment_by_id(exp_id)
    if not record:
        raise HTTPException(status_code=404, detail="Experiment run not found")
        
    metrics = record.get("metrics", {})
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow(["SPECTRA Experiment Benchmark Report"])
    writer.writerow(["ID", record["id"]])
    writer.writerow(["Name", record["name"]])
    writer.writerow(["Scenario", record["scenario"]])
    writer.writerow(["Date", record["created_at"]])
    writer.writerow(["OLS MAE (m)", record["mae_ols"]])
    writer.writerow(["SPECTRA MAE (m)", record["mae_spectra"]])
    writer.writerow(["Improvement (%)", f"{record['improvement_pct']:.2f}%"])
    writer.writerow([])
    
    writer.writerow(["Algorithm", "MAE (m)", "RMSE (m)", "P95 Error (m)", "Floor Accuracy (%)", "Availability (%)", "Mean Latency (ms)"])
    for key in ["ols", "robust", "spectra"]:
        if key in metrics:
            m = metrics[key]
            writer.writerow([
                m.get("algorithm_name", key),
                m.get("mae", 0),
                m.get("rmse", 0),
                m.get("p95_error", 0),
                m.get("floor_accuracy_pct", 0),
                m.get("availability_pct", 0),
                m.get("mean_latency_ms", 0)
            ])
            
    writer.writerow([])
    writer.writerow(["Key Findings"])
    for f in metrics.get("findings", []):
        writer.writerow([f])
        
    csv_content = output.getvalue()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="spectra_experiment_{exp_id}.csv"'}
    )

@router.get("/{exp_id}/export/json")
def export_experiment_json(exp_id: int):
    """Export complete experiment run as JSON."""
    record = get_experiment_by_id(exp_id)
    if not record:
        raise HTTPException(status_code=404, detail="Experiment run not found")
    return Response(
        content=json.dumps(record, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="spectra_experiment_{exp_id}.json"'}
    )

@router.delete("/{exp_id}")
def remove_experiment(exp_id: int):
    """Delete an experiment run from database."""
    deleted = delete_experiment(exp_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Experiment run not found")
    return {"id": exp_id, "deleted": True}
