# Run after tests/regression/run.py: uv run --with requests python tests/e2e/python2.py
# Python 2 is off by default: hidden from forms and the submit page, refused on submit,
# and it can be switched on and off in Settings.
import json
import subprocess
import sys
import time

import requests

B = "http://172.30.30.101:8402"
SSH = ["ssh", "stillmen.dell"]
COMPOSE = "cd ~/stillmen/sharif-judge/repo/docker && docker compose"
PY2 = 'print "hello"\n'
failures = []


def check(ok, label):
    print(f"{'OK ' if ok else 'BAD'} {label}")
    if not ok:
        failures.append(label)


def session(user, pw):
    s = requests.Session()
    s.post(B + "/api/auth/login", json={"username": user, "password": pw}).raise_for_status()
    return s


def set_python2(admin, on):
    data = admin.get(B + "/api/settings").json()
    body = dict(data["settings"], enablePython2=on, shields={})
    r = admin.post(B + "/api/settings", json=body)
    r.raise_for_status()


admin = session("admin", "admin123")
alice = session("alice", "secret123")

# 1. Default after install: off
check(admin.get(B + "/api/settings").json()["settings"]["enablePython2"] is False, "Python 2 is off by default")
check("python2Installed" in admin.get(B + "/api/settings").json(), "settings report whether python2 is installed")

# 2. An assignment whose problem allows Python 2 and Python 3
defaults = admin.get(B + "/api/assignments/0").json()
check(defaults.get("python2Enabled") is False, "assignment form knows Python 2 is off")
form = dict(name="Py2 check", startTime=time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(time.time() - 3600)),
            finishTime=time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(time.time() + 7200)), extraTime="0",
            participants="ALL", lateRule=defaults["lateRule"], open=True, scoreboard=False, javaexceptions=False, archived=False,
            problems=[dict(name="P", score=100, cTimeLimit=500, pythonTimeLimit=1500, javaTimeLimit=2000, memoryLimit=50000,
                           languages=["Python 2", "Python 3"], diffCmd="diff", diffArg="-bB", isUploadOnly=False)])
aid = admin.post(B + "/api/assignments", files={"data": (None, json.dumps(form))}).json()["id"]
saved = admin.get(B + f"/api/assignments/{aid}").json()["problems"][0]["languages"]
check(saved == ["Python 3"], f"saving while off drops Python 2 (languages: {saved})")

# 3. Turn it on: the form keeps Python 2, the submit page offers it
set_python2(admin, True)
check(admin.get(B + "/api/settings").json()["settings"]["enablePython2"] is True, "Python 2 can be switched on")
admin.post(B + f"/api/assignments/{aid}", files={"data": (None, json.dumps(form))}).raise_for_status()
saved = admin.get(B + f"/api/assignments/{aid}").json()["problems"][0]["languages"]
check(saved == ["Python 2", "Python 3"], f"saving while on keeps Python 2 (languages: {saved})")
alice.post(B + "/api/assignments/select", json={"id": aid}).raise_for_status()
langs = alice.get(B + "/api/submit").json()["problems"][0]["languages"]
check("Python 2" in langs, f"submit page offers Python 2 when on ({langs})")

# 4. Turn it off again: hidden everywhere and refused
set_python2(admin, False)
langs = alice.get(B + "/api/submit").json()["problems"][0]["languages"]
check("Python 2" not in langs, f"submit page hides Python 2 when off ({langs})")
problem = alice.get(B + f"/api/problems/{aid}/1").json()
check("Python 2" not in json.dumps(problem.get("problem", problem)), "problem page hides Python 2 when off")
r = alice.post(B + "/api/submit", files={"problem": (None, "1"), "language": (None, "Python 2"), "file": ("hello.py", PY2.encode())})
check(r.status_code == 400 and "disabled" in r.text, f"Python 2 submission refused when off ({r.status_code})")
r = alice.post(B + "/api/submit/editor", json={"mode": "submit", "problemId": 1, "language": "Python 2", "code": PY2, "input": ""}).json()
check(r.get("status") is False and "disabled" in r.get("message", ""), f"editor refuses Python 2 when off ({r.get('message')})")

# 5. Existing installs without the setting get it with the default (0) on start-up
q = f"{COMPOSE} exec -T db mariadb -uroot -pshj_root -N shj_web -e"
subprocess.run(SSH + [f"{q} \"DELETE FROM shj_settings WHERE shj_key='enable_python2'\""], check=True)
subprocess.run(SSH + [f"{COMPOSE} restart web >/dev/null 2>&1"], check=True)
for _ in range(40):
    try:
        if requests.get(B + "/api/install", timeout=2).ok:
            break
    except requests.RequestException:
        pass
    time.sleep(0.5)
time.sleep(1.5)
out = subprocess.run(SSH + [f"{q} \"SELECT shj_value FROM shj_settings WHERE shj_key='enable_python2'\""], capture_output=True, text=True).stdout.strip()
check(out == "0", f"migration re-creates enable_python2 = 0 (got {out!r})")

print("RESULT:", "PASS" if not failures else f"FAIL ({len(failures)})")
sys.exit(1 if failures else 0)
