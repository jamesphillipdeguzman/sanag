import os
import sqlite3
from calculator import compute_recovery_index

def analyze_recovery_timelines():
    print("ANALYSIS: Generating day-by-day recovery timelines and milestones...\n")

    # Fetch compute R(t) scores from calculator module
    records = compute_recovery_index()

    if not records:
        print("WARNING: No records found to analyze")
        return

    # Group records by municipality
    timelines = {}
    for rec in records:
        mun = rec["municipality_name"]
        if mun not in timelines:
            timelines[mun] = []
        timelines[mun].append(rec)

    # Analyze milestones per municaplity
    for mun, days in timelines.items():
        print(f"========================================")
        print(f"Municipality: {mun}")
        print(f"========================================")
        
        valid_days = [d for d in days if d["r_t"] is not None]
        if not valid_days:
            print("  Status: No valid radiance data available (cloud-masked or missing.)")
            continue

        # Sort chronologically by date
        valid_days.sort(key=lambda x: x["date"])

        # Identify milestones
        deepest_drop = min(valid_days, key=lambda x: x["r_t"])

        # Find first date of full recovery (>= 0.9) after a drop, or overall
        recovered_day =  next((d for d in valid_days if d["r_t"] >= 0.9), None)

        print(f"  Timeline Span: {valid_days[0]['date']} to {valid_days[-1]['date']} ({len(valid_days)} active days)")
        print(f"  Milestone - Deepest Drop: {deepest_drop['date']} (R(t) = {deepest_drop['r_t']}, Status: {deepest_drop['status']})")
        
        if recovered_day:
            print(f"  Milestone - Normal Restored: {recovered_day['date']} (R(t) = {recovered_day['r_t']})")
        else:
            print(f"  Milestone - Normal Restored: Not fully recovered within observation window.")
        
        print("\n  Day-by-Day Progression:")
        for d in valid_days:
            print(f"    [{d['date']}] R(t) = {d['r_t']:.4f} | {d['status']}")
        print("\n")

if __name__ == "__main__":
    analyze_recovery_timelines()