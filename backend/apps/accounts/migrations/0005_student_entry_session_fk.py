import django.db.models.deletion
from django.db import migrations, models


def link_sessions(apps, schema_editor):
    StudentProfile = apps.get_model("accounts", "StudentProfile")
    AcademicSession = apps.get_model("academics", "AcademicSession")
    for profile in StudentProfile.objects.exclude(entry_session_name=""):
        profile.entry_session, _ = AcademicSession.objects.get_or_create(name=profile.entry_session_name)
        profile.save(update_fields=["entry_session"])


def unlink_sessions(apps, schema_editor):
    StudentProfile = apps.get_model("accounts", "StudentProfile")
    for profile in StudentProfile.objects.exclude(entry_session=None).select_related("entry_session"):
        profile.entry_session_name = profile.entry_session.name
        profile.save(update_fields=["entry_session_name"])


class Migration(migrations.Migration):

    dependencies = [
        ("academics", "0002_program_award_and_session_dates"),
        ("accounts", "0004_rename_lecturerprofile_staffprofile"),
    ]

    operations = [
        migrations.RenameField(model_name="studentprofile", old_name="entry_session", new_name="entry_session_name"),
        migrations.AddField(
            model_name="studentprofile",
            name="entry_session",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="entrants",
                to="academics.academicsession",
            ),
        ),
        migrations.RunPython(link_sessions, unlink_sessions),
    ]
