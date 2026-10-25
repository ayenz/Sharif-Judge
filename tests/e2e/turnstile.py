# Cloudflare Turnstile on sign-in, registration and password reset.
# Run after tests/regression/run.py: uv run --with requests --with playwright python tests/e2e/turnstile.py
#
# Off by default. Turnstile needs keys in the environment and the Settings switch, which an
# admin can only turn on after passing one check with those keys. The test uses Cloudflare's
# official test keys (an always-passing and an always-failing secret, and a site key whose widget
# passes at once), so it checks the real verification against Cloudflare. The web container and
# the setting are put back to the default (off) at the end. Needs internet access from the
# server and this machine.
import os
import subprocess
import sys
import time

import requests
from playwright.sync_api import sync_playwright

B = os.environ.get("SHJ_URL", "http://172.30.30.101:8402")
SSH = ["ssh", os.environ.get("SHJ_SSH", "stillmen.dell")]
COMPOSE = os.environ.get("SHJ_COMPOSE", "cd ~/stillmen/sharif-judge/repo/docker && docker compose")
SITE_PASS = "1x00000000000000000000AA"            # widget always passes
SECRET_PASS = "1x0000000000000000000000000000000AA"  # accepts the dummy token
SECRET_FAIL = "2x0000000000000000000000000000000AA"  # always rejects
DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX"
failures = []


def check(ok, label):
    print(f"{'OK ' if ok else 'BAD'} {label}")
    if not ok:
        failures.append(label)


def restart_web(site="", secret=""):
    env = f"TURNSTILE_SITE_KEY={site} TURNSTILE_SECRET_KEY={secret}"
    subprocess.run(SSH + [f"{COMPOSE.replace('docker compose', env + ' docker compose')} up -d web >/dev/null 2>&1"], check=True)
    for _ in range(60):
        try:
            if requests.get(B + "/api/install", timeout=2).ok:
                return
        except requests.RequestException:
            pass
        time.sleep(1)
    raise TimeoutError("web did not come back")


def db(sql):
    q = f"{COMPOSE} exec -T db mariadb -uroot -pshj_root -N shj_web -e \"{sql}\""
    return subprocess.run(SSH + [q], capture_output=True, text=True).stdout.strip()


admin = requests.Session()
admin.post(B + "/api/auth/login", json={"username": "admin", "password": "admin123"}).raise_for_status()


def save_settings(on, token=None):
    data = admin.get(B + "/api/settings").json()
    body = dict(data["settings"], shields={}, enableTurnstile=on)
    if token is not None:
        body["turnstileToken"] = token
    return admin.post(B + "/api/settings", json=body)


def login(token=None):
    body = {"username": "alice", "password": "secret123"}
    if token is not None:
        body["turnstileToken"] = token
    return requests.post(B + "/api/auth/login", json=body)


def field_error(r):
    try:
        return r.json()["data"]["errors"].get("turnstile", "")
    except Exception:
        return ""


try:
    # 1. Off by default, and cannot be switched on without keys
    check(requests.get(B + "/api/auth/options").json().get("turnstileSiteKey") is None, "off by default (no site key sent)")
    check(login().status_code == 200, "sign-in works without a token when off")
    check(admin.get(B + "/api/settings").json().get("turnstileSiteKey") is None, "Settings knows no keys are configured")
    r = save_settings(True, DUMMY_TOKEN)
    check(r.status_code == 422 and "docker/.env" in r.text, f"switching on without keys is refused ({r.status_code})")

    # 2. Keys alone do not switch it on
    restart_web(SITE_PASS, SECRET_PASS)
    admin.post(B + "/api/auth/login", json={"username": "admin", "password": "admin123"}).raise_for_status()
    check(requests.get(B + "/api/auth/options").json().get("turnstileSiteKey") is None, "keys configured but switch off: still off")
    check(login().status_code == 200, "sign-in still works without a token")

    # 3. Switching on needs one passed check
    r = save_settings(True)
    check(r.status_code == 422 and "security check" in r.text, f"switching on without the check is refused ({r.status_code})")
    check(db("SELECT shj_value FROM shj_settings WHERE shj_key='enable_turnstile'") == "0", "the setting stays off after a refused attempt")
    r = save_settings(True, DUMMY_TOKEN)
    check(r.ok, f"switching on after passing the check works ({r.status_code})")

    # 4. On: the forms need a token
    check(requests.get(B + "/api/auth/options").json().get("turnstileSiteKey") == SITE_PASS, "site key sent to the sign-in page when on")
    r = login()
    check(r.status_code == 422 and "security check" in field_error(r), f"sign-in without a token refused ({r.status_code} {field_error(r)!r})")
    r = requests.post(B + "/api/auth/lost", json={"email": "alice@example.com"})
    check(r.status_code == 422 and "security check" in field_error(r), f"password reset request without a token refused ({r.status_code})")
    r = login(DUMMY_TOKEN)
    check(r.status_code == 200, f"sign-in with a token Cloudflare accepts works ({r.status_code})")
    r = requests.post(B + "/api/auth/login", json={"username": "alice", "password": "wrongpass123", "turnstileToken": DUMMY_TOKEN})
    check(r.status_code == 401, f"a valid token does not bypass the password check ({r.status_code})")
    r = save_settings(True)
    check(r.ok, f"saving Settings while it is already on needs no new check ({r.status_code})")

    # The widget in a real browser: rendered from Cloudflare, button enabled once it passes
    with sync_playwright() as p:
        br = p.chromium.launch()
        page = br.new_page()
        # Not "networkidle": the widget keeps talking to Cloudflare in the background. Its iframe
        # sits in a closed shadow root, so look for it among the page's frames.
        page.goto(B + "/login", wait_until="load")
        page.wait_for_function("() => document.querySelector('input[name=cf-turnstile-response]')?.value", timeout=20000)
        frames = [f.url for f in page.frames if "challenges.cloudflare.com" in f.url]
        check(bool(frames), "the Turnstile widget from Cloudflare is rendered on the sign-in page and passes")
        page.fill("input[autocomplete=username]", "alice")
        page.fill("input[type=password]", "secret123")
        page.wait_for_function("() => !document.querySelector('button[type=submit]').disabled", timeout=20000)
        page.click("button[type=submit]")
        page.wait_for_url(B + "/", timeout=20000)
        check(True, "signed in through the browser after the widget passed")
        br.close()

    # 5. On, with the always-failing secret
    restart_web(SITE_PASS, SECRET_FAIL)
    r = login(DUMMY_TOKEN)
    check(r.status_code == 422 and "failed" in field_error(r), f"a token Cloudflare rejects is refused ({r.status_code} {field_error(r)!r})")
finally:
    db("UPDATE shj_settings SET shj_value='0' WHERE shj_key='enable_turnstile'")
    restart_web()
    check(requests.get(B + "/api/auth/options").json().get("turnstileSiteKey") is None, "back to off after the test")

print("RESULT:", "PASS" if not failures else f"FAIL ({len(failures)})")
sys.exit(1 if failures else 0)
