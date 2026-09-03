from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="SANAG API", version="1.0.0")

# Enable CORS for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with specific domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "SANAG Engine Online"}

@app.get("/api/v1/events")
def get_events():
    # Placeholder for SQLite database query
    return {
        "event_id": "jan_2024_collapse",
        "name": "Panay Grid Collapse",
        "date": "2024-01-02",
        "affected_provinces": ["Aklan", "Antique", "Capiz", "Iloilo"]
    }