from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.courses.models import CourseOffering

from .models import ResultSheet


@receiver(post_save, sender=CourseOffering)
def create_result_sheet(sender, instance, created, raw=False, **kwargs):
    # raw saves come from loaddata, where the fixture carries its own sheets
    if created and not raw:
        ResultSheet.objects.create(offering=instance)
