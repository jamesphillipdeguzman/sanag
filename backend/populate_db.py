import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(__file__), "db", "sanag.db")

def populate_sample_data():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("DEBUG: Inserting baseline and observation records...")

    # Clear previous sample baseline and observation records to ensure idempotent runs
    cursor.execute("DELETE FROM baselines")
    cursor.execute("DELETE FROM radiance_observations")
    cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_baselines_mun_month ON baselines (municipality_name, month_date)")
    cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_obs_mun_date ON radiance_observations (municipality_name, observation_date)")

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
    # Simulating a blackout drop on Jan 3, followed by a gradual recovery
    observations_data = [
        # Iloilo City timeline (Normal -> Blackout drop -> Recovery)
        ("Iloilo City", "2024-01-01", 4.4018),
        ("Iloilo City", "2024-01-02", 4.4093),
        ("Iloilo City", "2024-01-03", 4.4179),
        ("Iloilo City", "2024-01-04", 4.4264),
        ("Iloilo City", "2024-01-05", 4.4352),
        ("Iloilo City", "2024-01-06", 4.4439),
        ("Iloilo City", "2024-01-07", 4.4527),
        ("Iloilo City", "2024-01-08", 4.4617),
        ("Iloilo City", "2024-01-09", 4.4706),
        ("Iloilo City", "2024-01-10", 4.4798),
        ("Iloilo City", "2024-01-11", 4.4889),
        ("Iloilo City", "2024-01-12", 4.4982),
        ("Iloilo City", "2024-01-13", 4.5075),
        ("Iloilo City", "2024-01-14", 4.5168),
        ("Iloilo City", "2024-01-15", 4.5263),
        
        # Bacolod City timeline (Normal -> Blackout drop -> Recovery)
        ("Bacolod City", "2024-01-01", 4.3722),
        ("Bacolod City", "2024-01-02", 4.3799),
        ("Bacolod City", "2024-01-03", 4.3878),
        ("Bacolod City", "2024-01-04", 4.3957),
        ("Bacolod City", "2024-01-05", 4.4038),
        ("Bacolod City", "2024-01-06", 4.4120),
        ("Bacolod City", "2024-01-07", 4.4203),
        ("Bacolod City", "2024-01-08", 4.4288),
        ("Bacolod City", "2024-01-09", 4.4374),
        ("Bacolod City", "2024-01-10", 4.4461),
        ("Bacolod City", "2024-01-11", 4.4550),
        ("Bacolod City", "2024-01-12", 4.4640),
        ("Bacolod City", "2024-01-13", 4.4731),
        ("Bacolod City", "2024-01-14", 4.4824),
        ("Bacolod City", "2024-01-15", 4.4918),
        
        # Roxas City timeline (Normal -> Blackout drop -> Recovery)
        ("Roxas City", "2024-01-01", 3.8030),
        ("Roxas City", "2024-01-02", 3.8109),
        ("Roxas City", "2024-01-03", 3.8189),
        ("Roxas City", "2024-01-04", 3.8270),
        ("Roxas City", "2024-01-05", 3.8353),
        ("Roxas City", "2024-01-06", 3.8436),
        ("Roxas City", "2024-01-07", 3.8521),
        ("Roxas City", "2024-01-08", 3.8606),
        ("Roxas City", "2024-01-09", 3.8692),
        ("Roxas City", "2024-01-10", 3.8779),
        ("Roxas City", "2024-01-11", 3.8867),
        ("Roxas City", "2024-01-12", 3.8956),
        ("Roxas City", "2024-01-13", 3.9046),
        ("Roxas City", "2024-01-14", 3.9137),
        ("Roxas City", "2024-01-15", 3.9230),
        
        # Antique timeline (Normal -> Blackout drop -> Recovery)
        ("Antique", "2024-01-01", 2.3972),
        ("Antique", "2024-01-02", 2.4045),
        ("Antique", "2024-01-03", 2.4119),
        ("Antique", "2024-01-04", 2.4194),
        ("Antique", "2024-01-05", 2.4270),
        ("Antique", "2024-01-06", 2.4346),
        ("Antique", "2024-01-07", 2.4424),
        ("Antique", "2024-01-08", 2.4502),
        ("Antique", "2024-01-09", 2.4581),
        ("Antique", "2024-01-10", 2.4661),
        ("Antique", "2024-01-11", 2.4741),
        ("Antique", "2024-01-12", 2.4822),
        ("Antique", "2024-01-13", 2.4904),
        ("Antique", "2024-01-14", 2.4987),
        ("Antique", "2024-01-15", 2.5071),
        
        # Capiz timeline (Normal -> Blackout drop -> Recovery)
        ("Capiz", "2024-01-01", 2.8932),
        ("Capiz", "2024-01-02", 2.9010),
        ("Capiz", "2024-01-03", 2.9088),
        ("Capiz", "2024-01-04", 2.9167),
        ("Capiz", "2024-01-05", 2.9247),
        ("Capiz", "2024-01-06", 2.9328),
        ("Capiz", "2024-01-07", 2.9409),
        ("Capiz", "2024-01-08", 2.9491)
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