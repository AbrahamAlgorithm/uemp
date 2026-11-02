FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DJANGO_SETTINGS_MODULE=config.settings.prod \
    PORT=8080

# weasyprint runtime libs
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libpango-1.0-0 \
        libpangoft2-1.0-0 \
        libharfbuzz0b \
        libffi-dev \
        shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# prod settings require these at import, collectstatic never hits the db
RUN SECRET_KEY=collectstatic-only \
    DATABASE_URL=sqlite://:memory: \
    ALLOWED_HOSTS=localhost \
    python manage.py collectstatic --noinput

RUN useradd --system --uid 1001 --no-create-home app
USER app

EXPOSE 8080

# migrations run as a separate job, see infra/deploy.sh
CMD ["sh", "-c", "exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT} --workers 1 --threads 8 --timeout 0 --access-logfile -"]
