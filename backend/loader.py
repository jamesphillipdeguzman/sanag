import json
import os
from typing import Dict, Any, List

def load_panay_municipalities_geojson() -> Dict[str, Any]:
    """
    Loads the raw GeoJSON FeatureCollection for Panay municipalities.
    Can be passed directly into Earth Engine FeatureCollection.
    """
    file_path = "../frontend/data/panay_municipalities.geojson"
    
    if not os.path.exists(file_path):
        print(f"Error: GeoJSON file not found at {file_path}")
        return {"type": "FeatureCollection", "features": []}

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    print(f"Successfully loaded {len(data.get('features', []))} municipalities across Panay Island!")
    return data

def load_panay_municipalities_list() -> List[Dict[str, Any]]:
    """
    Loads all municipal boundaries as a list of Python dictionaries.
    """
    data = load_panay_municipalities_geojson()
    return data.get('features', [])