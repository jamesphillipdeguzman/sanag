from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import sqlite3
from calculator import compute_recovery_index

app = FastAPI(
    title="SANAG API",
    description="Satellite Analytics for Nightlight & Assessment Grid - Backend API",
    version="1.0.0"
)

# Enable CORS for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.path.join(os.path.dirname(__file__), "db", "sanag.db")

@app.get("/")
def read_root():
    return {"status": "SANAG Engine Online", "docs": "/docs"}

@app.get("/api/v1/municipalities")
def get_municipalities():
    """Returns a list of all monitored municipalities."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT municipality_name FROM baselines")
    rows = cursor.fetchall()
    conn.close()
    return {"municipalities": [row["municipality_name"] for row in rows]}

@app.get("/api/v1/events")
def get_events():
    """Returns historical event records from the database."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM events")
    rows = cursor.fetchall()
    conn.close()
    return {"events": [dict(row) for row in rows]}

@app.get("/api/v1/events/{event_id}/radiance")
def get_event_radiance(event_id: int):
    """Connects a historical event record to its matching spatial/time radiance data."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM events WHERE id = ?", (event_id,))
    event = cursor.fetchone()
    if not event:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Event ID {event_id} not found.")
    
    event_dict = dict(event)
    target_date = event_dict.get("date")
    
    # Query spatial/time radiance observations matching the event date
    cursor.execute("""
        SELECT o.municipality_name, o.observation_date, o.daily_radiance, b.baseline_radiance
        FROM radiance_observations o
        LEFT JOIN baselines b ON o.municipality_name = b.municipality_name
        WHERE o.observation_date = ?
        ORDER BY o.municipality_name ASC
    """, (target_date,))
    
    rows = cursor.fetchall()
    conn.close()
    
    spatial_time_data = []
    for row in rows:
        rad = row["daily_radiance"]
        base = row["baseline_radiance"]
        r_t = round(rad / base, 4) if base and base > 0 and rad is not None else None
        
        spatial_time_data.append({
            "municipality_name": row["municipality_name"],
            "observation_date": row["observation_date"],
            "post_event_radiance": rad,
            "baseline_radiance": base,
            "r_t": r_t
        })
        
    return {
        "event": event_dict,
        "spatial_time_records_count": len(spatial_time_data),
        "data": spatial_time_data
    }

@app.get("/api/v1/recovery-scores")
def get_recovery_scores():
    """Computes and returns the R(t) recovery scores for all observations from the database."""
    try:
        scores = compute_recovery_index()
        return {"records_count": len(scores), "data": scores}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/resilience/timeline/{municipality_name}")
def get_municipality_timeline(municipality_name: str):
    """Returns the day-by-day recovery timeline and milestones for a specific municipality."""
    scores = compute_recovery_index()
    filtered = [
        s for s in scores 
        if s.get("municipality_name") and s["municipality_name"].lower() == municipality_name.lower()
    ]
    
    if not filtered:
        raise HTTPException(status_code=404, detail=f"Municipality '{municipality_name}' not found.")
        
    return {"municipality": municipality_name, "timeline": filtered}