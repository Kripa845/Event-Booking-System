"""
Plain-English event search: Claude turns a sentence like
"free tech workshops this weekend in Lalitpur" into structured filters,
which we then run as an ordinary database query.

Needs Anthropic credentials (ANTHROPIC_API_KEY) on the server. Without them
the endpoint reports that smart search isn't configured and the frontend
falls back to normal keyword search.
"""
import datetime
import json
import logging

import anthropic
from django.db.models import Q
from django.utils import timezone

from .models import Event

logger = logging.getLogger(__name__)

MODEL = "claude-opus-5-5"
MAX_QUERY_LENGTH = 200

CATEGORIES = [c.value for c in Event.Category]

FILTER_SCHEMA = {
    "type": "object",
    "properties": {
        "keywords": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Topic words to match in titles/descriptions/tags, e.g. ['python']. Empty if none.",
        },
        "category": {"type": "string", "enum": CATEGORIES + [""]},
        "location": {"type": "string", "description": "Place name, or empty."},
        "date_from": {"type": "string", "description": "YYYY-MM-DD, or empty."},
        "date_to": {"type": "string", "description": "YYYY-MM-DD, or empty."},
        "free_only": {"type": "boolean"},
        "max_price": {"type": "integer", "description": "Max ticket price in NPR, 0 if no limit."},
        "outdoor_only": {"type": "boolean"},
        "summary": {
            "type": "string",
            "description": "Short description of how you read the request, e.g. 'Free workshops in Lalitpur, Oct 24-25'.",
        },
    },
    "required": [
        "keywords", "category", "location", "date_from", "date_to",
        "free_only", "max_price", "outdoor_only", "summary",
    ],
    "additionalProperties": False,
}

SYSTEM_PROMPT = f"""You turn a person's event search into filters for EventHub, an event booking site in Nepal.

Categories: {", ".join(CATEGORIES)}. Pick one only when the request clearly asks for that kind of event
(e.g. "gigs" or "live music" is CONCERT, "hackathons" is HACKATHON); otherwise leave category empty.
Put topic words that aren't a category (e.g. "tech", "python", "jazz", "AI") in keywords, singular and lowercase.
Leave out filler words such as "events", "something", "near me".

Locations are usually in the Kathmandu valley (e.g. Kathmandu, Lalitpur/Patan, Bhaktapur, Thamel, Baneshwor)
or other Nepali cities. Use the place exactly as the person wrote it.

Resolve relative dates against today's date, which is given with the request. "This weekend" means the coming
Saturday and Sunday (today included if it is Saturday or Sunday). "Tonight" or "today" is today's date only.
Leave both dates empty if no time is mentioned.

Prices are in NPR. "Free" sets free_only. "Under 500" or "cheap, below 1000 rupees" sets max_price.
"Outdoor" or "open air" sets outdoor_only.

If the request isn't about finding events, return empty filters and say so in summary."""


class SmartSearchUnavailable(Exception):
    """Smart search can't run right now (not configured, or the API is unreachable)."""


_client = None


def get_client():
    global _client
    if _client is None:
        _client = anthropic.Anthropic(timeout=20.0, max_retries=1)
    return _client


def extract_filters(query, today=None):
    """Ask Claude for structured filters. Raises SmartSearchUnavailable on failure."""
    today = today or timezone.localdate()

    try:
        response = get_client().beta.messages.create(
            model=MODEL,
            max_tokens=2048,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            system=SYSTEM_PROMPT,
            output_config={
                "effort": "low",
                "format": {"type": "json_schema", "schema": FILTER_SCHEMA},
            },
            messages=[{
                "role": "user",
                "content": f"Today is {today:%A, %Y-%m-%d}.\n\nSearch: {query}",
            }],
        )
    except anthropic.AuthenticationError as exc:
        raise SmartSearchUnavailable("not_configured") from exc
    except anthropic.RateLimitError as exc:
        raise SmartSearchUnavailable("busy") from exc
    except anthropic.APIStatusError as exc:
        logger.warning("Smart search API error %s (request %s)", exc.status_code, exc.request_id)
        raise SmartSearchUnavailable("unavailable") from exc
    except anthropic.APIConnectionError as exc:
        raise SmartSearchUnavailable("unavailable") from exc
    except TypeError as exc:
        # The SDK raises this when it can't find any credentials at all.
        raise SmartSearchUnavailable("not_configured") from exc

    if response.stop_reason == "refusal":
        raise SmartSearchUnavailable("refused")

    text = next((b.text for b in response.content if b.type == "text"), None)
    if text is None:
        raise SmartSearchUnavailable("unavailable")
    return json.loads(text)


def _parse_date(value):
    try:
        return datetime.date.fromisoformat(value) if value else None
    except ValueError:
        return None


def run_filters(filters, today=None):
    """Apply extracted filters to published events. Returns (events, relaxed_fields)."""
    today = today or timezone.localdate()
    qs = Event.objects.filter(status__in=[Event.Status.PUBLISHED, Event.Status.SOLD_OUT]).select_related("organizer")

    date_from = _parse_date(filters.get("date_from"))
    date_to = _parse_date(filters.get("date_to"))
    qs = qs.filter(date__gte=date_from or today)
    if date_to:
        qs = qs.filter(date__lte=date_to)

    if filters.get("category") in CATEGORIES:
        qs = qs.filter(category=filters["category"])
    if filters.get("location"):
        loc = filters["location"]
        qs = qs.filter(Q(location__icontains=loc) | Q(venue__icontains=loc))
    if filters.get("free_only"):
        qs = qs.filter(price=0)
    elif filters.get("max_price"):
        qs = qs.filter(price__lte=filters["max_price"])
    if filters.get("outdoor_only"):
        qs = qs.filter(is_outdoor=True)

    keywords = [k.strip() for k in filters.get("keywords") or [] if k.strip()]
    if keywords:
        match = Q()
        for word in keywords:
            match |= (
                Q(title__icontains=word) | Q(description__icontains=word) | Q(tags__icontains=word)
            )
        with_keywords = qs.filter(match)
        if with_keywords.exists():
            return with_keywords.order_by("date"), []
        # Nothing mentions the topic words: show the other matches rather than nothing.
        return qs.order_by("date"), ["keywords"]

    return qs.order_by("date"), []
