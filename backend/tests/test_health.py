import pytest
from django.urls import reverse


@pytest.mark.django_db
def test_health_reports_api_and_database_ok(client):
    response = client.get(reverse("health"))

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}
