"""
AI Situational Briefing Service for SANAG.
Coordinates with Gemini models and executive_summary generator logic.
"""
from pathlib import Path
from dotenv import load_dotenv

# Ensure .env is loaded from the backend directory regardless of cwd
load_dotenv(Path(__file__).resolve().parent / ".env")
load_dotenv()

from executive_summary import (
    generate_recovery_briefing,
    generate_executive_summary,
    generate_fallback_briefing,
    filter_restored_municipalities,
    get_restoration_benchmarks_card_data,
    _parse_event_context,
    _clean_lgu_summary,
)

__all__ = [
    "generate_recovery_briefing",
    "generate_executive_summary",
    "generate_fallback_briefing",
    "filter_restored_municipalities",
    "get_restoration_benchmarks_card_data",
    "_parse_event_context",
    "_clean_lgu_summary",
]