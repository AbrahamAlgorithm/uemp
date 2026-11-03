import os

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import StaffProfile, User

DEFAULT_STAFF_ID = "CVU/OPS/001"
DEMO_DOMAIN = "@uemp.test"


class Command(BaseCommand):
    help = "Create or update the private Django admin account from OPS_ADMIN_EMAIL and OPS_ADMIN_PASSWORD."

    @transaction.atomic
    def handle(self, *args, **options):
        email = os.environ.get("OPS_ADMIN_EMAIL", "").strip().lower()
        password = os.environ.get("OPS_ADMIN_PASSWORD", "")
        if not email or not password:
            raise CommandError("Set OPS_ADMIN_EMAIL and OPS_ADMIN_PASSWORD.")
        # seed_demo resets and deletes the demo domain, which would undo or remove this account
        if email.endswith(DEMO_DOMAIN):
            raise CommandError(f"Use an address outside {DEMO_DOMAIN}.")

        user = User.objects.filter(email__iexact=email).first() or User(email=email)
        try:
            validate_password(password, user)
        except ValidationError as error:
            raise CommandError(" ".join(error.messages)) from error

        created = user.pk is None
        user.role = User.Role.SUPER_ADMIN
        user.department = None
        user.status = User.Status.ACTIVE
        user.is_active = True
        user.is_staff = True
        user.is_superuser = True
        user.set_password(password)
        user.save()
        StaffProfile.objects.get_or_create(
            user=user, defaults={"staff_id": os.environ.get("OPS_ADMIN_STAFF_ID", DEFAULT_STAFF_ID)}
        )
        self.stdout.write(self.style.SUCCESS(f"{'Created' if created else 'Updated'} the ops admin account."))
