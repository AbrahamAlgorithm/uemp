import pytest
from django.urls import reverse


@pytest.mark.django_db
def test_health_reports_api_and_database_ok(client):
    response = client.get(reverse("health"))

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


@pytest.mark.django_db
def test_health_accepts_the_development_server_host(client):
    response = client.get(reverse("health"), HTTP_HOST="0.0.0.0:8000")

    assert response.status_code == 200
