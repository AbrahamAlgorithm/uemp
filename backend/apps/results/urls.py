from django.urls import path

from .views import GradeScaleView

urlpatterns = [
    path("grade-scale/", GradeScaleView.as_view(), name="grade-scale"),
]
