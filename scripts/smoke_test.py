#!/usr/bin/env python3
"""Smoke test for a running UEMP deployment.

    python scripts/smoke_test.py https://uemp.abrahamalgorithm.tech
    SEED_PASSWORD=... python scripts/smoke_test.py http://localhost:3000

Needs the requests package and a database loaded with seed_demo.
"""
import argparse
import os
import sys

import requests

ACCOUNTS = {
    "student1@uemp.test": "STUDENT",
    "lecturer1.csc@uemp.test": "LECTURER",
    "admin.csc@uemp.test": "DEPT_ADMIN",
    "superadmin@uemp.test": "SUPER_ADMIN",
}
STUDENT, LECTURER, DEPT_ADMIN, SUPER_ADMIN = ACCOUNTS
TIMEOUT = 30

results = []


def check(name, ok, detail=""):
    results.append(ok)
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  ({detail})" if detail else ""))
    return ok


class Client:
    def __init__(self, base):
        self.base = base.rstrip("/")
        self.http = requests.Session()

    def call(self, method, path, **kwargs):
        headers = {"Origin": self.base, "Accept": "application/json", **kwargs.pop("headers", {})}
        token = self.http.cookies.get("csrftoken")
        if token:
            headers["X-CSRFToken"] = token
        return self.http.request(method, f"{self.base}/api/{path}", headers=headers, timeout=TIMEOUT, **kwargs)

    def get(self, path, **kwargs):
        return self.call("GET", path, **kwargs)

    def login(self, identifier, password):
        self.call("GET", "auth/csrf/")
        return self.call("POST", "auth/login/", json={"identifier": identifier, "password": password})


def signed_in(base, identifier, password):
    client = Client(base)
    response = client.login(identifier, password)
    if response.status_code != 200:
        raise SystemExit(f"cannot sign in as {identifier}: HTTP {response.status_code} {response.text[:200]}")
    return client


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("base_url")
    parser.add_argument("--password", default=os.environ.get("SEED_PASSWORD", "Demo@2026"))
    args = parser.parse_args()
    base, password = args.base_url.rstrip("/"), args.password
    print(f"Smoke test against {base}\n")

    health = Client(base).get("health/")
    check("health reports ok", health.status_code == 200 and health.json() == {"status": "ok", "database": "ok"}, health.text[:80])

    clients = {}
    for identifier, role in ACCOUNTS.items():
        client = Client(base)
        response = client.login(identifier, password)
        me = client.get("auth/me/")
        got = me.json().get("role") if me.status_code == 200 else None
        check(f"{identifier} signs in and /me says {role}", response.status_code == 200 and got == role, f"login {response.status_code}, role {got}")
        clients[identifier] = client

    student, lecturer, dept_admin, super_admin = (clients[i] for i in (STUDENT, LECTURER, DEPT_ADMIN, SUPER_ADMIN))

    response = student.get("users/")
    check("student gets 403 on an admin endpoint (GET /api/users/)", response.status_code == 403, f"HTTP {response.status_code}")

    eee = super_admin.get("students/", params={"search": "EEE/", "page_size": 1}).json()
    eee_id = eee["results"][0]["id"] if eee.get("results") else None
    response = dept_admin.get(f"students/{eee_id}/") if eee_id else None
    check(
        "CSC department admin gets 404 on an EEE student record",
        response is not None and response.status_code == 404,
        f"HTTP {response.status_code}" if response is not None else "no EEE student found",
    )

    own = {row["id"] for row in lecturer.get("lecturer/offerings/").json()}
    offerings = super_admin.get("offerings/", params={"semester": "current", "page_size": 100}).json()["results"]
    other = next((row["id"] for row in offerings if row["id"] not in own and row["lecturer"]), None)
    response = lecturer.get(f"lecturer/offerings/{other}/sheet/") if other else None
    check(
        "lecturer gets 404 on another lecturer's result sheet",
        response is not None and response.status_code == 404,
        f"HTTP {response.status_code}" if response is not None else "no other offering found",
    )

    response = Client(base).get("auth/me/")
    check("unauthenticated request gets 401", response.status_code == 401, f"HTTP {response.status_code}")

    before = student.get("auth/me/").json()["profile"]
    phone = "08061200002" if before["phone"] != "08061200002" else "08061200003"
    response = student.call("PATCH", "auth/me/profile/", json={"phone": phone})
    updated = response.status_code == 200 and response.json()["profile"]["phone"] == phone
    check("student can update their phone number", updated, f"HTTP {response.status_code}")
    student.call("PATCH", "auth/me/profile/", json={"phone": before["phone"].replace(" ", "")})

    response = student.call("PATCH", "auth/me/profile/", json={"matric_no": "CSC/2024/9999"})
    unchanged = student.get("auth/me/").json()["profile"]["matric_no"] == before["matric_no"]
    check("student cannot change their matric number", response.status_code == 400 and unchanged, f"HTTP {response.status_code}")

    for identifier, client in clients.items():
        response = client.call("POST", "auth/logout/")
        after = client.get("auth/me/")
        check(f"{identifier} logs out and loses access", response.status_code == 204 and after.status_code == 401, f"logout {response.status_code}, then {after.status_code}")

    passed = sum(results)
    print(f"\n{passed} of {len(results)} checks passed")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
