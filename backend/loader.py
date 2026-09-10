"""
=====================================================================
GEOJSON HELPER UTILITIES & DATABASE INGESTION MODULE
=====================================================================
Functions to locate, read, and load raw geographic boundary data
from the frontend workspace into reusable Python dictionaries, and 
populate the SQLite database schema (sanag.db).
=====================================================================
"""

import json
import os
import sqlite3
from typing import Dict, Any, List

def load_panay_municipalities_geojson() -> Dict[str, Any]:
    """
    =================================================================
    Load Raw GeoJSON FeatureCollection
    =================================================================
    Loads the raw GeoJSON FeatureCollection for Panay municipalities.
    Can be passed directly into Earth Engine FeatureCollection.
    """
    file_path = "../frontend/src/data/panay_municipalities.geojson"
    
    if not os.path.exists(file_path):
        print(f"Error: GeoJSON file not found at {file_path}")
        return {"type": "FeatureCollection", "features": []}

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    print(f"Successfully loaded {len(data.get('features', []))} municipalities across Panay Island!")
    return data

def load_panay_municipalities_list() -> List[Dict[str, Any]]:
    """
    =================================================================
    Load Municipalities as List
    =================================================================
    Loads all municipal boundaries as a list of Python dictionaries.
    """
    data = load_panay_municipalities_geojson()
    return data.get('features', [])

def load_municipalities(geojson_path="../frontend/public/panay_municipalities.geojson", db_path="db/sanag.db"):
    """
    =================================================================
    Main Ingestion Function & Database Schema Initialization
    =================================================================
    - Validates the source GeoJSON file structure ('FeatureCollection').
    - Initializes SQLite connection and sets up structural tables.
    - Parses and inserts municipal and barangay boundaries with duplicate checks.

    Args:
        geojson_path: Path to the PSGC GeoJSON file (should contain 'ADM3_PCODE', 'ADM2_PCODE', and 'geometry').
        db_path: Path to the SQLite database file.
    """
    if not os.path.exists(geojson_path):
        print(f"❌ Error: GeoJSON file not found at {geojson_path}")
        print("Please ensure you have run: python -m app.generate_dataset")
        return

    with open(geojson_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if not data.get('type') == 'FeatureCollection':
        print(f"❌ Error: Invalid GeoJSON format. Expected 'FeatureCollection'.")
        return
    
    features = data.get('features', [])
    if not features:
        print("❌ Error: No features found in GeoJSON.")
        return

    db_dir = os.path.dirname(db_path)
    os.makedirs(db_dir, exist_ok=True)
    
    db = sqlite3.connect(db_path)
    cursor = db.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS municipalities (
            code TEXT PRIMARY KEY,
            province_code TEXT,
            name TEXT UNIQUE,
            geometry TEXT
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS barangays (
            code TEXT PRIMARY KEY,
            municipality_code TEXT,
            name TEXT,
            geometry TEXT
        )
    """)
    
    print("Parsing and inserting municipalities...")
    for feature in features:
        props = feature.get('properties', {})
        geom = feature.get('geometry')
        
        if not props or not geom:
            continue
            
        m_code = props.get('ADM3_PCODE')
        m_name = props.get('ADM3_EN')
        m_province_code = props.get('ADM2_PCODE')
        m_province_name = props.get('ADM2_EN')
        geometry_json = json.dumps(geom)
        
        if m_code and m_name and m_province_code:
            cursor.execute("SELECT code FROM municipalities WHERE code = ?", (m_code,))
            if not cursor.fetchone():
                cursor.execute("""
                    INSERT INTO municipalities (code, province_code, name, geometry)
                    VALUES (?, ?, ?, ?)
                """, (m_code, m_province_code, m_name, geometry_json))
    
    print("Parsing and inserting barangays...")
    for feature in features:
        props = feature.get('properties', {})
        municipality_code = props.get('ADM3_PCODE')
        municipality_name = props.get('ADM3_EN')
        
        b_code = props.get('ADM4_PCODE')
        b_name = props.get('ADM4_EN')
        b_geometry = props.get('geometry', {})
        
        if not b_code and not b_name:
             if isinstance(feature.get('geometry'), list):
                 b_code = municipality_code + "01"
                 b_name = municipality_name + " - General Area"
                 b_geometry = json.dumps(feature['geometry'])
             else:
                 continue
        
        if b_code and b_name and municipality_code:
            cursor.execute("SELECT code FROM barangays WHERE code = ?", (b_code,))
            if not cursor.fetchone():
                geom_json = b_geometry
                if isinstance(b_geometry, list):
                     geom_json = json.dumps(b_geometry)
                
                cursor.execute("""
                    INSERT INTO barangays (code, municipality_code, name, geometry)
                    VALUES (?, ?, ?, ?)
                """, (b_code, municipality_code, b_name, geom_json))
    
    db.commit()
    db.close()
    
    print(f"✓ Successfully loaded {len(features)} municipalities and their barangays.")

if __name__ == "__main__":
    load_municipalities()