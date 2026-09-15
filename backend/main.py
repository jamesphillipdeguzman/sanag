from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import sqlite3
from typing import List, Optional
from calculator import compute_recovery_index

app = FastAPI(
    title="SANAG API",
    description="Satellite Analytics for Nightlight & Assessment Grid - Backend API",
    version="1.0.0"
)

# Enable CORS for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.path.join(os.path.dirname(__file__), "db", "sanag.db")

# --- Pydantic Response Shapes (Documentation & Clean Payloads) ---

class MunicipalityResponse(BaseModel):
    municipalities: List[str]

class EventModel(BaseModel):
    id: int
    municipality_code: Optional[str] = None
    barangay_code: Optional[str] = None
    name: str
    description: Optional[str] = None
    date: str
    category: Optional[str] = None
    image_url: Optional[str] = None

class EventsResponse(BaseModel):
    events: List[EventModel]

class RecoveryScoresResponse(BaseModel):
    records_count: int
    data: List[dict]

class TimelineResponse(BaseModel):
    municipality: str
    timeline: List[dict]


# --- Endpoints ---

@app.get("/", tags=["System"])
def read_root():
    return {"status": "SANAG Engine Online", "docs": "/docs"}


@app.get("/api/v1/municipalities", response_model=MunicipalityResponse, tags=["Municipalities"])
def get_municipalities():
    """Returns a clean JSON list of all monitored municipalities."""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT DISTINCT municipality_name FROM baselines ORDER BY municipality_name ASC")
        rows = cursor.fetchall()
        conn.close()
        return {"municipalities": [row["municipality_name"] for row in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/api/v1/events", response_model=EventsResponse, tags=["Events"])
def get_events():
    """Returns all historical disaster and power disruption event records."""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM events")
        rows = cursor.fetchall()
        conn.close()
        return {"events": [dict(row) for row in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/api/v1/recovery-scores", response_model=RecoveryScoresResponse, tags=["Recovery Engine"])
def get_recovery_scores(
    municipality: Optional[str] = Query(None, description="Filter by specific municipality name"),
    start_date: Optional[str] = Query(None, description="Filter observations from YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="Filter observations up to YYYY-MM-DD")
):
    """Computes and returns R(t) recovery scores with optional filters for municipality and date ranges."""
    try:
        scores = compute_recovery_index()
        
        # Apply query parameter filters
        filtered = scores
        if municipality:
            filtered = [s for s in filtered if (s.get("municipality_name") or "").lower() == municipality.lower()]
        if start_date:
            filtered = [s for s in filtered if (s.get("date") or "") >= start_date]
        if end_date:
            filtered = [s for s in filtered if (s.get("date") or "") <= end_date]
            
        return {"records_count": len(filtered), "data": filtered}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/events/{event_id}/radiance", tags=["Events & Spatial Data"])
def get_event_radiance(
    event_id: int,
    municipality: Optional[str] = Query(None, description="Optional municipality filter")
):
    """Connects historical event records to spatial/time radiance data, filterable by municipality."""
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
    
    query = """
        SELECT o.municipality_name, o.observation_date, o.daily_radiance, b.baseline_radiance
        FROM radiance_observations o
        LEFT JOIN baselines b ON o.municipality_name = b.municipality_name
        WHERE o.observation_date = ?
    """
    params = [target_date]
    
    if municipality:
        query += " AND LOWER(o.municipality_name) = LOWER(?)"
        params.append(municipality)
        
    query += " ORDER BY o.municipality_name ASC"
    
    cursor.execute(query, params)
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


@app.get("/api/v1/resilience/timeline/{municipality_name}", response_model=TimelineResponse, tags=["Timeline"])
def get_municipality_timeline(
    municipality_name: str,
    start_date: Optional[str] = Query(None, description="Start date filter YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date filter YYYY-MM-DD")
):
    """Returns the day-by-day recovery timeline for a specific municipality with optional date filtering."""
    scores = compute_recovery_index()
    filtered = [
        s for s in scores 
        if s.get("municipality_name") and s["municipality_name"].lower() == municipality_name.lower()
    ]
    
    if not filtered:
        raise HTTPException(status_code=404, detail=f"Municipality '{municipality_name}' not found.")
        
    if start_date:
        filtered = [s for s in filtered if (s.get("date") or "") >= start_date]
    if end_date:
        filtered = [s for s in filtered if (s.get("date") or "") <= end_date]
    
    
    return {"municipality": municipality_name, "timeline": filtered}