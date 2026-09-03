import ee
import sys

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
    # Initialize the connection
    initialize_gee()

    # Crate a temporary dummy polygon for testing (Roughly Iloilo City)
    test_polygon = ee.FeatureCollection([
        ee.Feature(ee.Geometry.Rectangle([122.5, 10.6, 122.6, 10.7]), {'name': 'Iloilo Test Area'})
    ])

    # Test pulling data for January 3, 2024 (The Panay Grid Collapse)
    print("\n--- Requesting VIIRS Data for Jan 3, 2024 ---")
    try:
        daily_result = extract_zonal_radiance(test_polygon, '2024-01-3', is_baseline=False)

        # Print the resulting dictionary
        import json
        print(json.dumps(daily_result, indent=2))

        # 1. Grab the first feature from the features list
        # 1. Grab the first feature from the features list
        feature = daily_result['features'][0]  # type: ignore
        
        # Ensure the type checker knows it's a dictionary
        if isinstance(feature, dict):
            properties = feature.get('properties', {})  # type: ignore
            radiance = properties.get('mean', None)  # type: ignore

            print("\n--- Parsed Result ---")
            if radiance is None:
                print(f"No valid data for {properties.get('name', 'Unknown Area')} on this date (likely cloud cover or empty collection).")  # type: ignore
            else:
                print(f"Success! The mean radiance for {properties.get('name', 'Unknown Area')} is: {radiance}")  # type: ignore

    except Exception as e:
        print(f"Query failed: {e}")
