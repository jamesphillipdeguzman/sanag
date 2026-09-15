import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(__file__), "db", "sanag.db")

def populate_sample_data():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("DEBUG: Inserting baseline and observation records...")

    # 1. Insert sample municipalities and their monthly baselines (L_baseline)
    baselines_data = [
        ("Iloilo City", "2024-01", 4.5200),
        ("Bacolod City", "2024-01", 4.4646),
        ("Roxas City", "2024-01", 3.8811),
        ("Antique", "2024-01", 2.4336),
        ("Capiz", "2024-01", 2.9424),
        ("Guimaras", "2024-01", 1.6552)
    ]

    cursor.executemany("""
        INSERT OR REPLACE INTO baselines (municipality_name, month_date, baseline_radiance)
        VALUES (?, ?, ?)
    """, baselines_data)

    # 2. Insert January 2024 blackout & recovery daily observation (L(t))
    # Simulating a severe blackout drop on Jan 3, followed by brownouts and recovery
    observations_data = [
        # Iloilo City timeline
        ("Iloilo City", "2024-01-01", 4.4200),
        ("Iloilo City", "2024-01-02", 4.4000),
        ("Iloilo City", "2024-01-03", 0.4500),  # Severe Blackout
        ("Iloilo City", "2024-01-04", 1.2000),  # Brownout phase
        ("Iloilo City", "2024-01-05", None),    # Cloud-masked day (None test)
        ("Iloilo City", "2024-01-06", 2.8000),  # Partial recovery
        ("Iloilo City", "2024-01-07", 4.1000),  # Near normal
        ("Iloilo City", "2024-01-08", 4.5200),  # Fully restored

        # Bacolod City timeline
        ("Bacolod City", "2024-01-01", 4.4000),
        ("Bacolod City", "2024-01-02", 4.3800),
        ("Bacolod City", "2024-01-03", 0.3000),  # Blackout
        ("Bacolod City", "2024-01-04", 0.9500),  # Brownout
        ("Bacolod City", "2024-01-05", 2.1000),  # Brownout
        ("Bacolod City", "2024-01-06", 3.5000),  # Brownout
        ("Bacolod City", "2024-01-07", 4.4646),  # Fully restored

        # Roxas City timeline
        ("Roxas City", "2024-01-01", 3.8000),
        ("Roxas City", "2024-01-02", 3.7500),
        ("Roxas City", "2024-01-03", 0.1500),  # Blackout
        ("Roxas City", "2024-01-04", 0.8000),  # Brownout
        ("Roxas City", "2024-01-05", 1.9000),  # Brownout
        ("Roxas City", "2024-01-06", 3.8811),  # Fully restored

        # Antique timeline
        ("Antique", "2024-01-01", 2.4000),
        ("Antique", "2024-01-02", 2.3800),
        ("Antique", "2024-01-03", 0.1000),  # Blackout
        ("Antique", "2024-01-04", 0.5000),  # Brownout
        ("Antique", "2024-01-05", 1.4000),  # Brownout
        ("Antique", "2024-01-06", 2.4336),  # Fully restored

        # Capiz timeline
        ("Capiz", "2024-01-01", 2.9000),
        ("Capiz", "2024-01-02", 2.8800),
        ("Capiz", "2024-01-03", 0.2000),  # Blackout
        ("Capiz", "2024-01-04", 1.1000),  # Brownout
        ("Capiz", "2024-01-05", 2.9424)   # Fully restored
    ]

    cursor.executemany("""
        INSERT OR REPLACE INTO radiance_observations (municipality_name, observation_date, daily_radiance)
        VALUES (?, ?, ?)
    """, observations_data) 

    # Commit the changes
    conn.commit()
    conn.close()
    print("SUCCESS: Database populated with January 2024 test event logs!")

if __name__ == "__main__":
    populate_sample_data()