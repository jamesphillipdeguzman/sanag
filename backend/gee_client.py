import ee
import sys
import json
from loader import load_panay_municipalities_geojson

def initialize_gee():
    """
    Authenticates and initializes Google Earth Engine.
    For the containerized environment, ensure your service account 
    credentials JSON is mounted via Docker volumes.
    """
    try:
        # Replace with your specific GCP project ID
        ee.Initialize(project='sanag-capstone-project') 
        print("GEE Engine Initialized Successfully.")
    except Exception as e:
        print(f"GEE Initialization Failed: {e}")
        sys.exit(1) # Force the script to stop if initialization failed

def extract_daily_vnp46a2(geojson_collection, target_date):
    """
    Pulls daily NASA VIIRS VNP46A2 DNB radiance and performs
    ee.Reducer.mean() across municipal boundaries for a specific date.
    """
    collection_id = 'NASA/VIIRS/002/VNP46A2' # Daily VIIRS DNB NTL
    band_name = 'DNB_BRDF_Corrected_NTL'

    # Filter the daily image collection for the target date
    dataset = ee.ImageCollection(collection_id).filterDate(
        ee.Date(target_date), ee.Date(target_date).advance(1, 'day')
    ).select(band_name)

    # Safe fallback if no imagery exists (e.g., severe cloud cover)
    if dataset.size().getInfo() == 0:
        print(f"No data found for {target_date}")
        return {"type": "FeatureCollection", "features": []}

    image = dataset.first()

    # Convert GeoJSON to FeatureCollection
    # Note: 'geojson_collection' is already expected to be an ee.FeatureCollection
    # based on previous usage, but we ensure it here for safety.
    if isinstance(geojson_collection, dict):
        feature_collection = ee.FeatureCollection(geojson_collection)
    else:
        feature_collection = geojson_collection

    # Perform zonal statistics (mean radiance) for each municipality
    zonal_stats = image.reduceRegions(
        collection=feature_collection,
        reducer=ee.Reducer.mean(),
        scale=500,  # VIIRS native resolution in meters
        crs='EPSG:4326'
    )

    # Return the result as a Python dictionary
    return zonal_stats.getInfo()







     
def extract_zonal_radiance(geojson_collection, target_date, is_baseline=False):
    """
    Queries VIIRS data and performs ee.Reducer.mean() across municipality boundaries.
    """
    # Toggle between daily tracking and monthly baseline datasets
    collection_id = 'NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG' if is_baseline else 'NASA/VIIRS/002/VNP46A2'
    band_name = 'avg_rad' if is_baseline else 'DNB_BRDF_Corrected_NTL'
    
    dataset = ee.ImageCollection(collection_id).filterDate(
        ee.Date(target_date), ee.Date(target_date).advance(1, 'day')
    ).select(band_name)

    # If collection is empty, return a safe fallback structure
    if dataset.size().getInfo() == 0:
        return {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "geometry": f.get('geometry'),
                "properties": {
                    "name": f.get('properties', {}).get('name', 'Unknown'),
                    "system:index": f.get('id', '0'),
                    "mean": None
                }
            } for f in geojson_collection.getInfo()['features']]
        }

    image = dataset.first()
    
    # Calculate the average radiance for each polygon in the GeoJSON
    zonal_stats = image.reduceRegions(
        collection=geojson_collection,
        reducer=ee.Reducer.mean(),
        scale=500 # VIIRS native resolution in meters
    )
    
    # Returns a dictionary payload ready to be parsed into the SQLite database
    return zonal_stats.getInfo()

if __name__ == "__main__":
    # 1. Initialize the connection
    initialize_gee()

    # 2. Load actual Panay municipal boundaries
    print("\n--- Loading Panay Municipal Boundaries ---")
    panay_geojson = load_panay_municipalities_geojson()
    panay_feature_collection = ee.FeatureCollection(panay_geojson)

    # 3. User Input for Daily VNP46A2 Query
    print("\n--- Task: Daily VIIRS DNB Routine (VNP46A2) ---")
    user_date = input("Enter target date to query (YYYY-MM-DD): ").strip()


    try:
        print(f"\nQuerying NASA VIIRS VNP46A2 for {user_date}")
        result = extract_daily_vnp46a2(panay_feature_collection, user_date)

        features = result.get('features', [])
        print(f"\nSuccessfully processed {len(features)} municipal features for {user_date}!")
        
        valid_municipalities = []
        for feature in features:
            if isinstance(feature, dict):
                props = feature.get('properties', {})
                if isinstance(props, dict):
                    name = props.get('ADM3_EN', 'Unknown')
                    radiance = props.get('mean', None)
                    if radiance is not None:
                        valid_municipalities.append((name, radiance))

        if valid_municipalities:
            valid_municipalities.sort(key=lambda x: x[1])
            lowest = valid_municipalities[0]
            highest = valid_municipalities[-1]

            print("\n--- Panay Island Radiance Extremes ---")
            print(f"📉 Lowest Radiance: {lowest[0]} ({lowest[1]:.4f})")
            print(f"📈 Highest Radiance: {highest[0]} ({highest[1]:.4f})")
        else:
            print("No valid radiance data found across features (heavy cloud cover).")

    except Exception as e:
        print(f"Query failed: {e}")