# Export an assignment and import it as a new one.
# Run after tests/regression/run.py: uv run --with requests --with playwright python tests/e2e/export-import.py
#
# The export zip carries assignment.json next to the tests. The add form imports it in the
# browser (filled form, schedule/participants/open reset) and uploads the same zip as tests.
# The new assignment must get the same problems and the same files, and assignment.json must
# never land in the assignment folder, also when the zip is uploaded as plain tests.
import io
import json
import os
import subprocess
import sys
import zipfile
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import requests
from playwright.sync_api import sync_playwright

B = os.environ.get("SHJ_URL", "http://172.30.30.101:8402").rstrip("/")  # e.g. http://127.0.0.1:8499/judge
SSH = ["ssh", os.environ.get("SHJ_SSH", "stillmen.dell")]
COMPOSE = os.environ.get("SHJ_COMPOSE", "cd ~/stillmen/sharif-judge/repo/docker && docker compose")
SOURCE = 1
failures = []


def check(ok, label):
    print(f"{'OK ' if ok else 'BAD'} {label}")
    if not ok:
        failures.append(label)


admin = requests.Session()
admin.post(B + "/api/auth/login", json={"username": "admin", "password": "admin123"}).raise_for_status()


def export(aid):
    r = admin.get(B + f"/api/assignments/{aid}/download-tests")
    r.raise_for_status()
    return zipfile.ZipFile(io.BytesIO(r.content)), r.content


def folder_files(aid):
    out = subprocess.run(SSH + [f"{COMPOSE} exec -T web find /data/assignments/assignment_{aid} -maxdepth 3 -type f -not -path '*/p*/*/*'"],
                         capture_output=True, text=True).stdout
    return sorted(line.split(f"assignment_{aid}/", 1)[1] for line in out.split() if line)


# 1. Export
src_zip, src_bytes = export(SOURCE)
meta = json.loads(src_zip.read("assignment.json"))
source = admin.get(B + f"/api/assignments/{SOURCE}").json()
check(meta["format"] == 1 and meta["name"] == source["name"], f"export has assignment.json (format {meta['format']}, {meta['name']!r})")
check(meta["problems"] == source["problems"], f"assignment.json problems match the edit form ({len(meta['problems'])} problems)")
check(any(n.startswith("p1/in/") for n in src_zip.namelist()), "export still has the tests")

# 2. Import in the browser
name = "Imported " + datetime.now().strftime("%H%M%S")
now = datetime.now(ZoneInfo("Asia/Jakarta"))
with sync_playwright() as p:
    br = p.chromium.launch()
    page = br.new_page(viewport={"width": 1366, "height": 860})
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto(B + "/login", wait_until="networkidle")  # sign in only after hydration
    page.fill("input[autocomplete=username]", "admin")
    page.fill("input[type=password]", "admin123")
    page.click("button[type=submit]")
    page.wait_for_url(B + "/")

    # A zip without assignment.json is refused with a message
    plain = io.BytesIO()
    with zipfile.ZipFile(plain, "w") as z:
        z.writestr("p1/in/input1.txt", "1\n")
    page.goto(B + "/assignments/add", wait_until="load")
    page.wait_for_timeout(800)
    page.set_input_files("input[aria-label='Import an exported assignment zip']",
                         files=[{"name": "plain.zip", "mimeType": "application/zip", "buffer": plain.getvalue()}])
    page.wait_for_timeout(800)
    check(page.get_by_text("has no assignment.json").count() > 0, "a zip without assignment.json shows a message")

    page.set_input_files("input[aria-label='Import an exported assignment zip']",
                         files=[{"name": "export.zip", "mimeType": "application/zip", "buffer": src_bytes}])
    page.wait_for_timeout(800)
    filled = page.locator("input[placeholder^='e.g. Week']").input_value()
    check(filled == meta["name"], f"form filled from the export (name {filled!r})")
    check(page.locator("input[type=datetime-local]").first.input_value() == "", "start time is left empty")
    check(page.get_by_text("Filled from export.zip").count() > 0, "the form says where it was filled from")
    page.locator("input[placeholder^='e.g. Week']").fill(name)
    dt = page.locator("input[type=datetime-local]")
    dt.nth(0).fill((now - timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%S"))
    dt.nth(1).fill((now + timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%S"))
    page.get_by_role("button", name="Add assignment").click()
    page.wait_for_url(B + "/assignments", timeout=20000)
    check(not errs, f"no page errors {errs[:2]}")
    br.close()

# 3. The new assignment
new = next((a for a in admin.get(B + "/api/assignments").json() if a["name"] == name), None)
check(new is not None, "imported assignment saved")
if new:
    copy = admin.get(B + f"/api/assignments/{new['id']}").json()
    check(copy["problems"] == meta["problems"], "same problems, limits, languages and diff settings")
    check(copy["participants"] == "ALL" and copy["open"] is False and copy["archived"] is False, "participants, open and archived reset")
    check(copy["lateRule"] == meta["lateRule"] and copy["extraTime"] == meta["extraTime"], "late rule and extra time kept")
    new_zip, _ = export(new["id"])
    same = all(new_zip.read(n) == src_zip.read(n) for n in src_zip.namelist() if n != "assignment.json")
    check(sorted(new_zip.namelist()) == sorted(src_zip.namelist()) and same, f"same tests and descriptions ({len(src_zip.namelist()) - 1} files)")
    files = folder_files(new["id"])
    check("assignment.json" not in " ".join(files), f"assignment.json not stored in the folder ({files[:6]})")

    # 4. The export zip as a plain tests upload when editing
    body = {k: copy[k] for k in ("name", "startTime", "finishTime", "extraTime", "participants", "lateRule", "open", "scoreboard",
                                 "javaexceptions", "archived", "problems")}
    r = admin.post(B + f"/api/assignments/{new['id']}", files={"data": (None, json.dumps(body)),
                                                               "tests_desc": ("export.zip", src_bytes, "application/zip")})
    msgs = r.json().get("messages", []) if r.ok else []
    check(r.ok and any("extracted successfully" in m["text"] for m in msgs), f"export zip works as a tests upload ({r.status_code})")
    check("assignment.json" not in " ".join(folder_files(new["id"])), "assignment.json still not stored after a tests upload")

print("RESULT:", "PASS" if not failures else f"FAIL ({len(failures)})")
sys.exit(1 if failures else 0)
