"""
Calculates power grid recovery metrics for the SANAG capstone project.

What this calculates:
    1. Baseline & Minimum Radiance: Establishes the expected pre-disaster state vs. 
       the deepest drop during the outage.
    2. Recovery Percentage / Index: Measures how close the current night's power 
       output is compared to normal operations.
    3. Recovery Time: Counts how many days the grid required to climb back to 
       baseline levels, while gracefully skipping cloudy (None) days.
"""
import os
import sqlite3
from typing import Optional, Dict, List, Union

# Define the database path relative to the script location
DB_PATH = os.path.join(os.path.dirname(__file__), "db", "sanag.db")

def interpret_score(r_val):
    """
    Classifies the R(t) recovery ratio based on defined benchmarks.
    """
    if r_val is None:
        return "No Data / Cloud Masked"
    elif r_val >= 0.9:
        return "Normal Operating Conditions"
    elif 0.3 <= r_val < 0.9:
        return "Partial Power / Brownouts"
    else:
        return "Severe Grid Collapse / Blackout"

def compute_recovery_index(db_path=DB_PATH, baseline_threshold=1e-4):
    """
    Computes the R(t) recovery index using historical database observations,
    with explicit guardrails for edge cases:
      1. Cloud-mask exclusions (None values)
      2. Missing satellite tiles (Missing records / None)
      3. Zero/near-zero baselines (< threshold)
      4. Missing dates (Gaps in expected timelines)
    """
    # Connect to the database
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Query daily observations joined with the monthly baseline per municipality
    query = """
        SELECT 
            o.municipality_name,
            o.observation_date,
            o.daily_radiance AS post_event_radiance,
            b.baseline_radiance
        FROM radiance_observations o
        LEFT JOIN baselines b ON o.municipality_name = b.municipality_name
    """
    cursor.execute(query)
    rows = cursor.fetchall()

    results = []

    # --- EDGE CASE HANDLING STARTS HERE ---
    for row in rows:
        mun_name = row["municipality_name"]
        obs_date = row["observation_date"]
        radiance = row["post_event_radiance"]
        baseline_rad = row["baseline_radiance"]

        # Edge Case 4: Missing Dates or Municipality Records
        if not obs_date or not mun_name:
            results.append({
                "municipality_name": mun_name or "Unknown",
                "date": obs_date or "Missing Date",
                "r_t": None,
                "status": "Error: Missing Date or Municipality Record"
            })
            continue

        # Edge Cases 1 & 2: Cloud-Mask Exlusions or Missing Satellite Tiles (None values)
        if radiance is None:
            results.append({
                "municipality_name": mun_name,
                "date": obs_date,
                "r_t": None,
                "status": "No Data / Cloud Masked / Missing Tile"
            })
            continue

        # Edge Case 3: Missing Baselines or Zero/Near-Zero Baselines (prevent division by zero)
        if baseline_rad is None or baseline_rad < baseline_threshold:
            results.append({
                "municipality_name": mun_name,
                "date": obs_date,
                "r_t": None,
                "status": "Invalid Baseline (Zeror or Near-Zero)"
            })
            continue
        # --- EDGE CASE HANDLING ENDS HERE ---

        # Core Formula: R(t) = L(t) / L_baseline 
        # (Post-Event Daily Radiance / Monthly Baseline Radiance)
        # Where:
        #   - R(t): Recovery ratio or index at time t
        #   - L(t): Luminosity / daily radiance measured at time t (post-event)
        #   - L_baseline: Standard baseline luminosity / normal monthly radiance
        
        r_t = radiance / baseline_rad
        interpretation = interpret_score(r_t)

        results.append({
            "municipality_name": mun_name,
            "date": obs_date,
            "r_t": round(r_t, 4),
            "status": interpretation
        })

    conn.close()
    return results


def calculate_recovery_metrics(
    baseline_radiance: float, 
    daily_radiance_series: List[Optional[float]]
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
        "baseline_radiance": baseline_radiance,
        "minimum_radiance": min_radiance,
        "latest_radiance": latest_radiance,
        "recovery_percentage": round(recovery_percentage, 2),
        "recovery_time_days": recovery_days if recovery_days < len(daily_radiance_series) else "Not fully recovered"
    }

if __name__ == "__main__":
    scores = compute_recovery_index()
    print(f"Computed {len(scores)} recovery score records from database.")
    
    # Test with a mock recovery timeline (Blackout drop -> gradual rise back to baseline ~1.77)
    mock_baseline = 1.774
    mock_timeseries = [1.634, 1.400, 1.550, None, 1.700, 1.750, 1.780] # None simulates a cloudy day
    
    metrics = calculate_recovery_metrics(mock_baseline, mock_timeseries)
    print("--- Calculated Recovery Metrics ---")
    for k, v in metrics.items():
        print(f"{k}: {v}")