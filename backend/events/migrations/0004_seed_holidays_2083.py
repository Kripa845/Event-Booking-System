"""
Public holidays for BS 2083 (14 Apr 2026 – 13 Apr 2027), from the Nepal
Government's gazette notice. Festivals move every year: add next year's list
in Django admin (Events → Holidays) once it is published.
"""
import datetime

from django.db import migrations

D = datetime.date

# (name, name_np, start, end, major)
HOLIDAYS_2083 = [
    ("Nepali New Year", "नयाँ वर्ष", D(2026, 4, 14), D(2026, 4, 14), False),
    ("Buddha Jayanti", "बुद्ध जयन्ती", D(2026, 5, 1), D(2026, 5, 1), False),
    ("Republic Day", "गणतन्त्र दिवस", D(2026, 5, 29), D(2026, 5, 29), False),
    ("Janai Purnima", "जनै पूर्णिमा", D(2026, 8, 28), D(2026, 8, 28), False),
    ("Gai Jatra", "गाईजात्रा", D(2026, 8, 29), D(2026, 8, 29), False),
    ("Krishna Janmashtami", "कृष्ण जन्माष्टमी", D(2026, 9, 4), D(2026, 9, 4), False),
    ("Haritalika Teej", "हरितालिका तीज", D(2026, 9, 14), D(2026, 9, 14), False),
    ("Constitution Day", "संविधान दिवस", D(2026, 9, 19), D(2026, 9, 19), False),
    ("Indra Jatra", "इन्द्रजात्रा", D(2026, 9, 25), D(2026, 9, 25), False),
    ("Ghatasthapana", "घटस्थापना", D(2026, 10, 11), D(2026, 10, 11), False),
    ("Dashain", "दशैँ", D(2026, 10, 17), D(2026, 10, 23), True),
    ("Tihar", "तिहार", D(2026, 11, 8), D(2026, 11, 12), True),
    ("Chhath", "छठ", D(2026, 11, 15), D(2026, 11, 15), False),
    ("Yomari Punhi", "योमरी पुन्ही", D(2026, 12, 24), D(2026, 12, 24), False),
    ("Christmas Day", "क्रिसमस", D(2026, 12, 25), D(2026, 12, 25), False),
    ("Tamu Lhosar", "तमु ल्होसार", D(2026, 12, 30), D(2026, 12, 30), False),
    ("Prithvi Jayanti", "पृथ्वी जयन्ती", D(2027, 1, 11), D(2027, 1, 11), False),
    ("Maghe Sankranti", "माघे संक्रान्ति", D(2027, 1, 15), D(2027, 1, 15), False),
    ("Martyrs' Day", "शहीद दिवस", D(2027, 1, 30), D(2027, 1, 30), False),
    ("Sonam Lhosar", "सोनाम ल्होसार", D(2027, 2, 7), D(2027, 2, 7), False),
    ("National Democracy Day", "प्रजातन्त्र दिवस", D(2027, 2, 19), D(2027, 2, 19), False),
    ("Maha Shivaratri", "महाशिवरात्रि", D(2027, 3, 6), D(2027, 3, 6), False),
    ("Gyalpo Lhosar", "ग्याल्पो ल्होसार", D(2027, 3, 9), D(2027, 3, 9), False),
    ("Holi", "होली", D(2027, 3, 21), D(2027, 3, 22), False),
    ("Ghode Jatra", "घोडेजात्रा", D(2027, 4, 6), D(2027, 4, 6), False),
]


def seed(apps, schema_editor):
    Holiday = apps.get_model("events", "Holiday")
    for name, name_np, start, end, major in HOLIDAYS_2083:
        Holiday.objects.get_or_create(
            name=name, start_date=start,
            defaults={"name_np": name_np, "end_date": end, "major": major},
        )


def unseed(apps, schema_editor):
    Holiday = apps.get_model("events", "Holiday")
    for name, _, start, _, _ in HOLIDAYS_2083:
        Holiday.objects.filter(name=name, start_date=start).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0003_holiday"),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
