import ee

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

    image = dataset.first()
    
    # Calculate the average radiance for each polygon in the GeoJSON
    zonal_stats = image.reduceRegions(
        collection=geojson_collection,
        reducer=ee.Reducer.mean(),
        scale=500 # VIIRS native resolution in meters
    )
    
    # Returns a dictionary payload ready to be parsed into the SQLite database
    return zonal_stats.getInfo()