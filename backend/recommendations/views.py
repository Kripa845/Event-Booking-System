from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from events.serializers import EventSerializer
from .services import get_recommendations

class RecommendationView(APIView):
    """
    API view to fetch personalized event recommendations for the authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        limit = request.query_params.get("limit", 5)
        try:
            limit = int(limit)
        except ValueError:
            limit = 5
            
        # Get recommended events (list of tuples: (event, similarity_score))
        recs = get_recommendations(request.user, limit=limit)
        
        # Serialize the event objects and inject the similarity scores
        serialized_data = []
        for event, score in recs:
            # We pass request context to serializer for absolute media/banner URLs
            event_data = EventSerializer(event, context={'request': request}).data
            event_data['similarity'] = round(float(score), 2)
            serialized_data.append(event_data)
            
        return Response({"recommendations": serialized_data})
