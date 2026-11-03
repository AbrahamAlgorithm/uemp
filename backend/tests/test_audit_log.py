from datetime import datetime, timezone

import pytest

from apps.audit.models import AuditLog

pytestmark = pytest.mark.django_db


def log(actor=None, action="UPDATE", entity_type="courses.course", department=None, day=None, **fields):
    entry = AuditLog.objects.create(
        actor=actor, actor_email=getattr(actor, "email", ""), action=action, entity_type=entity_type, entity_id="1",
        department=department, **fields,
    )
    if day:
        AuditLog.objects.filter(pk=entry.pk).update(created_at=datetime.fromisoformat(day).replace(tzinfo=timezone.utc))
    return entry


@pytest.fixture
def entries(people, csc, mth):
    lecturer, admin = people["LECTURER"], people["DEPT_ADMIN"]
    return {
        "login": log(lecturer, "LOGIN", "accounts.user", csc, "2026-10-01"),
        "update": log(admin, "UPDATE", "courses.course", csc, "2026-10-10", before={"units": 2}, after={"units": 3}),
        "approve": log(admin, "RESULTS_APPROVED", "results.resultsheet", mth, "2026-10-20"),
    }


def ids(response):
    return {row["id"] for row in response.json()["results"]}


def test_super_admin_reads_the_log_newest_first(entries, sign_in, api):
    sign_in("superadmin@uemp.test")

    body = api.get("/api/audit-log/").json()

    assert body["count"] >= 3
    stamps = [row["at"] for row in body["results"]]
    assert stamps == sorted(stamps, reverse=True)
    row = next(row for row in body["results"] if row["id"] == entries["update"].pk)
    assert row["actor"]["email"] == "admin.csc@uemp.test"
    assert row["actor"]["role"] == "DEPT_ADMIN"
    assert row["department"]["code"] == "CSC"
    assert "before" not in row


@pytest.mark.parametrize("email", ["admin.csc@uemp.test", "lecturer@uemp.test", "student@uemp.test"])
def test_only_super_admins_can_read_the_log(entries, email, sign_in, api):
    sign_in(email)

    assert api.get("/api/audit-log/").status_code == 403
    assert api.get(f"/api/audit-log/{entries['update'].pk}/").status_code == 403
    assert api.get("/api/audit-log/filters/").status_code == 403


@pytest.mark.parametrize(
    "query, expected",
    [
        ("action=LOGIN", {"login"}),
        ("entity_type=results.resultsheet", {"approve"}),
        ("date_from=2026-10-10", {"update", "approve"}),
        ("date_to=2026-10-10", {"login", "update"}),
        ("date_from=2026-10-02&date_to=2026-10-19", {"update"}),
    ],
)
def test_filters_narrow_the_log(entries, query, expected, sign_in, api):
    sign_in("superadmin@uemp.test")

    found = ids(api.get(f"/api/audit-log/?{query}"))

    assert {entries[name].pk for name in expected} <= found
    assert not {entries[name].pk for name in entries if name not in expected} & found


def test_actor_and_department_filters(entries, people, csc, mth, sign_in, api):
    sign_in("superadmin@uemp.test")
    admin = people["DEPT_ADMIN"]

    by_actor = ids(api.get(f"/api/audit-log/?actor={admin.pk}"))
    assert by_actor == {entries["update"].pk, entries["approve"].pk}
    by_department = ids(api.get(f"/api/audit-log/?department={mth.pk}"))
    assert by_department == {entries["approve"].pk}


def test_bad_filter_values_are_refused(entries, sign_in, api):
    sign_in("superadmin@uemp.test")

    assert api.get("/api/audit-log/?date_from=yesterday").status_code == 400
    assert api.get("/api/audit-log/?actor=abc").status_code == 400


def test_detail_includes_before_and_after(entries, sign_in, api):
    sign_in("superadmin@uemp.test")

    body = api.get(f"/api/audit-log/{entries['update'].pk}/").json()

    assert (body["before"], body["after"]) == ({"units": 2}, {"units": 3})
    assert api.get("/api/audit-log/999999/").status_code == 404


def test_filter_options_list_what_is_in_the_log(entries, sign_in, api):
    sign_in("superadmin@uemp.test")

    body = api.get("/api/audit-log/filters/").json()

    assert {"LOGIN", "RESULTS_APPROVED", "UPDATE"} <= set(body["actions"])
    assert "results.resultsheet" in body["entity_types"]
    assert "Ada Obi" in {actor["name"] for actor in body["actors"]}


def test_the_log_page_uses_a_bounded_number_of_queries(entries, sign_in, api, django_assert_max_num_queries):
    sign_in("superadmin@uemp.test")

    with django_assert_max_num_queries(6):
        api.get("/api/audit-log/")
