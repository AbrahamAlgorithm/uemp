import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    # separate from 0002: postgres won't alter a column while that migration's FK checks are pending
    dependencies = [
        ('registrations', '0002_semester_registration'),
    ]

    operations = [
        migrations.AlterField(
            model_name='courseregistration',
            name='semester_registration',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='course_registrations', to='registrations.semesterregistration'),
        ),
    ]
