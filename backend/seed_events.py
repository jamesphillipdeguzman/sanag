import sqlite3
import os
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "db", "sanag.db")

def seed_observations_for_all_events():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 1. Fetch all municipalities
    cursor.execute("SELECT name, code FROM municipalities")
    municipalities = cursor.fetchall()

    # 2. Fetch all events to get their active dates
    cols = [col[1] for col in cursor.execute("PRAGMA table_info(events)").fetchall()]
    date_col = "event_date" if "event_date" in cols else "date"
    cursor.execute(f"SELECT {date_col} AS event_date FROM events")
    events = cursor.fetchall()

    if not events:
        print("No events found in database to seed around.")
        conn.close()
        return

    print(f"Seeding observation timelines for {len(municipalities)} municipalities across {len(events)} events...")

    inserted_count = 0
    for event in events:
        raw_date = event["event_date"]
        if not raw_date:
            continue
        
        try:
            event_date = datetime.strptime(raw_date[:10], "%Y-%m-%d")
        except ValueError:
            continue

        for mun in municipalities:
            mun_name = mun["name"]
            pcode = mun["code"]

            # Generate a 14-day recovery window starting from the event date
            for i in range(14):
                current_date = event_date + timedelta(days=i)
                date_str = current_date.strftime("%Y-%m-%d")

                # Simulate a post-disaster drop and gradual recovery
                simulated_radiance = round(0.20 + (i * 0.035), 4)
                if simulated_radiance > 0.68:
                    simulated_radiance = 0.6877

                # Insert only if it doesn't already exist
                cursor.execute(
                    "SELECT 1 FROM radiance_observations WHERE municipality_name = ? AND observation_date = ?",
                    (mun_name, date_str)
                )
                if not cursor.fetchone():
                    cursor.execute("""
                        INSERT INTO radiance_observations (municipality_name, municipality_pcode, observation_date, daily_radiance)
                        VALUES (?, ?, ?, ?)
                    """, (mun_name, pcode, date_str, simulated_radiance))
                    inserted_count += 1

    conn.commit()
    conn.close()
    print(f"Successfully seeded {inserted_count} new observation records across all event windows!")

if __name__ == "__main__":
    seed_observations_for_all_events()