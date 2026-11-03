from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Count, DecimalField, ExpressionWrapper, F, Q, Sum

from apps.registrations.models import SemesterRegistration
from core.exceptions import Conflict

from .models import GradeScale, ResultEntry, ResultSheet

FAIL = "F"
TWO_PLACES = Decimal("0.01")
AT_RISK_CGPA = Decimal("1.50")

# the nigerian 5-point scale as (lowest mark, highest mark, grade, point)
NATIONAL_GRADE_SCALE = [
    (70, 100, "A", 5),
    (60, 69, "B", 4),
    (50, 59, "C", 3),
    (45, 49, "D", 2),
    (40, 44, "E", 1),
    (0, 39, "F", 0),
]


def national_bands():
    return [{"min": low, "max": high, "grade": grade, "point": Decimal(point)} for low, high, grade, point in NATIONAL_GRADE_SCALE]


def active_bands():
    return [
        {"min": band.min_score, "max": band.max_score, "grade": band.grade, "point": band.point}
        for band in GradeScale.objects.order_by("-min_score")
    ]


def is_default(bands=None):
    bands = active_bands() if bands is None else bands
    return sorted(tuple(band.values()) for band in bands) == sorted(tuple(band.values()) for band in national_bands())


def replace_scale(bands):
    GradeScale.objects.all().delete()
    GradeScale.objects.bulk_create(
        GradeScale(min_score=band["min"], max_score=band["max"], grade=band["grade"], point=band["point"]) for band in bands
    )


def recorded_total(entry):
    return (entry.ca_score or 0) + (entry.exam_score or 0)


def grade_for(total, scale=None):
    """The grade scale band a total falls in."""
    scale = GradeScale.objects.order_by("-min_score") if scale is None else scale
    # bands are whole marks, so a total of 69.5 belongs with 70
    mark = Decimal(total).quantize(Decimal(1), rounding=ROUND_HALF_UP)
    for band in scale:
        if band.min_score <= mark <= band.max_score:
            return band
    raise Conflict(f"The grade scale has no grade for a total of {mark}.")


def approved_entries():
    return ResultEntry.objects.filter(
        registration__offering__result_sheet__status=ResultSheet.Status.APPROVED,
        registration__semester_registration__status=SemesterRegistration.Status.VALIDATED,
    )


def point_average(entries):
    units = F("registration__offering__course__units")
    totals = entries.aggregate(
        points=Sum(ExpressionWrapper(units * F("grade_point"), output_field=DecimalField(max_digits=8, decimal_places=2))),
        units=Sum(units),
    )
    if not totals["units"]:
        return None
    return (totals["points"] / totals["units"]).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def weighted_average(lines):
    """point_average for (units, grade_point) pairs already in memory."""
    units = sum(line_units for line_units, _ in lines)
    if not units:
        return None
    points = sum(line_units * point for line_units, point in lines)
    return (Decimal(points) / units).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def average_by(entries, key):
    """CGPA, units and failed-course count per value of key, for entries from approved_entries()."""
    units = F("registration__offering__course__units")
    rows = (
        entries.order_by()
        .values(key)
        .annotate(
            points=Sum(ExpressionWrapper(units * F("grade_point"), output_field=DecimalField(max_digits=8, decimal_places=2))),
            units=Sum(units),
            failed=Count("pk", filter=Q(grade=FAIL)),
        )
    )
    return {
        row[key]: {
            "cgpa": (row["points"] / row["units"]).quantize(TWO_PLACES, rounding=ROUND_HALF_UP) if row["units"] else None,
            "units": row["units"],
            "failed": row["failed"],
        }
        for row in rows
    }


def gpa(student, semester):
    return point_average(approved_entries().filter(registration__student=student, registration__offering__semester=semester))


def cgpa(student):
    # a retaken course counts every attempt, so the earlier F still weighs on the average
    return point_average(approved_entries().filter(registration__student=student))


def summarise(entries, scale):
    """Class statistics for a sheet, with a missing CA or exam counted as 0."""
    marks = []
    for entry in entries:
        if entry.total is not None:
            marks.append((entry.total, entry.grade))
        # a draft row with nothing entered yet would read as a fail, so it waits until submit
        elif entry.ca_score is not None or entry.exam_score is not None:
            total = recorded_total(entry)
            marks.append((total, grade_for(total, scale).grade))

    distribution = {band.grade: 0 for band in sorted(scale, key=lambda band: -band.min_score)}
    for _, grade in marks:
        distribution[grade] = distribution.get(grade, 0) + 1
    totals = [total for total, _ in marks]
    passed = sum(1 for _, grade in marks if grade != FAIL)
    scored = sum(1 for entry in entries if entry.ca_score is not None and entry.exam_score is not None)
    return {
        "students": len(entries),
        "scored": scored,
        "incomplete": len(entries) - scored,
        "average": (sum(totals) / len(totals)).quantize(TWO_PLACES, rounding=ROUND_HALF_UP) if totals else None,
        "highest": max(totals) if totals else None,
        "lowest": min(totals) if totals else None,
        "pass_rate": (Decimal(100 * passed) / len(marks)).quantize(TWO_PLACES, rounding=ROUND_HALF_UP) if marks else None,
        "distribution": distribution,
    }
