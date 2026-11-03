from rest_framework import serializers

REASON_MAX_LENGTH = 1000


def reason_field(label):
    return serializers.CharField(
        max_length=REASON_MAX_LENGTH,
        error_messages={
            "required": f"{label} is required.",
            "blank": f"{label} is required.",
            "max_length": f"{label} can't be longer than {REASON_MAX_LENGTH} characters.",
        },
    )
