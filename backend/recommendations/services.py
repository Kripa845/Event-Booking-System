import logging
from django.utils import timezone
from django.db.models import Count, Q
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from events.models import Event
from bookings.models import Booking

logger = logging.getLogger(__name__)

def clean_and_combine(event):
    """
    Combines event metadata (title, description, category, and tags)
    into a single sanitized, lowercased text representation.
    """
    title = event.title or ""
    description = event.description or ""
    category = event.category or ""
    tags = (event.tags or "").replace(",", " ")
    
    # Combine text fields, clean whitespace, and lowercase
    combined = f"{title} {description} {category} {tags}".strip().lower()
    
    # Fallback to avoid empty strings which can cause issues with TF-IDF Vectorizer
    if not combined:
        combined = "event"
    return combined

def get_popular_upcoming_events(exclude_ids=None, limit=5):
    """
    Fallback method: Returns upcoming published events ordered by booking count.
    Used for new users or in case of errors.
    """
    today = timezone.now().date()
    qs = Event.objects.filter(
        status=Event.Status.PUBLISHED,
        date__gte=today
    )
    
    if exclude_ids:
        qs = qs.exclude(id__in=exclude_ids)
        
    return qs.annotate(
        confirmed_bookings=Count('bookings', filter=Q(bookings__status=Booking.Status.CONFIRMED))
    ).order_by('-confirmed_bookings', '-created_at')[:limit]

def get_recommendations(user, limit=5):
    """
    Main recommendation engine.
    Suggests upcoming published events to a user based on content-based filtering of their booked events.
    """
    today = timezone.now().date()
    
    # 1. Fetch user's confirmed bookings
    user_bookings = Booking.objects.filter(
        user=user,
        status=Booking.Status.CONFIRMED
    ).select_related('event')
    
    booked_events = [b.event for b in user_bookings]
    booked_event_ids = {e.id for e in booked_events}
    
    # 2. Retrieve upcoming published events that the user hasn't already booked
    candidates = Event.objects.filter(
        status=Event.Status.PUBLISHED,
        date__gte=today
    ).exclude(id__in=booked_event_ids)
    
    # Edge Case 1: User has booked all available upcoming events
    if not candidates.exists():
        return []
        
    # Edge Case 2: New user (no bookings) -> Fallback to popular upcoming events
    if not booked_events:
        popular_events = get_popular_upcoming_events(exclude_ids=booked_event_ids, limit=limit)
        return [(event, 0.0) for event in popular_events]
        
    try:
        # 3. Clean and prepare texts for vectorization
        booked_texts = [clean_and_combine(e) for e in booked_events]
        candidate_list = list(candidates)
        candidate_texts = [clean_and_combine(e) for e in candidate_list]
        
        # Build the complete corpus to fit the vectorizer
        corpus = booked_texts + candidate_texts
        
        # 4. TF-IDF Vectorization
        # Ignores standard english stop words ("the", "is", "and", etc.)
        vectorizer = TfidfVectorizer(stop_words='english')
        tfidf_matrix = vectorizer.fit_transform(corpus)
        
        # 5. Extract vector slices
        booked_vectors = tfidf_matrix[:len(booked_events)]
        candidate_vectors = tfidf_matrix[len(booked_events):]
        
        # 6. Compute Cosine Similarity between user's booked events and upcoming candidates
        # Result shape: (num_booked_events, num_candidate_events)
        similarity_matrix = cosine_similarity(booked_vectors, candidate_vectors)
        
        # 7. Aggregate similarity scores by taking the maximum similarity to any booked event
        # (Ideal for users with diverse interests)
        max_similarities = similarity_matrix.max(axis=0)
        
        # 8. Pair candidates with their similarity score and sort them
        recommendations = []
        for idx, candidate in enumerate(candidate_list):
            score = max_similarities[idx]
            recommendations.append((candidate, score))
            
        recommendations.sort(key=lambda x: x[1], reverse=True)
        
        # 9. Return top N recommendations
        return recommendations[:limit]
        
    except Exception as e:
        logger.error(f"Error generating recommendations: {str(e)}", exc_info=True)
        # Fallback to popular upcoming events in case of any processing/ML pipeline errors
        popular_events = get_popular_upcoming_events(exclude_ids=booked_event_ids, limit=limit)
        return [(event, 0.0) for event in popular_events]
