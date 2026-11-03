from .models import validate_lecturer


def assign_lecturer(offering, lecturer):
    """Assign or clear the lecturer on an offering; only LECTURER accounts can teach."""
    validate_lecturer(lecturer)
    offering.lecturer = lecturer
    offering.save(update_fields=["lecturer", "updated_at"])
    return offering
