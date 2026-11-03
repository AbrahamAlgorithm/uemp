import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def create_forms(apps, schema_editor):
    CourseRegistration = apps.get_model("registrations", "CourseRegistration")
    SemesterRegistration = apps.get_model("registrations", "SemesterRegistration")
    for registration in CourseRegistration.objects.select_related("offering").order_by("created_at"):
        # these predate the review step, so they count as accepted and keep their place on result sheets
        form, _ = SemesterRegistration.objects.get_or_create(
            student_id=registration.student_id,
            semester_id=registration.offering.semester_id,
            defaults={"status": "VALIDATED", "submitted_at": registration.created_at},
        )
        registration.semester_registration = form
        registration.save(update_fields=["semester_registration"])


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0003_semester_registration_open'),
        ('accounts', '0006_remove_studentprofile_entry_session_name'),
        ('registrations', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='SemesterRegistration',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('status', models.CharField(choices=[('SUBMITTED', 'Submitted'), ('VALIDATED', 'Validated'), ('RETURNED', 'Returned')], db_index=True, default='SUBMITTED', max_length=20)),
                ('submitted_at', models.DateTimeField()),
                ('validated_at', models.DateTimeField(blank=True, null=True)),
                ('return_reason', models.TextField(blank=True)),
                ('semester', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='registration_forms', to='academics.semester')),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='registration_forms', to='accounts.studentprofile')),
                ('validated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='validated_registrations', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddField(
            model_name='courseregistration',
            name='semester_registration',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.PROTECT, related_name='course_registrations', to='registrations.semesterregistration'),
        ),
        migrations.AddConstraint(
            model_name='semesterregistration',
            constraint=models.UniqueConstraint(fields=('student', 'semester'), name='semester_registration_unique'),
        ),
        migrations.RunPython(create_forms, migrations.RunPython.noop),
    ]
