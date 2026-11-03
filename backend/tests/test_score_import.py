import csv
import io
from decimal import Decimal

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from openpyxl import Workbook, load_workbook

from apps.audit.models import AuditLog
from apps.results.models import ResultEntry, ResultSheet

pytestmark = pytest.mark.django_db

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def url(offering, suffix):
    return f"/api/lecturer/offerings/{offering.pk}/sheet/{suffix}"


def csv_file(*rows, header=("matric_no", "name", "ca", "exam")):
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(header)
    writer.writerows(rows)
    return buffer.getvalue().encode()


def upload(api, offering, content, name="scores.csv", dry_run=True):
    file = SimpleUploadedFile(name, content, content_type=XLSX if name.endswith(".xlsx") else "text/csv")
    return api.post(url(offering, "import/"), {"file": file, "dry_run": dry_run}, format="multipart")


def scores_of(registration):
    entry = ResultEntry.objects.filter(registration=registration).first()
    return (entry.ca_score, entry.exam_score) if entry else None


def scored(registration, ca=None, exam=None):
    return ResultEntry.objects.create(registration=registration, ca_score=ca, exam_score=exam)


@pytest.fixture
def lecturer(mth301, sign_in):
    sign_in("lecturer.mth@uemp.test")


def test_xlsx_template_holds_the_class_list_with_saved_scores(mth301, lecturer, api):
    scored(mth301["csc"], ca=Decimal("30.5"))

    response = api.get(url(mth301["offering"], "template/"))

    assert response.status_code == 200
    assert response["Content-Type"] == XLSX
    assert response["Content-Disposition"] == 'attachment; filename="MTH301_2026-2027_First_scores.xlsx"'
    rows = list(load_workbook(io.BytesIO(response.content)).active.iter_rows(values_only=True))
    assert rows == [
        ("matric_no", "name", "ca", "exam"),
        ("CSC/2024/0001", "Ada Obi", 30.5, None),
        ("MTH/2024/0002", "Ada Obi", None, None),
    ]


def test_csv_template_holds_the_class_list(mth301, lecturer, api):
    scored(mth301["mth"], ca=Decimal(20), exam=Decimal(41))

    response = api.get(url(mth301["offering"], "template/?format=csv"))

    assert response["Content-Disposition"] == 'attachment; filename="MTH301_2026-2027_First_scores.csv"'
    assert list(csv.reader(io.StringIO(response.content.decode("utf-8-sig")))) == [
        ["matric_no", "name", "ca", "exam"],
        ["CSC/2024/0001", "Ada Obi", "", ""],
        ["MTH/2024/0002", "Ada Obi", "20", "41"],
    ]
    assert api.get(url(mth301["offering"], "template/?format=pdf")).status_code == 400


def test_a_dry_run_reports_without_writing(mth301, lecturer, api):
    response = upload(api, mth301["offering"], csv_file(["CSC/2024/0001", "", "30", "45"], ["mth/2024/0002", "", "20", ""]))

    assert response.status_code == 200
    body = response.json()
    assert body["summary"] == {"rows": 2, "will_change": 2, "unchanged": 0, "errors": 0}
    assert body["rows"][1] == {
        "row_number": 3,
        "matric_no": "MTH/2024/0002",
        "name": "Ada Obi",
        "status": "change",
        "ca_before": None,
        "ca_after": "20.00",
        "exam_before": None,
        "exam_after": None,
        "error": None,
    }
    assert not ResultEntry.objects.exists()
    assert not AuditLog.objects.filter(entity_type="results.resultsheet").exists()


def test_a_valid_file_applies_every_change_and_audits_once(mth301, lecturer, api):
    scored(mth301["csc"], ca=Decimal(30), exam=Decimal(40))
    scored(mth301["mth"], ca=Decimal(10))
    content = csv_file(["CSC/2024/0001", "", "30", "40"], ["MTH/2024/0002", "", "20", "35.5"])

    response = upload(api, mth301["offering"], content, dry_run=False)

    assert response.status_code == 200
    assert response.json()["summary"] == {"rows": 2, "will_change": 1, "unchanged": 1, "errors": 0}
    assert scores_of(mth301["mth"]) == (Decimal(20), Decimal("35.5"))
    rows = AuditLog.objects.filter(entity_type="results.resultsheet")
    assert [row.action for row in rows] == ["RESULTS_IMPORTED"]
    assert rows[0].after["file"] == "scores.csv"
    assert rows[0].after["changes"] == [
        {"matric_no": "MTH/2024/0002", "field": "ca_score", "before": 10.0, "after": 20.0},
        {"matric_no": "MTH/2024/0002", "field": "exam_score", "before": None, "after": 35.5},
    ]


def test_one_bad_row_blocks_the_whole_file(mth301, lecturer, api):
    content = csv_file(["CSC/2024/0001", "", "30", "45"], ["MTH/2024/0002", "", "20", "61"])

    response = upload(api, mth301["offering"], content, dry_run=False)

    assert response.status_code == 400
    body = response.json()
    assert body["summary"]["errors"] == 1
    assert (body["rows"][1]["row_number"], body["rows"][1]["status"], body["rows"][1]["error"]) == (
        3,
        "error",
        "Exam must be between 0 and 60.",
    )
    assert not ResultEntry.objects.exists()


def test_blank_cells_clear_scores_and_students_left_out_are_untouched(mth301, lecturer, api):
    scored(mth301["csc"], ca=Decimal(30), exam=Decimal(40))
    scored(mth301["mth"], ca=Decimal(10), exam=Decimal(20))

    response = upload(api, mth301["offering"], csv_file(["CSC/2024/0001", "", "25", ""]), dry_run=False)

    assert response.status_code == 200
    assert scores_of(mth301["csc"]) == (Decimal(25), None)
    assert scores_of(mth301["mth"]) == (Decimal(10), Decimal(20))


def test_students_off_the_class_list_and_repeated_rows_are_errors(mth301, lecturer, api):
    content = csv_file(
        ["CSC/2024/0003", "", "20", "30"],
        ["XYZ/2024/9999", "", "20", "30"],
        ["CSC/2024/0001", "", "20", "30"],
        ["csc/2024/0001", "", "21", "30"],
        ["", "", "20", "30"],
    )

    body = upload(api, mth301["offering"], content).json()

    assert [(row["row_number"], row["status"], row["error"]) for row in body["rows"]] == [
        (2, "error", "CSC/2024/0003 isn't on the class list."),
        (3, "error", "XYZ/2024/9999 isn't on the class list."),
        (4, "change", None),
        (5, "error", "CSC/2024/0001 is already on row 4."),
        (6, "error", "The matric number is missing."),
    ]


@pytest.mark.parametrize(
    "ca, exam, error",
    [
        ("abc", "30", "CA must be a number."),
        ("40.5", "30", "CA must be between 0 and 40."),
        ("-1", "30", "CA must be between 0 and 40."),
        ("20.125", "30", "CA can have at most 2 decimal places."),
        ("20", "sixty", "Exam must be a number."),
    ],
)
def test_scores_must_be_numbers_in_range(mth301, lecturer, ca, exam, error, api):
    body = upload(api, mth301["offering"], csv_file(["CSC/2024/0001", "", ca, exam])).json()

    assert body["rows"][0]["error"] == error


def test_headers_ignore_case_and_name_is_optional(mth301, lecturer, api):
    content = csv_file(["CSC/2024/0001", "30", "45"], header=("Matric_No", "CA", "EXAM"))

    assert upload(api, mth301["offering"], content).json()["summary"]["will_change"] == 1

    missing = upload(api, mth301["offering"], csv_file(["CSC/2024/0001", "30"], header=("matric_no", "ca")))
    assert missing.status_code == 400
    assert missing.json() == {"file": "The first row needs matric_no, ca and exam columns. Missing: exam."}


def test_an_edited_xlsx_template_imports(mth301, lecturer, api):
    workbook = load_workbook(io.BytesIO(api.get(url(mth301["offering"], "template/")).content))
    workbook.active["C2"], workbook.active["D2"] = 28, 41.5
    buffer = io.BytesIO()
    workbook.save(buffer)

    response = upload(api, mth301["offering"], buffer.getvalue(), name="MTH301_scores.xlsx", dry_run=False)

    assert response.json()["summary"] == {"rows": 2, "will_change": 1, "unchanged": 1, "errors": 0}
    assert scores_of(mth301["csc"]) == (Decimal(28), Decimal("41.5"))


@pytest.mark.parametrize("status", [ResultSheet.Status.SUBMITTED, ResultSheet.Status.APPROVED])
def test_a_locked_sheet_refuses_imports(mth301, lecturer, status, api):
    ResultSheet.objects.filter(pk=mth301["sheet"].pk).update(status=status)

    response = upload(api, mth301["offering"], csv_file(["CSC/2024/0001", "", "30", "45"]))

    assert response.status_code == 409


def test_another_lecturer_cannot_reach_the_template_or_import(mth301, sign_in, api):
    sign_in("lecturer@uemp.test")

    assert api.get(url(mth301["offering"], "template/")).status_code == 404
    assert upload(api, mth301["offering"], csv_file(["CSC/2024/0001", "", "30", "45"])).status_code == 404


def test_other_file_types_and_files_over_1_mb_are_refused(mth301, lecturer, api):
    wrong_type = upload(api, mth301["offering"], b"matric_no,ca,exam\n", name="scores.txt")
    too_big = upload(api, mth301["offering"], b"x" * (1024 * 1024 + 1))
    not_a_workbook = upload(api, mth301["offering"], b"matric_no,ca,exam\n", name="scores.xlsx")

    assert wrong_type.status_code == too_big.status_code == not_a_workbook.status_code == 400
    assert wrong_type.json() == {"file": "Upload an .xlsx or .csv file."}
    assert too_big.json() == {"file": "The file is larger than 1 MB."}
    assert not_a_workbook.json() == {"file": "This file couldn't be opened as an Excel workbook."}


def test_a_workbook_with_too_many_rows_is_refused(mth301, lecturer, api):
    workbook = Workbook()
    workbook.active.append(("matric_no", "ca", "exam"))
    for _ in range(5001):
        workbook.active.append(("CSC/2024/0001", 1, 1))
    buffer = io.BytesIO()
    workbook.save(buffer)

    response = upload(api, mth301["offering"], buffer.getvalue(), name="big.xlsx")

    assert response.json() == {"file": "The file has more than 5000 rows."}
