from django.db import migrations

from apps.results.grading import NATIONAL_GRADE_SCALE


def add_national_scale(apps, schema_editor):
    GradeScale = apps.get_model("results", "GradeScale")
    # a database that already has a scale keeps it
    if not GradeScale.objects.exists():
        GradeScale.objects.bulk_create(
            GradeScale(min_score=low, max_score=high, grade=grade, point=point)
            for low, high, grade, point in NATIONAL_GRADE_SCALE
        )


class Migration(migrations.Migration):

    dependencies = [
        ("results", "0002_partial_scores"),
    ]

    operations = [
        migrations.RunPython(add_national_scale, migrations.RunPython.noop),
    ]
