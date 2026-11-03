from rest_framework import serializers

from .models import GradeScale


class GradeScaleSerializer(serializers.ModelSerializer):
    min = serializers.IntegerField(source="min_score")
    max = serializers.IntegerField(source="max_score")

    class Meta:
        model = GradeScale
        fields = ["id", "grade", "min", "max", "point"]
