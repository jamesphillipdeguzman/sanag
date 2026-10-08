import json
import re
from pathlib import Path
import pytest

ROOT_DIR = Path(__file__).resolve().parent.parent
REGIONS_DIR = ROOT_DIR / "frontend" / "public" / "regions"
LOOKUP_FILE = ROOT_DIR / "frontend" / "src" / "utils" / "regionLookup.ts"

CANONICAL_CHUNKS = [
    "ncr.geojson",
    "car.geojson",
    "ilocos_cagayan.geojson",
    "central_luzon.geojson",
    "calabarzon_mimaropa.geojson",
    "bicol.geojson",
    "panay_guimaras.geojson",
    "central_visayas.geojson",
    "eastern_visayas.geojson",
    "zamboanga_peninsula.geojson",
    "northern_mindanao_caraga.geojson",
    "mindanao_south.geojson",
    "barmm.geojson",
]

def test_all_13_regional_geojson_exist():
    for filename in CANONICAL_CHUNKS:
        filepath = REGIONS_DIR / filename
        assert filepath.exists(), f"Regional chunk missing: {filename}"

def test_geojson_file_sizes_under_1_5_mb():
    for filename in CANONICAL_CHUNKS:
        filepath = REGIONS_DIR / filename
        size_bytes = filepath.stat().st_size
        size_mb = size_bytes / (1024 * 1024)
        assert size_mb < 1.5, f"File {filename} exceeds 1.5 MB limit: {size_mb:.2f} MB"

def test_geojson_features_and_standardized_properties():
    required_keys = ["ADM3_EN", "ADM3_PCODE", "ADM2_EN", "ADM1_EN", "name", "psgc_code"]
    for filename in CANONICAL_CHUNKS:
        filepath = REGIONS_DIR / filename
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        assert data.get("type") == "FeatureCollection", f"{filename} is not a FeatureCollection"
        features = data.get("features", [])
        assert len(features) > 0, f"{filename} has no features"
        
        for feat in features:
            props = feat.get("properties", {})
            for key in required_keys:
                assert key in props, f"Feature missing property '{key}' in {filename}: {props}"
            geom = feat.get("geometry", {})
            assert geom.get("type") in ["Polygon", "MultiPolygon"], f"Invalid geometry in {filename}"
            coords = geom.get("coordinates", [])
            assert len(coords) > 0, f"Empty coordinates in {filename}"

def test_region_lookup_registry_contains_all_chunks():
    assert LOOKUP_FILE.exists(), "regionLookup.ts does not exist"
    content = LOOKUP_FILE.read_text(encoding="utf-8")
    
    # Check that each canonical key is present in REGIONAL_CHUNKS
    for filename in CANONICAL_CHUNKS:
        key = filename.replace(".geojson", "")
        assert key in content, f"Key '{key}' missing from regionLookup.ts"
        assert f"/regions/{filename}" in content or filename in content, f"Path for '{filename}' missing in regionLookup.ts"
