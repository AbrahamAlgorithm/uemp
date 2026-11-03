from django.apps import AppConfig


class ResultsConfig(AppConfig):
    name = "apps.results"
    verbose_name = "Results"

    def ready(self):
        from . import signals  # noqa: F401
