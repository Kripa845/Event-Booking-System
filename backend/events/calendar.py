"""
Date checks for organizers: does a proposed date fall on a public holiday,
or clash with a similar event?
"""
from django.db.models import Q

from .models import Event, Holiday


def holidays_on(date):
    return Holiday.objects.filter(start_date__lte=date, end_date__gte=date)


def holiday_names_on(date):
    return [h.name for h in holidays_on(date)]


def check_date(date, location="", category="", exclude_id=None):
    holidays = [
        {
            "name": h.name,
            "name_np": h.name_np,
            "start_date": h.start_date,
            "end_date": h.end_date,
            "major": h.major,
        }
        for h in holidays_on(date)
    ]

    same_day = Event.objects.filter(
        date=date,
        status__in=[Event.Status.PUBLISHED, Event.Status.SOLD_OUT],
    )
    if exclude_id:
        same_day = same_day.exclude(id=exclude_id)

    location = (location or "").strip()
    match = Q()
    if location:
        match |= Q(location__iexact=location) | Q(venue__iexact=location)
    if category:
        match |= Q(category=category)

    clashes = []
    if location or category:
        for e in same_day.filter(match).select_related("organizer")[:10]:
            reasons = []
            if location and location.lower() in (e.location.lower(), (e.venue or "").lower()):
                reasons.append("same place")
            if category and e.category == category:
                reasons.append(f"also a {e.get_category_display().lower()}")
            clashes.append({
                "id": e.id,
                "title": e.title,
                "location": e.location,
                "organizer": e.organizer.username,
                "reasons": reasons,
            })

    return {"date": date, "holidays": holidays, "clashes": clashes}
