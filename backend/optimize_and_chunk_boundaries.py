"""
Processes and optimizes nationwide municipal boundary GeoJSON datasets:
1. Applies Douglas-Peucker geometry simplification and coordinate precision reduction
   to minimize vertex count and GeoJSON payload size.
2. Generates region-specific chunks in frontend/public/regions/ for asynchronous lazy loading.
3. Updates panay_municipalities.geojson and philippines_boundaries.geojson with simplified geometries.
"""
import json
import math
import os
from typing import Dict, Any, List, Tuple

def point_line_distance(point: List[float], line_start: List[float], line_end: List[float]) -> float:
    x0, y0 = point[0], point[1]
    x1, y1 = line_start[0], line_start[1]
    x2, y2 = line_end[0], line_end[1]
    dx = x2 - x1
    dy = y2 - y1
    if dx == 0 and dy == 0:
        return math.hypot(x0 - x1, y0 - y1)
    return abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / math.hypot(dx, dy)

def douglas_peucker(coords: List[List[float]], epsilon: float = 0.0006) -> List[List[float]]:
    if len(coords) <= 2:
        return coords
    dmax = 0.0
    index = 0
    end = len(coords) - 1
    for i in range(1, end):
        d = point_line_distance(coords[i], coords[0], coords[end])
        if d > dmax:
            index = i
            dmax = d
    if dmax > epsilon:
        rec1 = douglas_peucker(coords[:index + 1], epsilon)
        rec2 = douglas_peucker(coords[index:], epsilon)
        return rec1[:-1] + rec2
    else:
        return [coords[0], coords[end]]

def simplify_ring(ring: List[List[float]], epsilon: float = 0.0006, precision: int = 4) -> List[List[float]]:
    if len(ring) < 4:
        return [[round(c[0], precision), round(c[1], precision)] for c in ring]
    is_closed = (ring[0] == ring[-1])
    pts = ring[:-1] if is_closed else list(ring)
    if len(pts) <= 3:
        res = [[round(c[0], precision), round(c[1], precision)] for c in ring]
        if res[0] != res[-1]:
            res.append(res[0])
        return res
    
    # Split into 2 open lines around the farthest point from p0
    p0 = pts[0]
    farthest_idx = max(range(1, len(pts)), key=lambda i: math.hypot(pts[i][0] - p0[0], pts[i][1] - p0[1]))
    if farthest_idx == 0 or farthest_idx == len(pts) - 1:
        farthest_idx = len(pts) // 2

    part1 = douglas_peucker(pts[:farthest_idx + 1], epsilon)
    part2 = douglas_peucker(pts[farthest_idx:] + [pts[0]], epsilon)
    simplified = part1[:-1] + part2

    if len(simplified) < 4:
        simplified = pts + [pts[0]]

    res = [[round(c[0], precision), round(c[1], precision)] for c in simplified]
    if res[0] != res[-1]:
        res.append(res[0])
    return res

def simplify_geometry(geometry: Dict[str, Any], epsilon: float = 0.0006, precision: int = 4) -> Dict[str, Any]:
    gtype = geometry.get("type")
    coords = geometry.get("coordinates", [])
    if gtype == "Polygon":
        new_coords = [simplify_ring(ring, epsilon, precision) for ring in coords]
        return {"type": "Polygon", "coordinates": new_coords}
    elif gtype == "MultiPolygon":
        new_coords = [
            [simplify_ring(ring, epsilon, precision) for ring in poly]
            for poly in coords
        ]
        return {"type": "MultiPolygon", "coordinates": new_coords}
    return geometry

def process_and_chunk_boundaries():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    source_path = os.path.join(base_dir, "data", "philippines_boundaries.geojson")
    if not os.path.exists(source_path):
        source_path = os.path.join(base_dir, "..", "frontend", "public", "philippines_boundaries.geojson")

    print(f"Reading source dataset: {source_path}")
    with open(source_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    features = data.get("features", [])
    print(f"Total features: {len(features)}")

    # Simplify all features
    simplified_features = []
    for feat in features:
        geom = feat.get("geometry")
        if geom:
            feat_copy = dict(feat)
            feat_copy["geometry"] = simplify_geometry(geom, epsilon=0.0006, precision=4)
            simplified_features.append(feat_copy)
        else:
            simplified_features.append(feat)

    # Save simplified nationwide dataset
    nationwide_collection = {
        "type": "FeatureCollection",
        "name": "philippines_municipal_boundaries_simplified",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "features": simplified_features
    }

    pub_dir = os.path.join(base_dir, "..", "frontend", "public")
    src_data_dir = os.path.join(base_dir, "..", "frontend", "src", "data")
    backend_data_dir = os.path.join(base_dir, "data")

    # 1. Update nationwide files
    for d in [pub_dir, src_data_dir, backend_data_dir]:
        os.makedirs(d, exist_ok=True)
        out_path = os.path.join(d, "philippines_boundaries.geojson")
        with open(out_path, "w", encoding="utf-8") as out:
            json.dump(nationwide_collection, out, ensure_ascii=False)
        print(f"Saved simplified nationwide file to: {out_path} ({os.path.getsize(out_path)/1024:.1f} KB)")

    # 2. Extract and simplify Panay 93 LGUs
    panay_features = [
        f for f in simplified_features
        if f.get("properties", {}).get("region_key") == "panay" or
           any(p in (f.get("properties", {}).get("ADM2_EN") or "").lower() for p in ["iloilo", "capiz", "aklan", "antique"])
    ]
    panay_collection = {
        "type": "FeatureCollection",
        "name": "panay_municipalities_simplified",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "features": panay_features
    }
    panay_pub_path = os.path.join(pub_dir, "panay_municipalities.geojson")
    with open(panay_pub_path, "w", encoding="utf-8") as out:
        json.dump(panay_collection, out, ensure_ascii=False)
    print(f"Saved simplified panay file to: {panay_pub_path} ({os.path.getsize(panay_pub_path)/1024:.1f} KB, {len(panay_features)} LGUs)")

    # 3. Create region-based chunks for lazy loading in frontend/public/regions/
    regions_pub_dir = os.path.join(pub_dir, "regions")
    regions_src_dir = os.path.join(src_data_dir, "regions")
    os.makedirs(regions_pub_dir, exist_ok=True)
    os.makedirs(regions_src_dir, exist_ok=True)

    region_features_map: Dict[str, List[Any]] = {
        "panay": panay_features,
        "iloilo": [f for f in panay_features if "iloilo" in (f.get("properties", {}).get("ADM2_EN") or "").lower()],
        "capiz": [f for f in panay_features if "capiz" in (f.get("properties", {}).get("ADM2_EN") or "").lower()],
        "aklan": [f for f in panay_features if "aklan" in (f.get("properties", {}).get("ADM2_EN") or "").lower()],
        "antique": [f for f in panay_features if "antique" in (f.get("properties", {}).get("ADM2_EN") or "").lower()],
        "philippines": simplified_features,
    }

    # Group the remaining nationwide regions by region_key
    for feat in simplified_features:
        rkey = feat.get("properties", {}).get("region_key")
        if not rkey or rkey in ["panay", "iloilo", "capiz", "aklan", "antique", "philippines"]:
            continue
        if rkey not in region_features_map:
            region_features_map[rkey] = []
        region_features_map[rkey].append(feat)

    # Save each chunk
    manifest = {}
    for rkey, feat_list in region_features_map.items():
        chunk = {
            "type": "FeatureCollection",
            "name": f"region_{rkey}_simplified",
            "region_key": rkey,
            "feature_count": len(feat_list),
            "features": feat_list
        }
        for out_dir in [regions_pub_dir, regions_src_dir]:
            fpath = os.path.join(out_dir, f"{rkey}.geojson")
            with open(fpath, "w", encoding="utf-8") as out:
                json.dump(chunk, out, ensure_ascii=False)
        size_kb = os.path.getsize(os.path.join(regions_pub_dir, f"{rkey}.geojson")) / 1024
        manifest[rkey] = {
            "file": f"/regions/{rkey}.geojson",
            "count": len(feat_list),
            "size_kb": round(size_kb, 1)
        }
        print(f"Chunk [{rkey}]: {len(feat_list)} features, {size_kb:.1f} KB -> /regions/{rkey}.geojson")

    # Save manifest index
    with open(os.path.join(regions_pub_dir, "manifest.json"), "w", encoding="utf-8") as out:
        json.dump(manifest, out, indent=2)
    print("Optimization and region chunking complete!")

if __name__ == "__main__":
    process_and_chunk_boundaries()
