import pytest

from apps.audit.models import AuditLog
from apps.results.grading import NATIONAL_GRADE_SCALE, grade_for, is_default
from apps.results.models import GradeScale

pytestmark = pytest.mark.django_db

URL = "/api/grade-scale/"
NATIONAL = [{"grade": grade, "min": low, "max": high, "point": point} for low, high, grade, point in NATIONAL_GRADE_SCALE]
WIDER_A = [{**band, **{"A": {"min": 65}, "B": {"max": 64}}.get(band["grade"], {})} for band in NATIONAL]


def scale(**changes):
    """The national scale with some bands changed, e.g. scale(B={"min": 61})."""
    return [{**band, **changes.get(band["grade"], {})} for band in NATIONAL]


def put(api, bands, confirm=True):
    return api.put(URL, {"bands": bands, "confirm": confirm}, format="json")


def test_any_signed_in_user_reads_the_national_default(people, sign_in, api):
    sign_in("student@uemp.test")

    body = api.get(URL).json()

    assert body["is_default"] is True
    assert [(band["grade"], band["min"], band["max"], band["point"]) for band in body["bands"]] == [
        ("A", 70, 100, 5.00),
        ("B", 60, 69, 4.00),
        ("C", 50, 59, 3.00),
        ("D", 45, 49, 2.00),
        ("E", 40, 44, 1.00),
        ("F", 0, 39, 0.00),
    ]


@pytest.mark.parametrize("email", ["student@uemp.test", "lecturer@uemp.test", "admin.csc@uemp.test"])
def test_only_the_super_admin_changes_or_resets_the_scale(people, email, sign_in, api):
    sign_in(email)

    assert put(api, WIDER_A).status_code == 403
    assert api.post(f"{URL}reset/").status_code == 403
    assert is_default()


def test_a_change_has_to_be_confirmed(people, sign_in, api):
    sign_in("superadmin@uemp.test")

    unconfirmed = put(api, WIDER_A, confirm=False)

    assert unconfirmed.status_code == 400
    assert unconfirmed.json() == {"confirm": ["Changing the grading scale is not advisable. Confirm to continue."]}
    assert api.put(URL, {"bands": WIDER_A}, format="json").status_code == 400
    assert is_default()


@pytest.mark.parametrize(
    "bands, problem",
    [
        (scale(B={"min": 61}), "No band covers 60, between C and B."),
        (scale(B={"min": 62}), "No band covers 60-61, between C and B."),
        (scale(B={"min": 58}), "C and B overlap."),
        (scale(A={"max": 99}), "The highest band must end at 100."),
        (scale(F={"min": 1}), "The lowest band must start at 0."),
        (scale(E={"grade": "D"}), "Each grade can only be used once."),
        (scale(F={"grade": "X"}), "The band that starts at 0 must be F, the grade for a failed course."),
    ],
)
def test_gaps_overlaps_and_duplicates_are_refused(people, bands, problem, sign_in, api):
    sign_in("superadmin@uemp.test")

    response = put(api, bands)

    assert response.status_code == 400
    assert problem in response.json()["bands"]
    assert is_default()


def test_points_must_be_between_0_and_5(people, sign_in, api):
    sign_in("superadmin@uemp.test")

    assert put(api, scale(A={"point": 6})).status_code == 400
    assert put(api, scale(F={"point": -1})).status_code == 400


def test_a_confirmed_change_replaces_every_band_and_is_audited(people, sign_in, api):
    sign_in("superadmin@uemp.test")

    response = put(api, WIDER_A)

    assert response.status_code == 200
    assert response.json()["is_default"] is False
    assert response.json()["bands"][0] == {"grade": "A", "min": 65, "max": 100, "point": 5.00}
    assert GradeScale.objects.count() == 6 and grade_for(66).grade == "A"
    row = AuditLog.objects.get(action="GRADE_SCALE_UPDATED")
    assert (row.entity_type, row.entity_id, row.actor_email) == ("results.gradescale", "", "superadmin@uemp.test")
    assert row.before["bands"][0] == {"grade": "A", "min": 70, "max": 100, "point": 5.0}
    assert row.after["bands"][0] == {"grade": "A", "min": 65, "max": 100, "point": 5.0}


def test_reset_restores_the_national_scale(people, sign_in, api):
    sign_in("superadmin@uemp.test")
    put(api, WIDER_A)

    response = api.post(f"{URL}reset/")

    assert response.status_code == 200
    assert response.json()["is_default"] is True
    assert grade_for(66).grade == "B"
    row = AuditLog.objects.get(action="GRADE_SCALE_RESET")
    assert row.before["bands"][0]["min"] == 65 and row.after["bands"][0]["min"] == 70


def test_is_default_follows_the_bands_not_how_they_got_there(people, sign_in, api):
    sign_in("superadmin@uemp.test")

    assert put(api, WIDER_A).json()["is_default"] is False
    assert put(api, NATIONAL).json()["is_default"] is True
    assert api.get(URL).json()["is_default"] is True
