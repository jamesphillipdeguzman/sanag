from backend.gdacs_service import get_latest_philippines_disasters

if __name__ == "__main__":
    print("Querying GDACS live feeds for disaster alerts...")
    results = get_latest_philippines_disasters()
    
    if results:
        print(f"Found {len(results)} matching event(s) for the Philippines:")
        for event in results:
            print(f"- [{event['alert_level']}] {event['name']} ({event['type']}) on {event['date']}")
    else:
        print("No active disaster alerts currently flagged for the Philippines in the recent feed window.")