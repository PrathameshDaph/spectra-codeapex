import sqlite3
import json
import os
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "spectra_history.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS experiments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        scenario TEXT NOT NULL,
        created_at TEXT NOT NULL,
        mae_ols REAL NOT NULL,
        mae_spectra REAL NOT NULL,
        improvement_pct REAL NOT NULL,
        config_json TEXT NOT NULL,
        metrics_json TEXT NOT NULL
    )
    """)
    conn.commit()
    conn.close()

def save_experiment(name: str, scenario: str, created_at: str, mae_ols: float, mae_spectra: float, improvement_pct: float, config: Dict[str, Any], metrics: Dict[str, Any]) -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO experiments (name, scenario, created_at, mae_ols, mae_spectra, improvement_pct, config_json, metrics_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        name,
        scenario,
        created_at,
        float(mae_ols),
        float(mae_spectra),
        float(improvement_pct),
        json.dumps(config),
        json.dumps(metrics)
    ))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return new_id

def list_experiments() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, scenario, created_at, mae_ols, mae_spectra, improvement_pct FROM experiments ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_experiment_by_id(exp_id: int) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM experiments WHERE id = ?", (exp_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        res = dict(row)
        res["config"] = json.loads(res["config_json"])
        res["metrics"] = json.loads(res["metrics_json"])
        return res
    return None

def delete_experiment(exp_id: int) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM experiments WHERE id = ?", (exp_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted
