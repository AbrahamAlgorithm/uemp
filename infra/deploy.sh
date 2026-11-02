#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID}"
REGION="${REGION:-europe-west1}"
REPO="${REPO:-uemp}"
SQL_INSTANCE="${SQL_INSTANCE:-uemp-db}"
USE_MOCKS="${USE_MOCKS:-true}"
TAG="${TAG:-$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}"
API_IMAGE="${REGISTRY}/uemp-api:${TAG}"
WEB_IMAGE="${REGISTRY}/uemp-web:${TAG}"
SQL_CONNECTION="${PROJECT_ID}:${REGION}:${SQL_INSTANCE}"

gcloud config set project "$PROJECT_ID"

gcloud builds submit "$ROOT/backend" --tag "$API_IMAGE"

gcloud run jobs deploy uemp-migrate \
  --region "$REGION" \
  --image "$API_IMAGE" \
  --set-cloudsql-instances "$SQL_CONNECTION" \
  --set-env-vars "ALLOWED_HOSTS=localhost" \
  --set-secrets "SECRET_KEY=uemp-secret-key:latest,DATABASE_URL=uemp-database-url:latest" \
  --command python \
  --args manage.py,migrate,--noinput
gcloud run jobs execute uemp-migrate --region "$REGION" --wait

# placeholder host, the real one is set at the end once the urls are known
gcloud run deploy uemp-api \
  --region "$REGION" \
  --image "$API_IMAGE" \
  --add-cloudsql-instances "$SQL_CONNECTION" \
  --set-env-vars "ALLOWED_HOSTS=.run.app" \
  --set-secrets "SECRET_KEY=uemp-secret-key:latest,DATABASE_URL=uemp-database-url:latest" \
  --allow-unauthenticated

API_URL="$(gcloud run services describe uemp-api --region "$REGION" --format 'value(status.url)')"

# both are baked in at build time, and --tag can't pass build args
WEB_BUILD_CONFIG="$(mktemp)"
trap 'rm -f "$WEB_BUILD_CONFIG"' EXIT
cat > "$WEB_BUILD_CONFIG" <<EOF
steps:
  - name: gcr.io/cloud-builders/docker
    args: ["build", "--build-arg", "API_URL=${API_URL}", "--build-arg", "NEXT_PUBLIC_USE_MOCKS=${USE_MOCKS}", "-t", "${WEB_IMAGE}", "."]
images: ["${WEB_IMAGE}"]
EOF
gcloud builds submit "$ROOT/frontend" --config "$WEB_BUILD_CONFIG"

gcloud run deploy uemp-web \
  --region "$REGION" \
  --image "$WEB_IMAGE" \
  --allow-unauthenticated

WEB_URL="$(gcloud run services describe uemp-web --region "$REGION" --format 'value(status.url)')"

gcloud run services update uemp-api \
  --region "$REGION" \
  --update-env-vars "ALLOWED_HOSTS=${API_URL#https://},CORS_ALLOWED_ORIGINS=${WEB_URL},CSRF_TRUSTED_ORIGINS=${WEB_URL}"

echo "uemp-api: ${API_URL}"
echo "uemp-web: ${WEB_URL}"
