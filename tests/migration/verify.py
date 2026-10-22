# /// script
# requires-python = ">=3.11"
# dependencies = ["requests>=2.32", "openpyxl>=3.1"]
# ///
"""
Checks a Nuxt instance running on a database and files taken over from the PHP version
against the PHP app still serving the original data. See tests/migration/README.md.

    uv run tests/migration/verify.py
"""
import importlib.util
import sys
import time
from pathlib import Path

import requests

spec = importlib.util.spec_from_file_location("regression", Path(__file__).parent.parent / "regression" / "run.py")
reg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reg)

MIGRATED = "http://172.30.30.101:8403"
SOURCE_DB = "shj_ci3"          # data of the PHP app on port 8401
MIGRATED_DB = "shj_migrated"   # copy of it, used by the Nuxt app on port 8403
USERS = [("admin", "admin123")] + [(u, "secret123") for u in reg.STUDENTS]
failures: list[str] = []


def check(ok: bool, label: str):
    print(f"{'OK ' if ok else 'BAD'} {label}")
    if not ok:
        failures.append(label)


def nuxt(user, pw):
    s = requests.Session()
    r = s.post(MIGRATED + "/api/auth/login", json={"username": user, "password": pw})
    return s, r.status_code


def rows(db):
    return reg.sql(db, "SELECT assignment, submit_id, username, problem, is_final, status, pre_score, coefficient "
                       "FROM shj_submissions ORDER BY assignment, submit_id")


# 1. Passwords hashed by PHP still work
codes = {u: nuxt(u, pw)[1] for u, pw in USERS}
check(all(c == 200 for c in codes.values()), f"all PHP accounts sign in with their old passwords {codes}")
admin, _ = nuxt("admin", "admin123")

# 2. Start-up migration
settings = admin.get(MIGRATED + "/api/settings").json()["settings"]
check(settings["testerPath"] == "/app/tester" and settings["assignmentsRoot"] == "/data/assignments",
      f"PHP folder paths switched to the container's ({settings['testerPath']}, {settings['assignmentsRoot']})")
check(settings["enablePython2"] is False, "enable_python2 added (off)")
dashboard = admin.get(MIGRATED + "/api/dashboard").json()
folder_warnings = [e["message"] for e in dashboard.get("errors", []) if "folder" in e["message"].lower()]
check(not folder_warnings, f"no folder warnings on the dashboard {folder_warnings}")

# 3. Data is the same as in the PHP app
before = rows(SOURCE_DB)
check(rows(MIGRATED_DB) == before, f"submissions identical to the PHP database ({len(before)} rows)")
assignments = admin.get(MIGRATED + "/api/assignments").json()
check(all(a["coefficient"] != "error" for a in assignments), "PHP late rules evaluate (no 'error' coefficient)")

legacy = reg.LegacyClient()
legacy.login("admin", "admin123")
for aid in sorted({int(r[0]) for r in before}):
    legacy.select_assignment(aid)
    admin.post(MIGRATED + "/api/assignments/select", json={"id": aid}).raise_for_status()
    sb_php = legacy.scoreboard()
    sb_nuxt = [(r["username"], r["total"]) for r in admin.get(MIGRATED + "/api/scoreboard").json()["scoreboard"]["rows"]]
    check(sb_php == sb_nuxt, f"assignment {aid}: scoreboard identical {sb_nuxt}")
    for view in ("final", "all"):
        php_x = reg.excel_rows(legacy.excel(view))
        nuxt_x = reg.excel_rows(admin.get(MIGRATED + f"/api/submissions/excel?view={view}").content)
        check(php_x == nuxt_x, f"assignment {aid}: {view} submissions Excel identical")
hof_php = legacy.hall_of_fame()
hof_nuxt = [(r["username"], r["totalScore"]) for r in admin.get(MIGRATED + "/api/hall-of-fame").json()]
check(hof_php == hof_nuxt, f"Hall of Fame identical {hof_nuxt}")

# 4. Files: code and judge results of every submission open
missing = []
for a, sid, user, prob, *_ , status, _pre, _coef in [r[:5] + r[5:] for r in before]:
    for kind in ("code",) + (("result",) if status in ("SCORE", "Compilation Error", "Syntax Error") else ()):
        r = admin.post(MIGRATED + "/api/submissions/view", json={"type": kind, "username": user, "assignment": int(a), "problem": int(prob), "submitId": int(sid)})
        if r.status_code != 200 or r.json().get("text") in (None, "", "File Not Found"):
            missing.append(f"{user}#{sid} {kind}")
check(not missing, f"code and results of all {len(before)} submissions open {missing[:5]}")

# 5. Judging works on the migrated files: rejudge everything, nothing may change
for aid in sorted({int(r[0]) for r in before}):
    admin.post(MIGRATED + "/api/assignments/select", json={"id": aid}).raise_for_status()
    for p in admin.get(MIGRATED + "/api/submit").json()["problems"]:
        if not p["isUploadOnly"]:
            admin.post(MIGRATED + "/api/rejudge", json={"problemId": p["id"]}).raise_for_status()
for _ in range(300):
    if not admin.get(MIGRATED + "/api/queue").json()["items"]:
        break
    time.sleep(1)
check(rows(MIGRATED_DB) == before, "rejudging every problem on the migrated files gives the same results")

# 6. New work: a student submits on the migrated install
alice, _ = nuxt("alice", "secret123")
alice.post(MIGRATED + "/api/assignments/select", json={"id": 1}).raise_for_status()
code = (Path(__file__).parent.parent / "regression" / "corpus" / "p1_c_ok.c").read_bytes()
alice.post(MIGRATED + "/api/submit", files={"problem": (None, "1"), "language": (None, "C"), "file": ("after-migration.c", code)}).raise_for_status()
for _ in range(60):
    items = alice.get(MIGRATED + "/api/submissions", params={"view": "all"}).json()["items"]
    if items and items[0]["status"] != "PENDING":
        break
    time.sleep(1)
check(items[0]["status"] == "SCORE" and items[0]["fullmark"], f"new submission after migration judged ({items[0]['status']}, {items[0]['preScore']})")

print("RESULT:", "PASS" if not failures else f"FAIL ({len(failures)})")
sys.exit(1 if failures else 0)
