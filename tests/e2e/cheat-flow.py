# End-to-end test of cheat detection (JPlag) on the deployed app.
# Run after tests/regression/run.py: uv run --with requests python tests/e2e/cheat-flow.py
import io, json, sys, time, zipfile
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
import requests

B = "http://172.30.30.101:8402"
HERE = Path(__file__).parent / "cheat"
now = datetime.now(ZoneInfo("Asia/Jakarta"))
fmt = "%Y-%m-%d %H:%M:%S"

def session(user, pw):
    s = requests.Session(); s.post(B + "/api/auth/login", json={"username": user, "password": pw}).raise_for_status(); return s

admin = session("admin", "admin123")
tests = io.BytesIO()
with zipfile.ZipFile(tests, "w") as z:
    for i, (inp, out) in enumerate([("1 2 3 4", "14"), ("5", "-5"), ("2 2", "8")], 1):
        z.writestr(f"p1/in/input{i}.txt", inp + "\n"); z.writestr(f"p1/out/output{i}.txt", out + "\n")
body = dict(name="Cheat Lab", startTime=(now - timedelta(hours=1)).strftime(fmt), finishTime=(now + timedelta(hours=3)).strftime(fmt),
            extraTime="0", participants="ALL", lateRule=admin.get(B + "/api/assignments/0").json()["lateRule"], open=True, scoreboard=True,
            javaexceptions=False, archived=False,
            problems=[dict(name="Even squares", score=100, cTimeLimit=500, pythonTimeLimit=1500, javaTimeLimit=2000, memoryLimit=50000,
                           languages=["C", "Python 3"], diffCmd="diff", diffArg="-bB", isUploadOnly=False)])
res = admin.post(B + "/api/assignments", files={"data": (None, json.dumps(body)), "tests_desc": ("t.zip", tests.getvalue(), "application/zip")})
res.raise_for_status(); aid = res.json()["id"]; print("assignment", aid)

def wait_queue():
    for _ in range(120):
        if not admin.get(B + "/api/queue").json()["items"]: return
        time.sleep(1)
    raise TimeoutError("queue")

def upload(user, lang, path):
    s = session(user, "secret123"); s.post(B + "/api/assignments/select", json={"id": aid}).raise_for_status()
    r = s.post(B + "/api/submit", files={"problem": (None, "1"), "language": (None, lang), "file": (path.name, path.read_bytes())})
    r.raise_for_status(); wait_queue()

for user, lang, f in [("alice", "Python 3", "alice.py"), ("carol", "Python 3", "carol.py"), ("dave", "Python 3", "dave.py"),
                      ("erin", "C", "erin.c"), ("frank", "C", "frank.c")]:
    upload(user, lang, HERE / f)

# bob writes his copy in the editor: one big paste and many tab switches.
bob = session("bob", "secret123"); bob.post(B + "/api/assignments/select", json={"id": aid})
code = (HERE / "bob.py").read_text()
metrics = {"duration": 95000, "origin": {"inserted": len(code), "removed": 0}, "cct": {"score": 1.0},
           "debugging": {"input_change": 0, "execute": 0}, "navigation": {"total_in": 14, "total_out": 14},
           "copyPaste": {"max_inserted": len(code), "max_removed": 0}}
r = bob.post(B + "/api/submit/editor", json={"mode": "submit", "problemId": 1, "language": "Python 3", "code": code, "input": "",
                                             "recording": "{}", "metrics": metrics}).json()
assert r["status"], r; wait_queue()

# Template code: the main() wrapper everybody was given.
admin.put(B + f"/api/cheat/{aid}/1/basecode", json={"language": "python3", "content": "def main():\n    nums = read_numbers()\n    print(solve(nums))\n\n\nmain()\n"}).raise_for_status()

overview = admin.get(B + f"/api/cheat/{aid}").json()
assert overview["engineAvailable"], "JPlag engine not available"
run = admin.post(B + f"/api/cheat/{aid}/run", json={"compareAssignments": [1], "minTokens": None}).json(); print("runs", run)
for _ in range(180):
    runs = admin.get(B + f"/api/cheat/{aid}").json()["runs"]
    if runs and all(r["status"] in ("done", "failed") for r in runs): break
    time.sleep(1)
for r in runs:
    print(f"  run p{r['problem']} {r['language']}: {r['status']} subs={r['submissions']} comparisons={r['comparisons']} failed={r['failed']} {r['error'][:200]}")
assert all(r["status"] == "done" for r in runs)

pairs = admin.get(B + f"/api/cheat/{aid}/pairs").json()
print("pairs:")
for p in pairs:
    b = p["b"]["username"] + (f" (old: {p['b']['assignmentName']})" if p["b"]["old"] else "")
    print(f"  {p['similarity']*100:5.1f}%  {p['a']['username']:6} <-> {b:30} {p['language']:8} longest={p['longestMatch']}")
sim = {frozenset([p["a"]["username"], p["b"]["username"]]): p["similarity"] for p in pairs if not p["b"]["old"]}
assert sim.get(frozenset(["alice", "bob"]), 0) >= 0.8, "renamed copy not detected"
assert sim.get(frozenset(["alice", "dave"]), 0) >= 0.75, "reordered copy with comments not detected"
assert sim.get(frozenset(["erin", "frank"]), 0) >= 0.8, "C copy not detected"
assert sim.get(frozenset(["alice", "carol"]), 0) < 0.3, "different solution flagged"

detail = admin.get(B + f"/api/cheat/pairs/{pairs[0]['id']}").json()
assert detail["matches"] and detail["codeA"] and detail["codeB"], "pair detail incomplete"
print("pair detail:", detail["a"]["username"], "<->", detail["b"]["username"], "matches", [(m["aStart"], m["aEnd"], m["bStart"], m["bEnd"]) for m in detail["matches"]])

students = admin.get(B + f"/api/cheat/{aid}/students").json()
print("students:")
for s in students:
    print(f"  {s['level']:6} {s['score']:3}  {s['username']:6} sim={s['similarity']}  {s['reasons']}")
bob_row = next(s for s in students if s["username"] == "bob")
assert bob_row["level"] == "high" and any("Pasted" in r for r in bob_row["reasons"]), "paste signal missing for bob"
assert next(s for s in students if s["username"] == "carol")["level"] == "low"

report = admin.get(B + f"/api/cheat/runs/{runs[0]['id']}/report")
assert report.status_code == 200 and report.content[:2] == b"PK", "report download failed"
alice = session("alice", "secret123")
assert alice.get(B + f"/api/cheat/{aid}").status_code == 404, "student can see cheat detection"

# A second assignment where alice and bob copy again: the history must show them as a repeated pair.
body2 = dict(body, name="Cheat Lab 2")
res = admin.post(B + "/api/assignments", files={"data": (None, json.dumps(body2)), "tests_desc": ("t.zip", tests.getvalue(), "application/zip")})
res.raise_for_status(); aid2 = res.json()["id"]
for user, f in [("alice", "alice.py"), ("bob", "bob.py"), ("carol", "carol.py")]:
    s = session(user, "secret123"); s.post(B + "/api/assignments/select", json={"id": aid2}).raise_for_status()
    s.post(B + "/api/submit", files={"problem": (None, "1"), "language": (None, "Python 3"), "file": (f, (HERE / f).read_bytes())}).raise_for_status()
    wait_queue()
admin.post(B + f"/api/cheat/{aid2}/run", json={"compareAssignments": [], "minTokens": None}).raise_for_status()
for _ in range(120):
    runs2 = admin.get(B + f"/api/cheat/{aid2}").json()["runs"]
    if runs2 and all(r["status"] in ("done", "failed") for r in runs2): break
    time.sleep(1)
history = admin.get(B + "/api/cheat/history", params={"min": 0.7}).json()
repeat = [(p["a"]["username"], p["b"]["username"], p["count"]) for p in history["repeatPairs"]]
print("history: analysed", history["analysedAssignments"], "assignments; repeated pairs:", repeat)
assert any({a, b} == {"alice", "bob"} and n >= 2 for a, b, n in repeat), "repeated pair alice/bob missing from history"
assert not any("carol" in (a, b) for a, b, _ in repeat), "carol wrongly in repeated pairs"
print("ALL GOOD")
