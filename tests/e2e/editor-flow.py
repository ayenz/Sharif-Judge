# Run after tests/regression/run.py (uses its users and assignments): uv run --with requests --with playwright python tests/e2e/editor-flow.py
import os
import requests, time, json, sys
B = os.environ.get("SHJ_URL", "http://172.30.30.101:8402").rstrip("/")  # e.g. http://127.0.0.1:8499/judge
s = requests.Session(); s.post(B+"/api/auth/login", json={"username":"frank","password":"secret123"}).raise_for_status()
s.post(B+"/api/assignments/select", json={"id":1}).raise_for_status()
code = open(__import__("pathlib").Path(__file__).parent.parent / "regression/corpus/p1_c_ok.c").read()
rec = json.dumps({"1700000000000": {"metrics": {}, "events": [{"time": 5, "event": "insert", "args": {"data": ["x"], "start": {"row":0,"column":0}, "end": {"row":0,"column":1}}}]}})
metrics = {"duration": 1234, "origin": {"inserted": 10, "removed": 2}, "cct": {"score": 1.5}, "debugging": {"input_change": 1, "execute": 1},
           "navigation": {"total_in": 0, "total_out": 0}, "copyPaste": {"max_inserted": 10, "max_removed": 2}}
body = dict(problemId=1, language="C", code=code, input="40 2", recording=rec, metrics=metrics)
print("save   :", s.post(B+"/api/submit/editor", json={**body, "mode":"save"}).json())
print("load   :", {k: (v[:30] if isinstance(v,str) else v) for k,v in s.get(B+"/api/submit/editor/1").json().items()})
print("execute:", s.post(B+"/api/submit/editor", json={**body, "mode":"execute"}).json())
for i in range(60):
    out = s.get(B+"/api/submit/editor/1/output").json()
    if out["status"]: break
    time.sleep(1)
print("output :", repr(out["content"][:200]))
assert "42" in out["content"], "execute output wrong"
print("submit :", s.post(B+"/api/submit/editor", json={**body, "mode":"submit"}).json())
for i in range(60):
    items = s.get(B+"/api/submissions", params={"view":"all"}).json()["items"]
    if items[0]["status"] != "PENDING": break
    time.sleep(1)
print("judged :", items[0]["submitId"], items[0]["status"], items[0]["preScore"], items[0]["finalScore"])
assert items[0]["status"] == "SCORE" and items[0]["finalScore"] == 100
rec_files = None
a = requests.Session(); a.post(B+"/api/auth/login", json={"username":"admin","password":"admin123"}).raise_for_status()
a.post(B+"/api/assignments/select", json={"id":1})
recs = a.get(B+"/api/recordings", params={"user":"frank"}).json()
print("recordings:", json.dumps(recs)[:300])
dl = a.get(B+f"/api/recordings/1/1/frank/{items[0]['submitId']}")
print("rec download:", dl.status_code, dl.text[:80])
print("rejudge problem 2:", a.post(B+"/api/rejudge", json={"problemId":2}).json())
time.sleep(1)
for i in range(60):
    q = a.get(B+"/api/queue").json()
    if not q["items"]: break
    time.sleep(1)
p2 = [i for i in a.get(B+"/api/submissions", params={"view":"all","problem":2}).json()["items"]]
print("after rejudge p2:", [(i["username"], i["status"], i["preScore"]) for i in p2])
assert all(i["status"] != "PENDING" for i in p2)
print("ALL GOOD")
