import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.accounts.models import User

pytestmark = pytest.mark.django_db


@pytest.fixture
def ops_env(monkeypatch):
    monkeypatch.setenv("OPS_ADMIN_EMAIL", "Ops@Example.org")
    monkeypatch.setenv("OPS_ADMIN_PASSWORD", "A-long-private-pass-2026")


def test_creates_a_private_superuser_with_a_staff_profile(ops_env):
    call_command("create_ops_admin")

    user = User.objects.get(email="ops@example.org")
    assert user.is_superuser and user.is_staff
    assert user.role == User.Role.SUPER_ADMIN and user.department is None
    assert user.staff_profile.staff_id
    assert user.check_password("A-long-private-pass-2026")


def test_running_again_updates_the_same_account(ops_env, monkeypatch):
    call_command("create_ops_admin")
    monkeypatch.setenv("OPS_ADMIN_PASSWORD", "Another-long-pass-2027")

    call_command("create_ops_admin")

    assert User.objects.filter(email="ops@example.org").count() == 1
    assert User.objects.get(email="ops@example.org").check_password("Another-long-pass-2027")


@pytest.mark.parametrize(
    ("email", "password"),
    [("", "A-long-private-pass-2026"), ("ops@example.org", ""), ("ops@uemp.test", "A-long-private-pass-2026"), ("ops@example.org", "short")],
)
def test_refuses_missing_demo_or_weak_settings(monkeypatch, email, password):
    monkeypatch.setenv("OPS_ADMIN_EMAIL", email)
    monkeypatch.setenv("OPS_ADMIN_PASSWORD", password)

    with pytest.raises(CommandError):
        call_command("create_ops_admin")

    assert not User.objects.filter(is_superuser=True).exists()
