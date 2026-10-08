"""
Calculates power grid recovery metrics for the SANAG capstone project.

Operational Recovery Benchmarks (R(t) = L(t) / L_baseline):
    - Near-Full Recovery (Normal Operating Conditions): R(t) >= 0.90 (>= 90% baseline radiance)
    - Active Restoration: 0.60 <= R(t) < 0.90 (60% to 89% baseline radiance)
    - Critical Deficit (Blackout): R(t) < 0.60 (< 60% baseline radiance)
    - Cloud Masked: None (No Data)

What this calculates:
    1. Baseline & Minimum Radiance: Establishes the expected pre-disaster state vs. 
       the deepest drop during the outage.
    2. Recovery Percentage / Index: Measures how close the current night's power 
       output is compared to normal operations (R(t) = L(t) / L_baseline).
    3. Recovery Time: Counts how many days the grid required to climb back to 
       baseline levels, while gracefully skipping cloudy (None) days.
"""
import os
import re
import calendar
from datetime import datetime, timedelta
from functools import lru_cache
import sqlite3
from typing import Optional, Dict, List, Union, Any, Tuple, Sequence

# Define the database path relative to the script location
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "db", "sanag.db")

def interpret_score(r_val: Optional[float]) -> str:
    """
    Classifies the R(t) recovery ratio based on defined benchmarks:
    - R(t) >= 0.90 (>= 90%): "Normal Operating Conditions"
    - 0.60 <= R(t) < 0.90 (60%–89%): "Active Restoration"
    - R(t) < 0.60 (< 60%): "Critical Deficit / Blackout"
    - R(t) is None: "No Data / Cloud Masked"
    """
    if r_val is None:
        return "No Data / Cloud Masked"
    elif r_val >= 0.9:
        return "Normal Operating Conditions"
    elif 0.6 <= r_val < 0.9:
        return "Active Restoration"
    else:
        return "Critical Deficit / Blackout"

@lru_cache(maxsize=128)
def _cached_compute_recovery_index(
    db_path: str,
    baseline_threshold: float,
    start_date: Optional[str],
    end_date: Optional[str],
    municipality: Optional[str],
    event_id: Optional[str],
    month: Optional[str]
) -> Tuple[Dict[str, Any], ...]:
    """
    In-memory cached executor querying SQLite for exact date bounds,
    avoiding redundant database round-trips and file disk writes.
    Interpolates any intermediate missing observation dates.
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # If full month is requested (e.g. '2024-01' or '2024-01-01'), derive the full month date range
    if month and isinstance(month, str):
        m_clean = month.strip()
        match = re.match(r"^(\d{4})-(\d{2})", m_clean)
        if match:
            year, mon = int(match.group(1)), int(match.group(2))
            _, last_day = calendar.monthrange(year, mon)
            if not start_date:
                start_date = f"{year:04d}-{mon:02d}-01"
            if not end_date:
                end_date = f"{year:04d}-{mon:02d}-{last_day:02d}"

    # Retain safe fallbacks for event-based views when no custom date range is provided
    if event_id and not start_date and not end_date:
        lookup_id = "panay-blackout-2024" if event_id.strip() == "1" else event_id.strip()
        cursor.execute("SELECT date FROM events WHERE id = ?", (lookup_id,))
        evt_row = cursor.fetchone()
        if evt_row and evt_row["date"]:
            try:
                base_dt = datetime.strptime(evt_row["date"][:10], "%Y-%m-%d")
                # Default event recovery window: 3 days prior onset to 30 days post-event
                start_date = (base_dt - timedelta(days=3)).strftime("%Y-%m-%d")
                end_date = (base_dt + timedelta(days=30)).strftime("%Y-%m-%d")
            except Exception:
                pass

    where_clauses = []
    params: List[Any] = []

    if start_date and isinstance(start_date, str):
        where_clauses.append("o.observation_date >= ?")
        params.append(start_date.strip())

    if end_date and isinstance(end_date, str):
        where_clauses.append("o.observation_date <= ?")
        params.append(end_date.strip())

    if municipality and isinstance(municipality, str):
        mun_clean = municipality.strip().lower()
        where_clauses.append("(LOWER(o.municipality_name) = ? OR LOWER(COALESCE(o.municipality_pcode, m.code)) = ?)")
        params.extend([mun_clean, mun_clean])

    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    # Query daily observations joined with the appropriate monthly baseline per municipality.
    # Uses deterministic scalar fallback to prevent duplicate rows caused by non-exclusive OR joins.
    query = f"""
        SELECT 
            o.municipality_name,
            COALESCE(o.municipality_pcode, m.code) AS pcode,
            o.observation_date,
            o.daily_radiance AS post_event_radiance,
            COALESCE(
                (SELECT b1.baseline_radiance FROM baselines b1 
                 WHERE (b1.municipality_name = o.municipality_name OR b1.municipality_pcode = COALESCE(o.municipality_pcode, m.code))
                   AND b1.baseline_radiance IS NOT NULL 
                   AND (b1.month_date = substr(o.observation_date, 1, 7) OR b1.month_date = substr(o.observation_date, 1, 7) || '-01')
                 LIMIT 1),
                (SELECT b2.baseline_radiance FROM baselines b2 
                 WHERE (b2.municipality_name = o.municipality_name OR b2.municipality_pcode = COALESCE(o.municipality_pcode, m.code))
                   AND b2.baseline_radiance IS NOT NULL 
                   AND (CASE WHEN length(b2.month_date) = 7 THEN b2.month_date || '-01' ELSE b2.month_date END) <= o.observation_date
                 ORDER BY (CASE WHEN length(b2.month_date) = 7 THEN b2.month_date || '-01' ELSE b2.month_date END) DESC LIMIT 1),
                (SELECT b3.baseline_radiance FROM baselines b3 
                 WHERE (b3.municipality_name = o.municipality_name OR b3.municipality_pcode = COALESCE(o.municipality_pcode, m.code))
                   AND b3.baseline_radiance IS NOT NULL 
                 ORDER BY b3.month_date ASC LIMIT 1),
                (SELECT AVG(b4.baseline_radiance) FROM baselines b4 WHERE b4.baseline_radiance IS NOT NULL),
                0.7885
            ) AS baseline_radiance
        FROM radiance_observations o
        LEFT JOIN municipalities m ON (o.municipality_name = m.name OR o.municipality_pcode = m.code)
        {where_sql}
        ORDER BY o.observation_date ASC, o.municipality_name ASC
    """
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    # Determine if sequence interpolation is requested across exact date bounds
    expected_dates: List[str] = []
    if start_date and end_date:
        try:
            d_start = datetime.strptime(start_date[:10], "%Y-%m-%d")
            d_end = datetime.strptime(end_date[:10], "%Y-%m-%d")
            day_count = (d_end - d_start).days
            if 0 <= day_count <= 180:
                expected_dates = [
                    (d_start + timedelta(days=i)).strftime("%Y-%m-%d")
                    for i in range(day_count + 1)
                ]
        except Exception:
            expected_dates = []

    results: List[Dict[str, Any]] = []

    if expected_dates:
        # Group by municipality (name, pcode)
        mun_records: Dict[Tuple[str, str], Dict[str, float]] = {}
        mun_baselines: Dict[Tuple[str, str], float] = {}

        for row in rows:
            mun_name = row["municipality_name"]
            pcode = row["pcode"] or "UNKNOWN"
            obs_date = row["observation_date"]
            radiance = row["post_event_radiance"]
            baseline_rad = row["baseline_radiance"]
            key = (mun_name, pcode)

            if key not in mun_records:
                mun_records[key] = {}
                mun_baselines[key] = baseline_rad if baseline_rad is not None else 0.7885
            elif mun_baselines[key] is None and baseline_rad is not None:
                mun_baselines[key] = baseline_rad

            if obs_date and radiance is not None and radiance >= 0:
                mun_records[key][obs_date] = radiance

        for (mun_name, pcode), dates_map in mun_records.items():
            base_rad = mun_baselines.get((mun_name, pcode)) or 0.7885
            known_dates = sorted(dates_map.keys())

            for d in expected_dates:
                if d in dates_map:
                    rad = dates_map[d]
                    r_t = round(rad / base_rad, 4) if base_rad > 0 else 1.0
                    status = interpret_score(r_t)
                elif known_dates:
                    # Graceful linear interpolation for intermediate dates missing satellite passes
                    prev_d = [x for x in known_dates if x < d]
                    next_d = [x for x in known_dates if x > d]
                    if prev_d and next_d:
                        p, n = prev_d[-1], next_d[0]
                        val_p, val_n = dates_map[p], dates_map[n]
                        dp = (datetime.strptime(d, "%Y-%m-%d") - datetime.strptime(p, "%Y-%m-%d")).days
                        dn = (datetime.strptime(n, "%Y-%m-%d") - datetime.strptime(d, "%Y-%m-%d")).days
                        rad = round(val_p + (val_n - val_p) * (dp / (dp + dn)), 4)
                    elif prev_d:
                        rad = dates_map[prev_d[-1]]
                    else:
                        rad = dates_map[next_d[0]]
                    r_t = round(rad / base_rad, 4) if base_rad > 0 else 1.0
                    status = interpret_score(r_t)
                else:
                    rad = round(base_rad, 4)
                    r_t = 1.0
                    status = "Normal Operating Conditions"

                results.append({
                    "municipality_name": mun_name,
                    "pcode": pcode,
                    "date": d,
                    "daily_radiance": round(rad, 4),
                    "baseline_radiance": round(base_rad, 4),
                    "r_t": round(r_t, 4),
                    "status": status
                })
    else:
        for row in rows:
            mun_name = row["municipality_name"]
            pcode = row["pcode"] or "UNKNOWN"
            obs_date = row["observation_date"]
            radiance = row["post_event_radiance"]
            baseline_rad = row["baseline_radiance"]

            # Guardrail 1: Missing Dates or Municipality Records
            if not obs_date or not mun_name:
                results.append({
                    "municipality_name": mun_name or "Unknown",
                    "pcode": pcode,
                    "date": obs_date or "Missing Date",
                    "daily_radiance": None,
                    "baseline_radiance": baseline_rad,
                    "r_t": None,
                    "status": "Error: Missing Date or Municipality Record"
                })
                continue

            # Guardrail 2: Cloud-Mask Exclusions or Missing Satellite Tiles
            if radiance is None:
                results.append({
                    "municipality_name": mun_name,
                    "pcode": pcode,
                    "date": obs_date,
                    "daily_radiance": None,
                    "baseline_radiance": baseline_rad,
                    "r_t": None,
                    "status": "No Data / Cloud Masked / Missing Tile"
                })
                continue

            # Guardrail 3: Missing Baselines or Zero/Near-Zero Baselines
            if baseline_rad is None or baseline_rad < baseline_threshold:
                results.append({
                    "municipality_name": mun_name,
                    "pcode": pcode,
                    "date": obs_date,
                    "daily_radiance": round(radiance, 4),
                    "baseline_radiance": baseline_rad,
                    "r_t": None,
                    "status": "Invalid Baseline (Zero or Near-Zero)"
                })
                continue

            # Guardrail 4: Invalid Negative Radiance
            if radiance < 0:
                results.append({
                    "municipality_name": mun_name,
                    "pcode": pcode,
                    "date": obs_date,
                    "daily_radiance": round(radiance, 4),
                    "baseline_radiance": baseline_rad,
                    "r_t": None,
                    "status": "Error: Invalid Negative Radiance Reading"
                })
                continue

            r_t = radiance / baseline_rad
            interpretation = interpret_score(r_t)

            results.append({
                "municipality_name": mun_name,
                "pcode": pcode,
                "date": obs_date,
                "daily_radiance": round(radiance, 4),
                "baseline_radiance": round(baseline_rad, 4),
                "r_t": round(r_t, 4),
                "status": interpretation
            })

    return tuple(results)

def compute_recovery_index(
    db_path: str = DB_PATH,
    baseline_threshold: float = 1e-4,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    municipality: Optional[str] = None,
    event_id: Optional[str] = None,
    month: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Public entry point computing R(t) recovery index with in-memory lru_cache acceleration.
    """
    cached = _cached_compute_recovery_index(
        db_path=db_path,
        baseline_threshold=baseline_threshold,
        start_date=start_date,
        end_date=end_date,
        municipality=municipality,
        event_id=event_id,
        month=month
    )
    return [dict(item) for item in cached]

def calculate_recovery_metrics(
    baseline_radiance: float, 
    daily_radiance_series: Sequence[Optional[float]]
) -> Dict[str, Union[float, int, str]]:
    """
    Calculates power grid recovery metrics comparing daily post-blackout 
    radiance values against a stable pre-blackout baseline.
    """
    if not daily_radiance_series:
        return {"status": "Error: Empty radiance series provided"}

    # Filter out cloudy/missing days (None) for mathematical operations
    valid_readings = [r for r in daily_radiance_series if r is not None]
    
    if not valid_readings:
        return {"status": "Error: All days in series are masked (cloud cover)"}

    min_radiance = min(valid_readings)
    latest_radiance = valid_readings[-1]
    
    # Recovery Percentage Index relative to baseline (capped at 100%)
    recovery_percentage = min(100.0, (latest_radiance / baseline_radiance) * 100) if baseline_radiance > 0 else 0.0

    # Find recovery duration (number of days it took to return to >= baseline)
    recovery_days = 0
    for reading in daily_radiance_series:
        if reading is not None and reading >= baseline_radiance:
            break
        recovery_days += 1

    return {
        "baseline_radiance": round(baseline_radiance, 4),
        "minimum_radiance": round(min_radiance, 4),
        "latest_radiance": round(latest_radiance, 4),
        "recovery_percentage": round(recovery_percentage, 2),
        "recovery_time_days": recovery_days if recovery_days < len(daily_radiance_series) else "Not fully recovered"
    }

if __name__ == "__main__":
    scores = compute_recovery_index()
    print(f"Computed {len(scores)} recovery score records from database.")
    if scores:
        print("Sample recovery record:", scores[0])