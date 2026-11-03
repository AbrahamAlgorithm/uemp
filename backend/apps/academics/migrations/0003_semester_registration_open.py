from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0002_program_award_and_session_dates'),
    ]

    operations = [
        migrations.AddField(
            model_name='semester',
            name='registration_open',
            field=models.BooleanField(default=False),
        ),
    ]
