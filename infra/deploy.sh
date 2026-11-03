#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="europe-west1"
REPO="uemp"
SQL_INSTANCE="uemp-db"
DB_NAME="uemp"
DB_USER="uemp"
DOMAIN="uemp.abrahamalgorithm.tech"
DEMO_ACCOUNTS="superadmin@uemp.test admin.csc@uemp.test lecturer1.csc@uemp.test student1@uemp.test"

# point every gcloud call at the project without changing the global config
export CLOUDSDK_CORE_PROJECT="$PROJECT_ID"
export CLOUDSDK_CORE_DISABLE_PROMPTS=1

TAG="$(git -C "$ROOT" rev-parse --short HEAD)"
if [[ -n "$(git -C "$ROOT" status --porcelain -- backend frontend)" ]]; then
  echo "note: uncommitted changes in backend/ or frontend/ are not deployed, only commit ${TAG} is" >&2
fi

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format 'value(projectNumber)')"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}"
API_IMAGE="${REGISTRY}/api:${TAG}"
WEB_IMAGE="${REGISTRY}/web:${TAG}"
SQL_CONNECTION="${PROJECT_ID}:${REGION}:${SQL_INSTANCE}"
API_SA="uemp-api-sa@${PROJECT_ID}.iam.gserviceaccount.com"
# cloud run's deterministic urls are known before the first deploy
API_URL="https://uemp-api-${PROJECT_NUMBER}.${REGION}.run.app"
WEB_URL="https://uemp-web-${PROJECT_NUMBER}.${REGION}.run.app"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
# build from the commit rather than the working tree, so each image matches its tag
SRC="$WORK/src"
mkdir -p "$SRC"
git -C "$ROOT" archive HEAD backend frontend | tar -x -C "$SRC"

step() { printf '\n==> %s\n' "$*"; }
exists() { "$@" >/dev/null 2>&1; }
token() { python3 -c "import secrets; print(secrets.token_urlsafe($1), end='')"; }
add_secret() { printf '%s' "$2" | gcloud secrets create "$1" --replication-policy automatic --data-file -; }
# .dockerignore lists the Dockerfile itself: docker tolerates that, but the upload would then leave it out
upload_ignore() {
  grep -vx 'Dockerfile' "$SRC/$1/.dockerignore" > "$WORK/$1.gcloudignore"
  echo "$WORK/$1.gcloudignore"
}
retry() {
  for _ in 1 2 3 4 5 6; do
    "$@" && return 0
    sleep 10
  done
  return 1
}

# the hash-style *.a.run.app urls only exist once a service does, so the lists grow on later runs
service_urls() {
  gcloud run services describe "$1" --region "$REGION" \
    --format 'value(metadata.annotations."run.googleapis.com/urls")' 2>/dev/null | tr -d '[]" ' | tr ',' '\n'
}
api_urls() { { service_urls uemp-api; printf '%s\n' "$API_URL"; } | grep . | sort -u; }
web_urls() { { service_urls uemp-web; printf '%s\n' "$WEB_URL" "https://${DOMAIN}"; } | grep . | sort -u; }
# the api only ever sees its own host (the next proxy and the swagger page call it directly); browsers
# send the web origin, or the api origin from swagger
api_env() {
  local api web
  api="$(api_urls)"
  web="$(web_urls)"
  printf '^|^DJANGO_SETTINGS_MODULE=config.settings.prod|ALLOWED_HOSTS=%s|CSRF_TRUSTED_ORIGINS=%s|CORS_ALLOWED_ORIGINS=%s' \
    "$(paste -sd, - <<<"${api//https:\/\//}")" "$(paste -sd, - <<<"$api"$'\n'"$web")" "$(paste -sd, - <<<"$web")"
}

step "1. enable apis"
gcloud services enable run.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com \
  artifactregistry.googleapis.com cloudbuild.googleapis.com

step "2. artifact registry repo ${REPO}"
exists gcloud artifacts repositories describe "$REPO" --location "$REGION" \
  || gcloud artifacts repositories create "$REPO" --repository-format docker --location "$REGION" \
    --description "UEMP images"

step "3. cloud sql ${SQL_INSTANCE}"
if ! exists gcloud sql instances describe "$SQL_INSTANCE"; then
  operation="$(gcloud sql instances create "$SQL_INSTANCE" --database-version POSTGRES_16 --edition ENTERPRISE \
    --tier db-f1-micro --region "$REGION" --async --format 'value(name)')"
  # creation regularly outlasts gcloud's default wait, which would fail the script
  gcloud sql operations wait "$operation" --timeout unlimited
fi
exists gcloud sql databases describe "$DB_NAME" --instance "$SQL_INSTANCE" \
  || gcloud sql databases create "$DB_NAME" --instance "$SQL_INSTANCE"

step "4. secrets"
exists gcloud secrets describe DJANGO_SECRET_KEY || add_secret DJANGO_SECRET_KEY "$(token 48)"
# the db password only ever lives in this secret, so the user is (re)set whenever the secret is created
if ! exists gcloud secrets describe DATABASE_URL; then
  db_password="$(token 32)"
  if gcloud sql users list --instance "$SQL_INSTANCE" --format 'value(name)' | grep -qx "$DB_USER"; then
    gcloud sql users set-password "$DB_USER" --instance "$SQL_INSTANCE" --password "$db_password"
  else
    gcloud sql users create "$DB_USER" --instance "$SQL_INSTANCE" --password "$db_password"
  fi
  # django-environ 0.14 doesn't decode a %2F socket host, so the socket path goes in ?host= instead
  add_secret DATABASE_URL "postgres://${DB_USER}:${db_password}@/${DB_NAME}?host=/cloudsql/${SQL_CONNECTION}"
  unset db_password
fi
exists gcloud secrets describe SEED_PASSWORD || add_secret SEED_PASSWORD "${SEED_PASSWORD:-$(token 12)}"
# the only account that reaches the django admin; its address is private, so it has no default here
exists gcloud secrets describe OPS_ADMIN_EMAIL \
  || add_secret OPS_ADMIN_EMAIL "${OPS_ADMIN_EMAIL:?set OPS_ADMIN_EMAIL for the first run, it becomes a secret}"
exists gcloud secrets describe OPS_ADMIN_PASSWORD || add_secret OPS_ADMIN_PASSWORD "${OPS_ADMIN_PASSWORD:-$(token 24)}"

step "5. service account uemp-api-sa"
exists gcloud iam service-accounts describe "$API_SA" \
  || gcloud iam service-accounts create uemp-api-sa --display-name "UEMP API and migrate job"
# a new service account takes a few seconds before iam accepts it as a member
retry gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:${API_SA}" \
  --role roles/cloudsql.client --condition None --quiet >/dev/null
for secret in DJANGO_SECRET_KEY DATABASE_URL SEED_PASSWORD OPS_ADMIN_EMAIL OPS_ADMIN_PASSWORD; do
  retry gcloud secrets add-iam-policy-binding "$secret" --member "serviceAccount:${API_SA}" \
    --role roles/secretmanager.secretAccessor --quiet >/dev/null
done

step "6. build ${API_IMAGE}"
exists gcloud artifacts docker images describe "$API_IMAGE" \
  || gcloud builds submit "$SRC/backend" --tag "$API_IMAGE" --ignore-file "$(upload_ignore backend)"

step "7. deploy uemp-api"
API_ENV="$(api_env)"
# db-f1-micro allows about 25 connections and each instance can hold 8 (gunicorn threads)
gcloud run deploy uemp-api \
  --image "$API_IMAGE" \
  --region "$REGION" \
  --service-account "$API_SA" \
  --add-cloudsql-instances "$SQL_CONNECTION" \
  --set-env-vars "$API_ENV" \
  --set-secrets "SECRET_KEY=DJANGO_SECRET_KEY:latest,DATABASE_URL=DATABASE_URL:latest" \
  --min-instances 1 \
  --max-instances 2 \
  --allow-unauthenticated

step "8. migrate and seed"
gcloud run jobs deploy uemp-migrate \
  --image "$API_IMAGE" \
  --region "$REGION" \
  --service-account "$API_SA" \
  --set-cloudsql-instances "$SQL_CONNECTION" \
  --set-env-vars "$API_ENV" \
  --set-secrets "SECRET_KEY=DJANGO_SECRET_KEY:latest,DATABASE_URL=DATABASE_URL:latest,SEED_PASSWORD=SEED_PASSWORD:latest,OPS_ADMIN_EMAIL=OPS_ADMIN_EMAIL:latest,OPS_ADMIN_PASSWORD=OPS_ADMIN_PASSWORD:latest" \
  --max-retries 0 \
  --task-timeout 15m \
  --command sh \
  --args="-c,python manage.py migrate --noinput && python manage.py seed_demo && python manage.py create_ops_admin"
gcloud run jobs execute uemp-migrate --region "$REGION" --wait

step "9. build and deploy uemp-web"
if ! exists gcloud artifacts docker images describe "$WEB_IMAGE"; then
  build_config="$WORK/web-build.yaml"
  # next bakes the api url in at build time, and --tag can't pass build args
  cat > "$build_config" <<EOF
steps:
  - name: gcr.io/cloud-builders/docker
    args: ["build", "--build-arg", "API_URL=${API_URL}", "-t", "${WEB_IMAGE}", "."]
images: ["${WEB_IMAGE}"]
EOF
  gcloud builds submit "$SRC/frontend" --config "$build_config" --ignore-file "$(upload_ignore frontend)"
fi
gcloud run deploy uemp-web \
  --image "$WEB_IMAGE" \
  --region "$REGION" \
  --min-instances 1 \
  --allow-unauthenticated

if [[ "$(api_env)" != "$API_ENV" ]]; then
  step "9b. allow the urls uemp-web was given"
  API_ENV="$(api_env)"
  gcloud run services update uemp-api --region "$REGION" --update-env-vars "$API_ENV"
  gcloud run jobs update uemp-migrate --region "$REGION" --update-env-vars "$API_ENV"
fi

step "10. map ${DOMAIN}"
domain_verified() {
  local verified
  for verified in $(gcloud domains list-user-verified --format 'value(id)'); do
    [[ "$DOMAIN" == "$verified" || "$DOMAIN" == *".${verified}" ]] && return 0
  done
  return 1
}
if ! domain_verified; then
  echo "${DOMAIN#*.} isn't verified for $(gcloud config get-value account 2>/dev/null)." >&2
  echo "Verify it with: gcloud domains verify ${DOMAIN#*.}   then run this script again." >&2
  exit 1
fi
exists gcloud beta run domain-mappings describe --domain "$DOMAIN" --region "$REGION" \
  || gcloud beta run domain-mappings create --service uemp-web --domain "$DOMAIN" --region "$REGION"
echo "Add this record at the DNS provider for ${DOMAIN#*.}:"
retry bash -c "gcloud beta run domain-mappings describe --domain '$DOMAIN' --region '$REGION' \
  --flatten status.resourceRecords --format 'value(status.resourceRecords.type)' | grep -q ."
gcloud beta run domain-mappings describe --domain "$DOMAIN" --region "$REGION" \
  --flatten status.resourceRecords \
  --format 'table(status.resourceRecords.type:label=TYPE,status.resourceRecords.name:label=NAME,status.resourceRecords.rrdata:label=VALUE)'

step "11. smoke test ${WEB_URL}"
health="$(curl -fsS "${WEB_URL}/api/health/")"
echo "health: ${health}"
[[ "$health" == *'"database":"ok"'* ]]

seed_password="$(gcloud secrets versions access latest --secret SEED_PASSWORD)"
jar="$WORK/cookies"
headers="$WORK/headers"
failures=0
for account in $DEMO_ACCOUNTS; do
  : > "$jar"
  curl -fsS -c "$jar" -b "$jar" -o /dev/null "${WEB_URL}/api/auth/csrf/"
  csrf="$(awk '$6 == "csrftoken" { print $7 }' "$jar")"
  auth=(-c "$jar" -b "$jar" -H "Origin: ${WEB_URL}" -H "X-CSRFToken: ${csrf}")
  login="$(printf '{"identifier":"%s","password":"%s"}' "$account" "$seed_password" \
    | curl -sS "${auth[@]}" -D "$headers" -o /dev/null -w '%{http_code}' \
      -H 'Content-Type: application/json' --data @- "${WEB_URL}/api/auth/login/")"
  role="$(curl -sS "${auth[@]}" "${WEB_URL}/api/auth/me/" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("role"))')"
  secure="$(grep -Eci '^set-cookie: uemp_(access|refresh)=.*; secure' "$headers" || true)"
  httponly="$(grep -Eci '^set-cookie: uemp_(access|refresh)=.*; httponly' "$headers" || true)"
  logout="$(curl -sS "${auth[@]}" -o /dev/null -w '%{http_code}' -X POST "${WEB_URL}/api/auth/logout/")"
  after="$(curl -sS "${auth[@]}" -o /dev/null -w '%{http_code}' "${WEB_URL}/api/auth/me/")"
  echo "${account}: login ${login}, role ${role}, secure ${secure}/2, httponly ${httponly}/2, logout ${logout}, me after logout ${after}"
  [[ "$login" == 200 && "$secure" == 2 && "$httponly" == 2 && "$logout" == 204 && "$after" == 401 ]] \
    || failures=$((failures + 1))
done
unset seed_password

step "12. done"
echo "uemp-api: ${API_URL}"
echo "uemp-web: ${WEB_URL}"
echo "domain:   https://${DOMAIN} (live once the DNS record above resolves and the certificate is issued)"
exit "$failures"
