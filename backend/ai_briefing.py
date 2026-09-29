import os
from google import genai
from dotenv import load_dotenv
import time
load_dotenv()

def generate_recovery_briefing(event_context: str, max_retries=3, delay=2):
    """
    Sends disaster recovery context to gemini-3.8-flash for an automated briefing.
    """
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    
    prompt = f"""
    Analyze the following disaster recovery scenario in Panay, Philippines.
    Provide a concise, professional briefing suitable for a government response team.

    Scenario Data:
    {event_context}
    """
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model='gemini-3.8-flash',
                contents=[prompt]
            )
            return response.text or ""
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(delay)
                continue
            else:
                raise e
    