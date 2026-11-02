"""Local development settings. Defaults point at the docker compose Postgres."""

from .base import *  # noqa: F403
from .base import env

SECRET_KEY = env("SECRET_KEY", default="django-insecure-local-dev-only")

DEBUG = env.bool("DEBUG", default=True)

# "api" is the compose service name, which is the Host header the Next.js proxy sends.
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1", "api"])

DATABASES = {
    "default": env.db("DATABASE_URL", default="postgres://uemp:uemp@localhost:5433/uemp"),
}

CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=["http://localhost:3000"])
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=["http://localhost:3000"])

# collectstatic isn't run in development: serve files straight from the app
# directories, even when tests force DEBUG=False.
WHITENOISE_AUTOREFRESH = True
