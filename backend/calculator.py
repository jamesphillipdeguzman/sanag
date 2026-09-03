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

from typing import Optional, Dict, List, Union

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
    # Test with a mock recovery timeline (Blackout drop -> gradual rise back to baseline ~1.77)
    mock_baseline = 1.774
    mock_timeseries = [1.634, 1.400, 1.550, None, 1.700, 1.750, 1.780] # None simulates a cloudy day
    
    metrics = calculate_recovery_metrics(mock_baseline, mock_timeseries)
    print("--- Calculated Recovery Metrics ---")
    for k, v in metrics.items():
        print(f"{k}: {v}")