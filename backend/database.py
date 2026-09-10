import sqlite3
import os

def initialize_database(db_name="sanag.db"):
    """
    Creates the SQLite database and establishes both the app features 
    and core capstone satellite pipeline tables.
    """
    # Automatically creates a folder named db in the backend directory if it doesn't already exist.
    # Target sanag.db inside that folder, ensuring the SQLite database file has a dedicated, organized home.

    db_dir = "db"
    os.makedirs(db_dir, exist_ok=True)
    db_path = os.path.join(db_dir, db_name)
    
    print(f"DEBUG: Creating database at {db_path}")

    db = sqlite3.connect(db_path)
    cursor = db.cursor()

    # --- 1. MUNICIPALITIES & Barangays ---
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS municipalities (
            code TEXT PRIMARY KEY,
            province_code TEXT,
            name TEXT UNIQUE,
            geometry TEXT
        )
    """)


    # --- 2. SATELLITE PIPELINE TABLES (NEW & ESSENTIAL) ---
    # Stores the daily NASA VNP46A2 JSON data extracted from Google Earth Engine.
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS radiance_observations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            municipality_name TEXT NOT NULL,
            observation_date TEXT NOT NULL,
            daily_radiance REAL,
            FOREIGN KEY (municipality_name) REFERENCES municipalities(name)
        )
    """)
    # Stores the monthly NOAA VCMSLCFG baseline data.
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS baselines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            municipality_name TEXT NOT NULL,
            month_date TEXT NOT NULL,
            baseline_radiance REAL,
            FOREIGN KEY (municipality_name) REFERENCES municipalities(name)
        )
    """)
    # Acts as the destination table where the $R(t)$ calculations (comparing daily radiance to monthly baselines per municipality) will live.
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS recovery_scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            municipality_name TEXT NOT NULL,
            score_date TEXT NOT NULL,
            r_t_score REAL,
            interpretation TEXT,
            FOREIGN KEY (municipality_name) REFERENCES municipalities(name)
        )
    """)

    # --- 3. POIs & EVENTS (App Features) ---
    # Pints of Interest (POIs)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS pois (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            municipality_code TEXT,
            barangay_code TEXT,
            name TEXT,
            category TEXT,
            description TEXT,
            lat REAL,
            lon REAL,
            has_image INTEGER DEFAULT 0,
            image_url TEXT
        )
    """)
    #  Local events
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            municipality_code TEXT,
            barangay_code TEXT,
            name TEXT,
            description TEXT,
            date TEXT,
            category TEXT,
            image_url TEXT
        )
    """)

    # --- 4. USER DATA (Ratings & Reviews) ---
    # User Ratings
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_ratings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            poi_id INTEGER,
            user_id TEXT,
            rating REAL,
            review TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # --- 5. AI & SYSTEM ---
    # Logs for AI-generated text or images (generation_log)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS generation_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            municipality_code TEXT,
            type TEXT,   -- 'image' or 'text'
            status TEXT, -- 'success' or 'error'
            prompt_used TEXT,
            response TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    db.commit()
    print("✅ Database initialized with full capstone pipeline schema!")
    return db

# Global connection variable
db = initialize_database()