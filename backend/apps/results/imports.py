import csv
import io
from decimal import Decimal, InvalidOperation
from pathlib import PurePath
from zipfile import BadZipFile

from django.db import transaction
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font
from openpyxl.utils.exceptions import InvalidFileException
from rest_framework.exceptions import ValidationError

from core.exceptions import Conflict

from .services import LOCKED, class_registrations, is_editable, lock_sheet, save_scores

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
CONTENT_TYPES = {"xlsx": XLSX, "csv": "text/csv; charset=utf-8"}
COLUMNS = ("matric_no", "name", "ca", "exam")
REQUIRED = ("matric_no", "ca", "exam")
MAX_BYTES = 1024 * 1024
# a class list never gets near this; it stops a tiny compressed workbook expanding into millions of rows
MAX_ROWS = 5000
LIMITS = {"ca": 40, "exam": 60}
LABELS = {"ca": "CA", "exam": "Exam"}


def class_rows(offering):
    return (
        class_registrations(offering.pk)
        .select_related("student__user", "result")
        .order_by("student__matric_no")
    )


def mark(value):
    if value is None:
        return None
    return int(value) if value == value.to_integral_value() else float(value)


def template_name(offering, extension):
    semester = offering.semester
    session = semester.session.name.replace("/", "-")
    return f"{offering.course.code.replace(' ', '')}_{session}_{semester.term.title()}_scores.{extension}"


def template(offering, extension):
    """The class list as a file to fill in, with any scores already saved."""
    rows = []
    for registration in class_rows(offering):
        entry = getattr(registration, "result", None)
        rows.append(
            (
                registration.student.matric_no,
                registration.student.user.get_full_name(),
                mark(entry.ca_score) if entry else None,
                mark(entry.exam_score) if entry else None,
            )
        )
    if extension == "csv":
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(COLUMNS)
        writer.writerows(["" if value is None else value for value in row] for row in rows)
        # the bom tells excel the file is utf-8, so names with accents survive
        return buffer.getvalue().encode("utf-8-sig")

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Scores"
    sheet.append(COLUMNS)
    for cell in sheet[1]:
        cell.font = Font(bold=True)
    for row in rows:
        sheet.append(row)
    sheet.freeze_panes = "A2"
    for column, width in zip("ABCD", (18, 32, 8, 8)):
        sheet.column_dimensions[column].width = width
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def file_error(message):
    return ValidationError({"file": message})


def read_xlsx(upload):
    try:
        workbook = load_workbook(upload, read_only=True, data_only=True)
    except (BadZipFile, InvalidFileException, KeyError, OSError, ValueError) as error:
        raise file_error("This file couldn't be opened as an Excel workbook.") from error
    try:
        rows = workbook.worksheets[0].iter_rows(values_only=True)
        return [list(row) for _, row in zip(range(MAX_ROWS + 2), rows)]
    finally:
        workbook.close()


def read_csv(upload):
    try:
        text = upload.read().decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise file_error("Save the CSV with UTF-8 encoding and try again.") from error
    return list(csv.reader(io.StringIO(text)))


def blank(value):
    return value is None or (isinstance(value, str) and not value.strip())


def read_rows(upload):
    """(row number, {column: cell}) for each data row of an uploaded .xlsx or .csv file."""
    extension = PurePath(upload.name).suffix.lower()
    if extension not in (".xlsx", ".csv"):
        raise file_error("Upload an .xlsx or .csv file.")
    if upload.size > MAX_BYTES:
        raise file_error("The file is larger than 1 MB.")
    table = read_xlsx(upload) if extension == ".xlsx" else read_csv(upload)
    if len(table) > MAX_ROWS + 1:
        raise file_error(f"The file has more than {MAX_ROWS} rows.")

    header = [str(cell).strip().lower() if cell is not None else "" for cell in (table[0] if table else [])]
    missing = [column for column in REQUIRED if column not in header]
    if missing:
        raise file_error(f"The first row needs matric_no, ca and exam columns. Missing: {', '.join(missing)}.")
    positions = {column: header.index(column) for column in REQUIRED}
    rows = []
    for number, row in enumerate(table[1:], start=2):
        cells = {column: row[index] if index < len(row) else None for column, index in positions.items()}
        if not all(blank(cell) for cell in cells.values()):
            rows.append((number, cells))
    return rows


def parse_score(cell, kind):
    """(score, error) for one cell; a blank cell clears the score."""
    if blank(cell):
        return None, None
    label, limit = LABELS[kind], LIMITS[kind]
    if isinstance(cell, bool):
        return None, f"{label} must be a number."
    try:
        score = Decimal(str(cell).strip())
    except InvalidOperation:
        return None, f"{label} must be a number."
    if not score.is_finite():
        return None, f"{label} must be a number."
    if not 0 <= score <= limit:
        return None, f"{label} must be between 0 and {limit}."
    if score != score.quantize(Decimal("0.01")):
        return None, f"{label} can have at most 2 decimal places."
    return score, None


def preview(offering, rows):
    """The report for an import and the score rows it would save."""
    on_list = {registration.student.matric_no.upper(): registration for registration in class_rows(offering)}
    first_seen, lines, updates = {}, [], []
    for number, cells in rows:
        matric_no = "" if blank(cells["matric_no"]) else str(cells["matric_no"]).strip().upper()
        registration = on_list.get(matric_no)
        entry = getattr(registration, "result", None) if registration else None
        ca, ca_error = parse_score(cells["ca"], "ca")
        exam, exam_error = parse_score(cells["exam"], "exam")

        errors = []
        if not matric_no:
            errors.append("The matric number is missing.")
        elif registration is None:
            errors.append(f"{matric_no} isn't on the class list.")
        elif matric_no in first_seen:
            errors.append(f"{matric_no} is already on row {first_seen[matric_no]}.")
        else:
            first_seen[matric_no] = number
        errors += [error for error in (ca_error, exam_error) if error]

        before = (entry.ca_score, entry.exam_score) if entry else (None, None)
        if errors:
            status = "error"
        elif (ca, exam) == before:
            status = "unchanged"
        else:
            status = "change"
            updates.append({"registration_id": registration.pk, "ca_score": ca, "exam_score": exam})
        lines.append(
            {
                "row_number": number,
                "matric_no": matric_no,
                "name": registration.student.user.get_full_name() if registration else None,
                "status": status,
                "ca_before": before[0],
                "ca_after": ca,
                "exam_before": before[1],
                "exam_after": exam,
                "error": " ".join(errors) or None,
            }
        )

    summary = {
        "rows": len(lines),
        "will_change": sum(line["status"] == "change" for line in lines),
        "unchanged": sum(line["status"] == "unchanged" for line in lines),
        "errors": sum(line["status"] == "error" for line in lines),
    }
    return {"summary": summary, "rows": lines}, updates


@transaction.atomic
def import_scores(sheet, upload, actor, dry_run=True, request=None):
    """Check an uploaded score file and, unless it's a dry run or any row is wrong, save every change."""
    sheet = lock_sheet(sheet)
    if not is_editable(sheet):
        raise Conflict(LOCKED[sheet.status])
    report, updates = preview(sheet.offering, read_rows(upload))
    if not dry_run and not report["summary"]["errors"]:
        save_scores(sheet, updates, actor, request, source=upload.name)
    return report
