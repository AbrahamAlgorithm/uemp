import csv
import re

from django.http import HttpResponse

FORMULA_STARTS = ("=", "+", "-", "@", "\t", "\r")


def cell(value):
    if value is None:
        return ""
    text = str(value)
    # a spreadsheet would run a leading = + - @ as a formula
    return f"'{text}" if isinstance(value, str) and text.startswith(FORMULA_STARTS) else text


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def filename(report, department, semester):
    parts = [report, department.code if department else "all-departments"]
    if semester:
        parts += [semester.session.name, semester.term]
    return f"{slug('-'.join(parts))}.csv"


def csv_response(tables, name):
    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{name}"'
    writer = csv.writer(response)
    for index, table in enumerate(tables):
        if index:
            writer.writerow([])
        if len(tables) > 1:
            writer.writerow([cell(table["title"])])
        writer.writerow([cell(column["label"]) for column in table["columns"]])
        for row in table["rows"]:
            writer.writerow([cell(row[column["key"]]) for column in table["columns"]])
    return response
