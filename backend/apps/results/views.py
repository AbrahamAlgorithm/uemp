from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import GradeScale
from .serializers import GradeScaleSerializer


class GradeScaleView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(GradeScaleSerializer(GradeScale.objects.order_by("-min_score"), many=True).data)
