import json
import os
from typing import Dict, Any, List, Optional, Tuple

def get_geojson_filepath(dataset_type: str = "nationwide") -> str:
    """
    Finds either nationwide or panay GeoJSON file reliably across environments and CWDs.
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    if dataset_type == "nationwide":
        candidates = [
            os.path.join(base_dir, "..", "frontend", "public", "philippines_boundaries.geojson"),
            os.path.join(base_dir, "..", "frontend", "src", "data", "philippines_boundaries.geojson"),
            os.path.join(base_dir, "data", "philippines_boundaries.geojson"),
            "frontend/public/philippines_boundaries.geojson",
            "frontend/src/data/philippines_boundaries.geojson",
            # Fallback to panay if nationwide not generated
            os.path.join(base_dir, "..", "frontend", "public", "panay_municipalities.geojson"),
            os.path.join(base_dir, "data", "panay_municipalities.geojson"),
        ]
    else:
        candidates = [
            os.path.join(base_dir, "..", "frontend", "public", "panay_municipalities.geojson"),
            os.path.join(base_dir, "..", "frontend", "src", "data", "panay_municipalities.geojson"),
            os.path.join(base_dir, "data", "panay_municipalities.geojson"),
            "frontend/public/panay_municipalities.geojson",
            "frontend/src/data/panay_municipalities.geojson"
        ]

    for path in candidates:
        norm = os.path.normpath(path)
        if os.path.exists(norm):
            return norm
    # Fallback default
    return os.path.normpath(candidates[0])

def load_philippines_boundaries_geojson() -> Dict[str, Any]:
    """
    Loads the nationwide GeoJSON FeatureCollection covering all regions of the Philippines,
    including detailed municipal boundaries for Panay Island and provincial/city boundaries nationwide.
    """
    file_path = get_geojson_filepath("nationwide")
    if not os.path.exists(file_path):
        print(f"Notice: Nationwide boundary file not found at {file_path}, falling back to Panay collection.")
        return load_panay_municipalities_geojson()

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    print(f"Successfully loaded {len(data.get('features', []))} administrative boundaries across the Philippines!")
    return data

def load_panay_municipalities_geojson() -> Dict[str, Any]:
    """
    Loads the raw GeoJSON FeatureCollection for Panay municipalities (ADM3 level).
    Can be passed directly into Earth Engine FeatureCollection.
    """
    file_path = get_geojson_filepath("panay")
    if not os.path.exists(file_path):
        # Fall back to nationwide and filter for Panay Island
        nationwide = load_philippines_boundaries_geojson()
        features = [
            f for f in nationwide.get('features', [])
            if f.get('properties', {}).get('ADM2_EN') in ['Aklan', 'Antique', 'Capiz', 'Iloilo']
        ]
        return {"type": "FeatureCollection", "features": features}

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    print(f"Successfully loaded {len(data.get('features', []))} municipalities across Panay Island!")
    return data

def load_boundaries_geojson(scope: str = "nationwide") -> Dict[str, Any]:
    """
    General boundary loader supporting 'nationwide', 'panay', or specific region/province filter.
    """
    clean_scope = (scope or "nationwide").lower().strip()
    if clean_scope in ["panay", "region vi", "region 6", "western visayas"]:
        return load_panay_municipalities_geojson()
    return load_philippines_boundaries_geojson()

def load_panay_municipalities_list() -> List[Dict[str, Any]]:
    """
    Loads all municipal boundaries for Panay Island as a list of Python dictionaries.
    """
    data = load_panay_municipalities_geojson()
    return data.get('features', [])

def load_nationwide_municipalities_list() -> List[Dict[str, Any]]:
    """
    Loads all nationwide municipal and provincial boundaries as a list of Python dictionaries.
    """
    data = load_philippines_boundaries_geojson()
    return data.get('features', [])

def load_municipalities_by_region(region_identifier: str) -> List[Dict[str, Any]]:
    """
    Filters boundaries by region name or ADM1_PCODE (e.g., 'PH06', 'Region VI', 'NCR').
    """
    import re
    all_features = load_nationwide_municipalities_list()
    ident = region_identifier.lower().strip()
    pattern = re.compile(rf"\b{re.escape(ident)}\b", re.IGNORECASE)
    filtered = []
    for f in all_features:
        props = f.get('properties', {})
        reg_name = props.get('ADM1_EN') or ''
        reg_code = (props.get('ADM1_PCODE') or '').lower()
        reg_key = (props.get('region_key') or '').lower()
        if ident == reg_code or ident == reg_key or pattern.search(reg_name):
            filtered.append(f)
    return filtered

def load_municipalities_by_province(province_identifier: str) -> List[Dict[str, Any]]:
    """
    Filters boundaries by province name or ADM2_PCODE (e.g., 'Iloilo', 'PH06030').
    """
    import re
    all_features = load_nationwide_municipalities_list()
    ident = province_identifier.lower().strip()
    pattern = re.compile(rf"\b{re.escape(ident)}\b", re.IGNORECASE)
    filtered = []
    for f in all_features:
        props = f.get('properties', {})
        prov_name = props.get('ADM2_EN') or ''
        prov_code = (props.get('ADM2_PCODE') or '').lower()
        prov_key = (props.get('province_key') or '').lower()
        if ident == prov_code or ident == prov_key or pattern.search(prov_name):
            filtered.append(f)
    return filtered

def get_municipality_lookup(features: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """
    Builds comprehensive lookup dictionaries for mapping between
    feature indices (system:index), standard codes (ADM3_PCODE, psgc_id, psgc_code),
    and municipal names across the Philippines.
    Disambiguates duplicate municipal names by indexing both simple names and (name, province) keys.
    """
    if features is None:
        features = load_nationwide_municipalities_list()

    by_index: Dict[str, Dict[str, Any]] = {}
    by_pcode: Dict[str, Dict[str, Any]] = {}
    by_psgc: Dict[str, Dict[str, Any]] = {}
    by_name: Dict[str, Dict[str, Any]] = {}
    by_name_province: Dict[Tuple[str, str], Dict[str, Any]] = {}
    by_region: Dict[str, List[Dict[str, Any]]] = {}

    for idx, feat in enumerate(features):
        props = feat.get('properties', {})
        name = props.get('ADM3_EN') or props.get('psgc_name') or 'Unknown'
        pcode = props.get('ADM3_PCODE') or props.get('psgc_id') or f"UNKNOWN_{idx}"
        psgc = props.get('psgc_code') or props.get('psgc_id') or ''
        province = props.get('ADM2_EN') or 'Panay'
        province_code = props.get('ADM2_PCODE') or ''
        region = props.get('ADM1_EN') or 'Region VI (Western Visayas)'
        region_code = props.get('ADM1_PCODE') or 'PH06'

        meta = {
            "name": name,
            "pcode": pcode,
            "psgc": psgc,
            "province": province,
            "province_code": province_code,
            "region": region,
            "region_code": region_code,
            "index": str(idx)
        }

        by_index[str(idx)] = meta
        if pcode:
            by_pcode[pcode] = meta
            by_pcode[pcode.lower()] = meta
        if psgc:
            by_psgc[psgc] = meta
        if name:
            by_name[name.lower()] = meta
            by_name_province[(name.lower(), province.lower())] = meta

        if region_code:
            if region_code not in by_region:
                by_region[region_code] = []
            by_region[region_code].append(meta)

    return {
        "by_index": by_index,
        "by_pcode": by_pcode,
        "by_psgc": by_psgc,
        "by_name": by_name,
        "by_name_province": by_name_province,
        "by_region": by_region,
        "total_municipalities": len(features)
    }

def parse_feature_identity_and_radiance(
    feature: Dict[str, Any], 
    lookup: Optional[Dict[str, Any]] = None
) -> Tuple[str, str, Optional[float]]:
    """
    Resolves (municipality_name, pcode, radiance_value) from a GEE FeatureCollection feature.
    Gracefully handles cloud-masked nulls and recovers names and standard codes via lookup.
    """
    if lookup is None:
        lookup = get_municipality_lookup()

    by_index = lookup["by_index"]
    by_pcode = lookup["by_pcode"]
    by_psgc = lookup.get("by_psgc", {})
    by_name = lookup["by_name"]

    props = feature.get('properties', {}) if isinstance(feature, dict) else {}
    if not isinstance(props, dict):
        props = {}

    # 1. Identify PCode, PSGC & Name
    name = props.get('ADM3_EN') or props.get('psgc_name')
    if not name or name == "Unknown":
        alt_name = props.get('name')
        if alt_name and alt_name != "Unknown":
            name = alt_name

    pcode = props.get('ADM3_PCODE') or props.get('psgc_id') or props.get('psgc_code')

    # If missing name, attempt recovery from pcode or psgc
    if (not name or name == "Unknown") and pcode:
        if pcode in by_pcode:
            name = by_pcode[pcode]["name"]
        elif pcode in by_psgc:
            name = by_psgc[pcode]["name"]

    # If missing pcode, attempt recovery from name
    if (not pcode or str(pcode).startswith("UNKNOWN")) and name and name.lower() in by_name:
        pcode = by_name[name.lower()]["pcode"]

    # Fallback to system:index or feature id
    if not name or name == "Unknown" or not pcode:
        sys_idx = str(props.get('system:index', feature.get('id', ''))).strip()
        if sys_idx in by_index:
            name = by_index[sys_idx]["name"]
            pcode = by_index[sys_idx]["pcode"]

    # 2. Extract Radiance
    raw_rad = None
    for key in ['mean', 'avg_rad', 'rad', 'DNB_BRDF_Corrected_NTL']:
        if key in props and props[key] is not None:
            raw_rad = props[key]
            break

    radiance: Optional[float] = None
    if raw_rad is not None:
        try:
            radiance = round(float(raw_rad), 6)
        except (ValueError, TypeError):
            radiance = None

    return (name or "Unknown", pcode or "UNKNOWN", radiance)