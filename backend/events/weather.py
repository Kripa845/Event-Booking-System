"""
Weather on the day for outdoor events, from Open-Meteo (free, no API key).
Forecasts only exist up to 16 days ahead.
"""
import datetime
import json
import logging
from urllib.parse import urlencode
from urllib.request import urlopen

from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger(__name__)

GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
FORECAST_DAYS = 16
FALLBACK_PLACE = "Kathmandu"

# WMO weather codes -> short description
CODES = {
    0: "Clear sky", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
    61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain",
    71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
    80: "Rain showers", 81: "Rain showers", 82: "Violent rain showers",
    85: "Snow showers", 86: "Snow showers",
    95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with hail",
}


# Drizzle, rain and showers
WET_CODES = set(range(51, 68)) | {80, 81, 82}


def fetch_json(url, params):
    with urlopen(f"{url}?{urlencode(params)}", timeout=8) as res:
        return json.loads(res.read().decode("utf-8"))


def geocode(name):
    """(lat, lon, place name) for a Nepali place, cached for a week."""
    key = f"geo:{name.strip().lower()}"
    hit = cache.get(key)
    if hit is not None:
        return hit or None

    data = fetch_json(GEOCODE_URL, {"name": name, "count": 1, "countryCode": "NP"})
    results = data.get("results") or []
    found = (results[0]["latitude"], results[0]["longitude"], results[0]["name"]) if results else ()
    cache.set(key, found, 60 * 60 * 24 * 7)
    return found or None


def advice(rain_chance, code, temp_max):
    if code in (95, 96, 99):
        return "storm", "Thunderstorms are forecast. Have an indoor backup plan."
    if rain_chance is not None and rain_chance >= 60:
        return "rain", "Rain is likely. Bring an umbrella or rain jacket."
    if temp_max is not None and temp_max >= 33:
        return "heat", "It'll be hot. Bring water and find some shade."
    if (rain_chance is not None and rain_chance >= 30) or code in WET_CODES:
        return "showers", "Some chance of showers. A light jacket wouldn't hurt."
    return None, "Looks like good weather for it."


def forecast_for(event):
    today = timezone.localdate()
    days_away = (event.date - today).days

    if days_away < 0:
        return {"available": False, "reason": "past"}
    if days_away >= FORECAST_DAYS:
        return {
            "available": False,
            "reason": "too_far",
            "available_from": event.date - datetime.timedelta(days=FORECAST_DAYS - 1),
        }

    key = f"wx:{event.location.strip().lower()}:{event.date}"
    cached = cache.get(key)
    if cached:
        return cached

    try:
        spot = None
        for name in (event.location, event.venue, FALLBACK_PLACE):
            if name and name.strip():
                spot = geocode(name)
                if spot:
                    break
        if not spot:
            return {"available": False, "reason": "unknown_place"}

        lat, lon, place = spot
        daily = fetch_json(FORECAST_URL, {
            "latitude": lat,
            "longitude": lon,
            "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
            "timezone": "Asia/Kathmandu",
            "start_date": event.date.isoformat(),
            "end_date": event.date.isoformat(),
        })["daily"]
    except Exception:
        logger.warning("Weather lookup failed for event %s", event.id, exc_info=True)
        return {"available": False, "reason": "unavailable"}

    code = daily["weather_code"][0]
    rain = daily["precipitation_probability_max"][0]
    temp_max = daily["temperature_2m_max"][0]
    alert, tip = advice(rain, code, temp_max)

    result = {
        "available": True,
        "place": place,
        "date": event.date,
        "summary": CODES.get(code, "Mixed weather"),
        "temp_max": temp_max,
        "temp_min": daily["temperature_2m_min"][0],
        "rain_chance": rain,
        "alert": alert,
        "advice": tip,
    }
    cache.set(key, result, 60 * 60)
    return result
