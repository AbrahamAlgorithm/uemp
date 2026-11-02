from .base import *  # noqa: F403
from .base import env

SECRET_KEY = env("SECRET_KEY", default="django-insecure-local-dev-only")

DEBUG = env.bool("DEBUG", default=True)

# "api" is the Host header the next proxy sends inside compose
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1", "api"])

DATABASES = {
    "default": env.db("DATABASE_URL", default="postgres://uemp:uemp@localhost:5433/uemp"),
}

CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=["http://localhost:3000"])
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=["http://localhost:3000"])

# no collectstatic in dev, and pytest forces DEBUG=False
WHITENOISE_AUTOREFRESH = True
