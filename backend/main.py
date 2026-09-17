from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import sqlite3
from typing import List, Optional, Dict, Any
from calculator import compute_recovery_index

app = FastAPI(
    title="SANAG API",
    description="Satellite Analytics for Nightlight & Assessment Grid - Backend API",
    version="1.1.0"
)

# Enable CORS for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "db", "sanag.db")

# --- Pydantic Response Shapes ---

class MunicipalityItem(BaseModel):
    name: str
    pcode: str

class MunicipalityResponse(BaseModel):
    municipalities: List[str]
    items: Optional[List[MunicipalityItem]] = None

class EventModel(BaseModel):
    id: str
    municipality_code: Optional[str] = None
    name: str
    description: Optional[str] = None
    date: str
    category: str
    image_url: Optional[str] = None

class EventsResponse(BaseModel):
    events: List[EventModel]

class RecoveryScoresResponse(BaseModel):
    records_count: int
    data: List[Dict[str, Any]]

class TimelineResponse(BaseModel):
    municipality: str
    pcode: Optional[str] = None
    timeline: List[Dict[str, Any]]


# --- Endpoints ---

@app.get("/", tags=["System"])
def read_root():
    return {"status": "SANAG Engine Online", "docs": "/docs", "version": "1.1.0"}


@app.get("/api/v1/municipalities", response_model=MunicipalityResponse, tags=["Municipalities"])
def get_municipalities():
    """
    Returns a clean list of all 93 monitored Panay municipalities
    with their ADM3_PCODE for geospatial binding.
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT name, code FROM municipalities ORDER BY name ASC")
        rows = cursor.fetchall()
        conn.close()

        items = [{"name": row["name"], "pcode": row["code"]} for row in rows]
        return {
            "municipalities": [row["name"] for row in rows],
            "items": items
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/api/v1/events", response_model=EventsResponse, tags=["Events"])
def get_events():
    """
    Returns all historical disaster and power disruption event records.
    Excludes barangay fields and supports island-wide or municipality-scoped codes.
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT id, municipality_code, name, description, date, category, image_url FROM events ORDER BY date DESC")
        rows = cursor.fetchall()
        conn.close()
        return {"events": [dict(row) for row in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/api/v1/recovery-scores", response_model=RecoveryScoresResponse, tags=["Recovery Engine"])
def get_recovery_scores(
    municipality: Optional[str] = Query(None, description="Filter by specific municipality name or ADM3_PCODE"),
    start_date: Optional[str] = Query(None, description="Filter observations from YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="Filter observations up to YYYY-MM-DD")
):
    """
    Computes and returns R(t) recovery scores with both municipality_name and pcode
    for direct Leaflet map binding without string-matching errors.
    """
    try:
        scores = compute_recovery_index()
        
        filtered = scores
        if municipality and isinstance(municipality, str):
            mun_query = municipality.strip().lower()
            filtered = [
                s for s in filtered 
                if (s.get("municipality_name") or "").lower() == mun_query
                or (s.get("pcode") or "").lower() == mun_query
            ]
        if start_date and isinstance(start_date, str):
            filtered = [s for s in filtered if (s.get("date") or "") >= start_date]
        if end_date and isinstance(end_date, str):
            filtered = [s for s in filtered if (s.get("date") or "") <= end_date]
            
        return {"records_count": len(filtered), "data": filtered}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/events/{event_id}/radiance", tags=["Events & Spatial Data"])
def get_event_radiance(
    event_id: str,
    municipality: Optional[str] = Query(None, description="Optional municipality name or ADM3_PCODE filter")
):
    """
    Connects historical event records to spatial/time radiance data across Panay municipalities.
    Exposes both municipality_name and pcode for direct GIS map layers.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, municipality_code, name, description, date, category, image_url FROM events WHERE id = ?", (event_id,))
    event = cursor.fetchone()
    if not event:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Event ID '{event_id}' not found.")
    
    event_dict = dict(event)
    target_date = event_dict.get("date")
    
    query = """
        SELECT 
            o.municipality_name,
            COALESCE(o.municipality_pcode, m.code) AS pcode,
            o.observation_date,
            o.daily_radiance,
            b.baseline_radiance
        FROM radiance_observations o
        LEFT JOIN municipalities m ON o.municipality_name = m.name
        LEFT JOIN baselines b ON o.municipality_name = b.municipality_name
            AND b.baseline_radiance IS NOT NULL
            AND (
                b.month_date = substr(o.observation_date, 1, 7)
                OR b.month_date = substr(o.observation_date, 1, 7) || '-01'
                OR b.month_date = (
                    SELECT b2.month_date FROM baselines b2 
                    WHERE b2.municipality_name = o.municipality_name AND b2.baseline_radiance IS NOT NULL
                    ORDER BY b2.month_date DESC LIMIT 1
                )
            )
        WHERE o.observation_date = ?
    """
    params = [target_date]
    
    if municipality and isinstance(municipality, str):
        mun_q = municipality.strip().lower()
        query += " AND (LOWER(o.municipality_name) = ? OR LOWER(COALESCE(o.municipality_pcode, m.code)) = ?)"
        params.extend([mun_q, mun_q])
        
    query += " ORDER BY o.municipality_name ASC"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()

    # If no records exist for exact event date, attempt nearest observation date within +/- 3 days
    if not rows and target_date:
        cursor.execute("""
            SELECT observation_date, ABS(JULIANDAY(observation_date) - JULIANDAY(?)) AS diff
            FROM radiance_observations
            ORDER BY diff ASC LIMIT 1
        """, (target_date,))
        nearest = cursor.fetchone()
        if nearest and nearest["diff"] is not None and nearest["diff"] <= 3:
            params[0] = nearest["observation_date"]
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
            "pcode": row["pcode"] or "UNKNOWN",
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


@app.get("/api/v1/resilience/timeline/{municipality_identifier}", response_model=TimelineResponse, tags=["Timeline"])
def get_municipality_timeline(
    municipality_identifier: str,
    start_date: Optional[str] = Query(None, description="Start date filter YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date filter YYYY-MM-DD")
):
    """
    Returns the day-by-day recovery timeline for a specific municipality.
    Accepts either municipality name (e.g. 'Altavas') or ADM3_PCODE (e.g. 'PH0600401').
    """
    scores = compute_recovery_index()
    ident = municipality_identifier.strip().lower()
    
    filtered = [
        s for s in scores 
        if (s.get("municipality_name") and s["municipality_name"].lower() == ident)
        or (s.get("pcode") and s["pcode"].lower() == ident)
    ]
    
    if not filtered:
        raise HTTPException(
            status_code=404, 
            detail=f"Municipality '{municipality_identifier}' not found."
        )
        
    if start_date and isinstance(start_date, str):
        filtered = [s for s in filtered if (s.get("date") or "") >= start_date]
    if end_date and isinstance(end_date, str):
        filtered = [s for s in filtered if (s.get("date") or "") <= end_date]
    
    mun_name = filtered[0].get("municipality_name", municipality_identifier)
    mun_pcode = filtered[0].get("pcode")
    
    return {
        "municipality": mun_name,
        "pcode": mun_pcode,
        "timeline": filtered
    }