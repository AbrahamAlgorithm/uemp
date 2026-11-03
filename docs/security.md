# Security

What protects the system, what was checked before release, and what is still open. Roles and the rules behind them are in [permissions.md](permissions.md).

## Authentication

- **Cookie JWTs.** Sign-in sets two httpOnly cookies. `uemp_access` lives 15 minutes and is sent on every request. `uemp_refresh` lives one day and is only sent to `/api/auth/`. Both are `SameSite=Lax`, and `Secure` in production. Tokens are never in a response body or in browser storage, so page scripts can't read them. A third cookie, `uemp_role`, is readable and only drives redirects in the frontend; the server never trusts it.
- **Refresh rotation and blacklist.** `POST /api/auth/refresh/` issues a new pair and blacklists the old refresh token. Sign-out blacklists the current one and clears all three cookies. A used or revoked refresh token is refused.
- **CSRF.** Because the browser sends the auth cookies by itself, every request that carries them is also CSRF-checked (`apps/accounts/authentication.py`). Sign-in, refresh and sign-out are CSRF-checked too, which prevents login CSRF, where a hostile page signs the victim into the attacker's account. The frontend fetches the token from `GET /api/auth/csrf/` and sends it in `X-CSRFToken`.
- **Identifier sign-in.** Users sign in with an email, matric number or staff ID, in any letter case. An unknown identifier and a wrong password return the same `401 "Invalid credentials."`, and an unknown identifier is still hashed so both take about the same time. An inactive or suspended account is told so only after the correct password.
- **Throttling.** Five failed attempts on one account in a minute lock it for the rest of that minute, even for the right password (`429`). All the ways of naming an account (email, matric number, staff ID) share one count, and unknown identifiers lock the same way. Each client address is also limited to 30 sign-in attempts a minute.
- **Suspension.** Status is checked at sign-in and on every authenticated request, so suspending or deactivating an account takes effect immediately and doesn't wait for the 15-minute access token to expire.
- **Passwords.** Hashed with Argon2 (the first entry in `PASSWORD_HASHERS`). The Django validators apply: minimum length, not too similar to the user's details, not a common password, not all digits. Users change their own password with the current one; admins can reset passwords within their scope, and every change is audited.

## Access control

Role permission classes, department-scoped querysets, owner-scoped queries and service-layer state checks are described in [permissions.md](permissions.md). Records outside a caller's scope return `404` so their existence isn't revealed.

## Audit trail

Sign-ins and sign-outs, every create, update and delete, registration and result transitions, password changes and resets, role and status changes, calendar and grading scale changes, and self-service profile edits write an `AuditLog` row with the actor, department, target, before and after values and client address. The row is written in the same transaction as the change, and `audit.record()` refuses to run outside a transaction. The table is append-only through the application, read-only in the Django admin, and readable through the API by the super admin only.

## Input handling

- All database access goes through the ORM. The only hand-written SQL is the constant `SELECT 1` of the health check.
- Score files must be `.xlsx` or `.csv`, at most 1 MB and 5000 rows, which stops a small compressed workbook expanding into millions of rows.
- Text that begins with `=`, `+`, `-` or `@` is written to CSV and Excel exports with a leading apostrophe, so a hostile name can't run as a spreadsheet formula. This applies to report downloads and to the score template.
- Report download filenames are built from slugs of the department code and semester.
- React escapes everything it renders, and the app has no `dangerouslySetInnerHTML`.

## Secrets and the ops account

- Production secrets are in Secret Manager (`DJANGO_SECRET_KEY`, `DATABASE_URL`, `SEED_PASSWORD`, `OPS_ADMIN_EMAIL`, `OPS_ADMIN_PASSWORD`) and reach the containers as environment variables. The API's service account may read only those secrets and connect to Cloud SQL.
- `config.settings.prod` has no default for `SECRET_KEY`, `ALLOWED_HOSTS` or `DATABASE_URL`, so a missing value stops the process.
- A scan of the tracked files for keys, tokens and assigned passwords finds none. The only credential in the repository is the demo password `Demo@2026`, which is documented on purpose and belongs to demo data. The development `SECRET_KEY` default in `config/settings/dev.py` is used only locally.
- The Django admin is for operations, not for the university's staff. No demo account has `is_staff`. `manage.py create_ops_admin` creates the one account that does, from `OPS_ADMIN_EMAIL` and `OPS_ADMIN_PASSWORD`, and refuses an address on the demo domain, because `seed_demo --reset` would delete it.

## Production settings

| Setting | Value |
| --- | --- |
| `DEBUG` | `False` |
| `ALLOWED_HOSTS` | Set by `infra/deploy.sh` to the API's own hosts only (the Cloud Run URLs of `uemp-api`) |
| `CSRF_TRUSTED_ORIGINS` | The web URLs (both Cloud Run URLs and `https://uemp.abrahamalgorithm.tech`) and the API URLs, since the API docs page posts from the API origin |
| `CORS_ALLOWED_ORIGINS` | The web URLs only. Normal use never needs CORS because the browser talks to the web origin. |
| `SECURE_PROXY_SSL_HEADER` | `("HTTP_X_FORWARDED_PROTO", "https")`, because TLS ends at Cloud Run |
| `SECURE_SSL_REDIRECT` | `True`, with `/api/health/` exempt so platform probes over plain HTTP still pass |
| `SECURE_HSTS_SECONDS` | 31536000 (one year) |
| `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `AUTH_COOKIE_SECURE` | `True` |
| `X_FRAME_OPTIONS` | `DENY` |
| `SECURE_CONTENT_TYPE_NOSNIFF` | `True` (Django default) |

## Deploy check

`python manage.py check --deploy --settings=config.settings.prod`, run with a 64-character secret key, reports two warnings and nothing else:

- **`security.W005`**, `SECURE_HSTS_INCLUDE_SUBDOMAINS` not set. Left off on purpose. The app runs on a subdomain of `abrahamalgorithm.tech`, and the parent domain hosts other sites that this project doesn't control. Applying HSTS to every subdomain could lock them out if any of them is served over plain HTTP.
- **`security.W021`**, `SECURE_HSTS_PRELOAD` not set. Left off on purpose. Preloading needs `includeSubDomains` and is slow to undo.

Earlier runs also reported missing type hints and duplicate route names from the API schema generator. Those are fixed, so the API documentation is complete.

## Dependency audit

- **Python.** `pip-audit` over `requirements.txt` and its resolved dependencies: no known vulnerabilities.
- **JavaScript.** `npm audit` reports 21 findings (2 low, 18 moderate, 1 high). `npm audit fix` changes nothing, because every fix is a major upgrade that would need its own testing:
  - `next` and the PostCSS copy it bundles (high): the advisories are about stringifying or reading source maps of untrusted CSS. The app only builds its own stylesheet and never processes user-supplied CSS. Fixed by Next 16.4 or later.
  - `shadcn` and `deepmerge` (low and moderate): the `shadcn` package is a code generator and stylesheet source used at build time. Fixed by shadcn 1.0.
  - `minimatch` through the ESLint and TypeScript tooling (moderate): development tools that never run in production.

## Found and fixed in the final review

Two gaps in department admin writes were found by testing and are fixed, with tests (`test_account_safety.py`, `test_scope_writes.py`):

- A department admin could change a lecturer's role through the staff endpoint, promoting them to admin or demoting them to student, and could delete staff and student records. Roles now change only through the users endpoint (super admin only), department admins no longer see other admins in the staff list, and these records can't be deleted.
- A department admin could create a program in another department, move a program there, or open another department's course for a semester. Programs are now forced into the admin's own department, and an offering for another department's course is a `404`.

## Known limitations

- **Throttle storage.** Sign-in throttling uses Django's local-memory cache, so each Cloud Run instance counts separately. With two instances an attacker gets roughly twice the allowance. A shared cache such as Redis, plus Cloud Armor rate limiting in front of the service, would fix this.
- **Client address.** `NUM_PROXIES` is 0, so the API records the address of the connection it sees, which behind Cloud Run and the Next.js proxy is not always the end user's. Audit rows and the per-IP limit are only as precise as that address.
- **No second factor and no self-service recovery.** Email and SMS are out of scope, so there is no multi-factor sign-in and no password reset by email. A user who forgets a password asks their department admin.
- **Django admin.** `/admin/` is on the API host and its login form is not throttled. It is protected by the ops account's long random password. Changes made in it are recorded by Django's own admin log and not in the audit log.
- **Access tokens.** A stolen access token works until it expires in 15 minutes or the account is suspended, whichever comes first. There is no per-token revocation for access tokens.
- **HSTS scope.** Subdomains and preload are not set, as explained above.
