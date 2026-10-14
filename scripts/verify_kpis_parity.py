import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.calculator import aggregate_kpi_metrics

# Example 1: Critical Deficit
lgus_1 = [
    {"id": "1", "name": "LGU 1", "province": "Iloilo", "population": 100000, "recovery_score": 40, "status": "critical"},
    {"id": "2", "name": "LGU 2", "province": "Capiz", "population": 50000, "recovery_score": 55, "status": "critical"},
    {"id": "3", "name": "LGU 3", "province": "Aklan", "population": 80000, "recovery_score": 75, "status": "recovering"},
]
kpi_1 = aggregate_kpi_metrics(lgus_1)
print("Example 1 (Critical):")
print(f"  totalMonitoredLgus: {kpi_1['total_monitored_lgus']} (expected 3)")
print(f"  criticalCount:      {kpi_1['critical_count']} (expected 2)")
print(f"  criticalPopulation: {kpi_1['critical_population']} (expected 150000)")
print(f"  affectedPopulation: {kpi_1['affected_population']} (expected 150000)")
print(f"  avgRecovery:        {kpi_1['avg_recovery']} (expected 57)")
print(f"  isCritical:         {kpi_1['is_critical']} (expected True)")

# Example 2: Restored
lgus_2 = [
    {"id": "1", "name": "LGU 1", "province": "Iloilo", "population": 200000, "recovery_score": 92, "status": "restored"},
    {"id": "2", "name": "LGU 2", "province": "Capiz", "population": 150000, "recovery_score": 95, "status": "restored"},
    {"id": "3", "name": "LGU 3", "province": "Aklan", "population": 100000, "recovery_score": 100, "status": "restored"},
]
kpi_2 = aggregate_kpi_metrics(lgus_2)
print("\nExample 2 (Restored):")
print(f"  totalMonitoredLgus: {kpi_2['total_monitored_lgus']} (expected 3)")
print(f"  criticalCount:      {kpi_2['critical_count']} (expected 0)")
print(f"  restoredCount:      {kpi_2['restored_count']} (expected 3)")
print(f"  affectedPopulation: {kpi_2['affected_population']} (expected 0)")
print(f"  avgRecovery:        {kpi_2['avg_recovery']} (expected 96)")
print(f"  isCritical:         {kpi_2['is_critical']} (expected False)")

# Example 3: Missing Observations
lgus_3 = [
    {"id": "1", "name": "LGU 1", "province": "Iloilo", "population": 50000, "recovery_score": None, "status": "unavailable"},
    {"id": "2", "name": "LGU 2", "province": "Capiz", "population": 70000, "recovery_score": None, "status": "unavailable"},
    {"id": "3", "name": "LGU 3", "province": "Aklan", "population": 60000, "recovery_score": 80, "status": "recovering"},
]
kpi_3 = aggregate_kpi_metrics(lgus_3)
print("\nExample 3 (Missing / Unavailable):")
print(f"  totalMonitoredLgus: {kpi_3['total_monitored_lgus']} (expected 3)")
print(f"  unavailableCount:   {kpi_3['unavailable_count']} (expected 2)")
print(f"  affectedPopulation: {kpi_3['affected_population']} (expected 0)")
print(f"  avgRecovery:        {kpi_3['avg_recovery']} (expected 80)")
