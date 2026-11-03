from django.db import migrations


class Migration(migrations.Migration):

    # separate from 0005: postgres won't drop a column while that migration's FK checks are pending
    dependencies = [
        ("accounts", "0005_student_entry_session_fk"),
    ]

    operations = [
        migrations.RemoveField(model_name="studentprofile", name="entry_session_name"),
    ]
