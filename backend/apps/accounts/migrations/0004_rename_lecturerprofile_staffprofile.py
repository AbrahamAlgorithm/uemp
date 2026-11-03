import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_profile_details"),
        # courses.0001 points its FK at lecturerprofile, so it has to run before the rename
        ("courses", "0001_initial"),
    ]

    operations = [
        migrations.RenameModel(old_name="LecturerProfile", new_name="StaffProfile"),
        migrations.RemoveField(model_name="staffprofile", name="rank"),
        migrations.RemoveField(model_name="staffprofile", name="office"),
        migrations.AlterField(
            model_name="staffprofile",
            name="user",
            field=models.OneToOneField(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="staff_profile",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
