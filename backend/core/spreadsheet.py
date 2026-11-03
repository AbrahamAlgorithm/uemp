FORMULA_STARTS = ("=", "+", "-", "@", "\t", "\r")


def safe_text(value):
    """A string that a spreadsheet will show as text, not run as a formula."""
    return f"'{value}" if isinstance(value, str) and value.startswith(FORMULA_STARTS) else value
