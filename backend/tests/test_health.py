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


def test_the_root_lists_where_the_api_documentation_lives(client):
    for path in ("/", "/api/"):
        response = client.get(path)

        assert response.status_code == 200
        body = response.json()
        assert body["service"] == "UEMP API"
        assert {"/api/docs/", "/api/schema/", "/api/health/", "/api/auth/login/"} <= {e["path"] for e in body["endpoints"]}
        assert body["endpoints"][0]["url"].endswith("/api/docs/")


def test_a_browser_gets_a_readable_page_with_links(client):
    response = client.get("/", HTTP_ACCEPT="text/html,application/xhtml+xml")

    assert response.status_code == 200
    page = response.content.decode()
    assert '<a href="/api/docs/">' in page and "UEMP API" in page
    assert '<a href="/api/auth/login/">' not in page


def test_the_root_needs_no_sign_in_and_only_answers_get(client):
    assert client.post("/").status_code == 405
