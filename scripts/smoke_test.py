#!/usr/bin/env python3
"""
XportACar — production smoke test.

Hits the production Supabase REST / Auth / Storage APIs and verifies the key
launch-critical invariants:

  1. All required tables exist with their expected columns.
  2. Storage buckets exist with the right visibility (vehicle-photos public,
     payment-proofs private).            [needs SERVICE ROLE key]
  3. (optional) A demo buyer can sign in. [needs DEMO_BUYER_EMAIL/PASSWORD]
  4. The marketplace API returns vehicles to anonymous visitors.
  5. RLS hasn't drifted: anon can READ public vehicles but CANNOT write
     vehicles or bids.

Prints a green check / red X per check and exits non-zero if any check FAILS
(warnings do not fail the run).

USAGE
  # PowerShell
  $env:SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."   # optional but recommended
  $env:DEMO_BUYER_EMAIL="buyer@xportacar.com"      # optional
  $env:DEMO_BUYER_PASSWORD="Demo!1234"             # optional
  python scripts/smoke_test.py

  # bash
  SUPABASE_SERVICE_ROLE_KEY=... python scripts/smoke_test.py

ENV
  SUPABASE_URL                  (default: production project URL below)
  SUPABASE_ANON_KEY             (default: the public publishable key below)
  SUPABASE_SERVICE_ROLE_KEY     (optional — enables bucket + full schema checks)
  DEMO_BUYER_EMAIL / DEMO_BUYER_PASSWORD  (optional — enables the sign-in check)

Only the standard library is used (urllib) — no pip install required.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

# --- Config -----------------------------------------------------------------
# The URL and anon/publishable key are PUBLIC by design (the anon key is the
# "sb_publishable_" type and is embedded in the shipped mobile apps), so it is
# safe to keep them as defaults. Override via env for a different project.
SUPABASE_URL = os.environ.get(
    "SUPABASE_URL", "https://klettmjnnttajdyajafn.supabase.co"
).rstrip("/")
ANON_KEY = os.environ.get(
    "SUPABASE_ANON_KEY",
    os.environ.get(
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "sb_publishable_rawIwWZv12q9_VxVuaMOWQ_A2oXTEJ_",
    ),
)
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
DEMO_EMAIL = os.environ.get("DEMO_BUYER_EMAIL", "")
DEMO_PASSWORD = os.environ.get("DEMO_BUYER_PASSWORD", "")

# Tables → a representative subset of columns to validate. PostgREST validates
# the `select` list against the schema cache, so a missing table or column
# surfaces as an error even when RLS would return zero rows.
EXPECTED_TABLES = {
    "profiles": ["id", "role", "kyc_status", "email", "full_name"],
    "vehicles": ["id", "vin", "make", "model", "year", "status", "listed_price_eur", "market_spec"],
    "vehicle_photos": ["id", "vehicle_id", "url", "category", "sort_order"],
    "vehicle_damages": ["id", "vehicle_id", "location", "severity"],
    "auctions": ["id", "vehicle_id", "status", "end_time", "current_bid_eur", "bid_count"],
    "bids": ["id", "auction_id", "bidder_id", "amount_eur", "is_proxy"],
    "watchlist": ["id", "user_id", "vehicle_id"],
    "notifications": ["id", "user_id", "type", "read"],
    "counter_offers": ["id", "auction_id", "bidder_id", "status"],
    "invoices": ["id", "auction_id", "buyer_id", "total_eur", "status",
                 "invoice_number", "payment_proof_urls", "payment_verified_at"],
    "saved_searches": ["id", "user_id", "filters"],
    "shipping_quotes": ["id", "vehicle_id", "destination", "cost_eur"],
    "kyc_submissions": ["id", "user_id", "document_type", "status"],
    "push_tokens": ["id", "user_id", "token", "platform"],
    "vehicle_valuations": ["id", "make", "model", "year", "min_eur", "avg_eur", "max_eur"],
    "admin_audit_log": ["id", "actor_id", "entity_type", "entity_id", "action"],
    "platform_settings": ["id"],
}

EXPECTED_BUCKETS = {
    "vehicle-photos": {"public": True},
    "payment-proofs": {"public": False},
}

# --- Tiny output helpers ----------------------------------------------------
_USE_COLOR = sys.stdout.isatty() and os.environ.get("NO_COLOR") is None


def _c(code: str, text: str) -> str:
    return f"\033[{code}m{text}\033[0m" if _USE_COLOR else text


PASS = _c("32", "PASS")
FAIL = _c("31", "FAIL")
WARN = _c("33", "WARN")
CHECK = _c("32", "✓")
CROSS = _c("31", "✗")
DASH = _c("33", "→")

_results = {"pass": 0, "fail": 0, "warn": 0}


def record(status: str, label: str, detail: str = "") -> None:
    if status == "pass":
        mark, tag = CHECK, PASS
    elif status == "fail":
        mark, tag = CROSS, FAIL
    else:
        mark, tag = DASH, WARN
    _results[status] += 1
    line = f"  {mark} [{tag}] {label}"
    if detail:
        line += f"  {_c('90', '— ' + detail)}"
    print(line)


def section(title: str) -> None:
    print("\n" + _c("1", title))


# --- HTTP -------------------------------------------------------------------
def request(method: str, url: str, key: str, bearer: str | None = None,
            body: dict | None = None) -> tuple[int, str]:
    """Returns (status_code, response_text). Never raises for HTTP errors."""
    headers = {"apikey": key, "Authorization": f"Bearer {bearer or key}"}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001 — network/DNS/timeout
        return 0, str(e)


# --- Checks -----------------------------------------------------------------
def check_tables() -> None:
    section("1. Tables & columns")
    # Service role bypasses RLS and has full privileges → best for schema checks.
    key = SERVICE_KEY or ANON_KEY
    using = "service-role" if SERVICE_KEY else "anon"
    print(_c("90", f"  (using {using} key)"))
    for table, cols in EXPECTED_TABLES.items():
        sel = ",".join(cols)
        url = f"{SUPABASE_URL}/rest/v1/{table}?select={sel}&limit=1"
        status, text = request("GET", url, key)
        if status == 200:
            record("pass", table, f"{len(cols)} columns OK")
        elif status in (401, 403):
            # Table exists but this key can't read it (no anon grant / RLS).
            record("warn", table, "exists but not readable by this key "
                   "(set SUPABASE_SERVICE_ROLE_KEY to fully verify)")
        elif status == 404 or "PGRST205" in text or "schema cache" in text:
            record("fail", table, "table not found")
        elif status == 400 and ("does not exist" in text or "42703" in text):
            record("fail", table, f"column problem: {_short(text)}")
        else:
            record("warn", table, f"unexpected {status}: {_short(text)}")


def check_buckets() -> None:
    section("2. Storage buckets")
    if not SERVICE_KEY:
        record("warn", "bucket listing", "skipped — set SUPABASE_SERVICE_ROLE_KEY")
        return
    status, text = request("GET", f"{SUPABASE_URL}/storage/v1/bucket", SERVICE_KEY)
    if status != 200:
        record("fail", "list buckets", f"{status}: {_short(text)}")
        return
    try:
        buckets = {b["id"]: b for b in json.loads(text)}
    except (ValueError, KeyError):
        record("fail", "list buckets", "could not parse response")
        return
    for name, want in EXPECTED_BUCKETS.items():
        b = buckets.get(name)
        if not b:
            record("fail", name, "bucket missing")
            continue
        is_public = bool(b.get("public"))
        if is_public == want["public"]:
            record("pass", name, "public" if is_public else "private")
        else:
            record("fail", name,
                   f"visibility drift: public={is_public}, expected {want['public']}")


def check_demo_signin() -> None:
    section("3. Demo buyer sign-in")
    if not (DEMO_EMAIL and DEMO_PASSWORD):
        record("warn", "sign-in", "skipped — set DEMO_BUYER_EMAIL / DEMO_BUYER_PASSWORD")
        return
    url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    status, text = request("POST", url, ANON_KEY,
                           body={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    if status == 200 and "access_token" in text:
        record("pass", "sign-in", f"{DEMO_EMAIL} authenticated")
    else:
        record("fail", "sign-in", f"{status}: {_short(text)}")


def check_marketplace() -> None:
    section("4. Marketplace API (anon)")
    url = (f"{SUPABASE_URL}/rest/v1/vehicles"
           f"?select=id,make,model,status&status=in.(listed,in_auction)&limit=5")
    status, text = request("GET", url, ANON_KEY)
    if status != 200:
        record("fail", "anon read vehicles", f"{status}: {_short(text)}")
        return
    try:
        rows = json.loads(text)
    except ValueError:
        record("fail", "anon read vehicles", "non-JSON response")
        return
    if rows:
        record("pass", "marketplace returns vehicles", f"{len(rows)} live vehicle(s)")
    else:
        record("warn", "marketplace returns vehicles",
               "0 live vehicles (expected before launch / after demo cleanup)")


def check_rls() -> None:
    section("5. RLS policies (anon)")
    # 5a. anon CAN read public (listed/in_auction) vehicles.
    status, _ = request(
        "GET",
        f"{SUPABASE_URL}/rest/v1/vehicles?select=id&status=eq.listed&limit=1",
        ANON_KEY,
    )
    record("pass" if status == 200 else "fail",
           "anon can read public vehicles", f"HTTP {status}")

    # 5b. anon CANNOT insert a vehicle.
    status, text = request(
        "POST", f"{SUPABASE_URL}/rest/v1/vehicles", ANON_KEY,
        body={"vin": "SMOKETEST00000000", "make": "X", "model": "Y", "year": 2024,
              "fuel_type": "petrol", "transmission": "automatic",
              "seller_name": "smoke", "seller_phone": "0"},
    )
    if status in (401, 403):
        record("pass", "anon CANNOT insert vehicles", f"rejected HTTP {status}")
    elif 200 <= status < 300:
        record("fail", "anon CANNOT insert vehicles",
               "INSERT SUCCEEDED — RLS drift! remove the row immediately")
    else:
        record("warn", "anon CANNOT insert vehicles",
               f"rejected HTTP {status} (not 401/403): {_short(text)}")

    # 5c. anon CANNOT insert a bid (money path).
    status, text = request(
        "POST", f"{SUPABASE_URL}/rest/v1/bids", ANON_KEY,
        body={"auction_id": "00000000-0000-0000-0000-000000000000",
              "bidder_id": "00000000-0000-0000-0000-000000000000",
              "amount_eur": 1},
    )
    if status in (401, 403):
        record("pass", "anon CANNOT place bids", f"rejected HTTP {status}")
    elif 200 <= status < 300:
        record("fail", "anon CANNOT place bids",
               "INSERT SUCCEEDED — RLS drift! remove the row immediately")
    else:
        record("warn", "anon CANNOT place bids",
               f"rejected HTTP {status} (not 401/403): {_short(text)}")


def _short(text: str, n: int = 120) -> str:
    text = " ".join(text.split())
    return text[:n] + ("…" if len(text) > n else "")


def main() -> int:
    print(_c("1", "XportACar production smoke test"))
    print(_c("90", f"  target: {SUPABASE_URL}"))
    if not SERVICE_KEY:
        print(_c("33", "  note: SUPABASE_SERVICE_ROLE_KEY not set — bucket check and "
                       "some schema checks will be limited."))

    check_tables()
    check_buckets()
    check_demo_signin()
    check_marketplace()
    check_rls()

    section("Summary")
    print(f"  {CHECK} {_results['pass']} passed   "
          f"{CROSS} {_results['fail']} failed   "
          f"{DASH} {_results['warn']} warnings")
    return 1 if _results["fail"] else 0


if __name__ == "__main__":
    sys.exit(main())
