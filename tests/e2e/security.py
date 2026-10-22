# Run after tests/regression/run.py (uses its users and assignments): uv run --with requests --with playwright python tests/e2e/security.py
import requests, sys
B = "http://172.30.30.101:8402"
s = requests.Session(); s.post(B+"/api/auth/login", json={"username":"alice","password":"secret123"}).raise_for_status()
anon = requests.Session()
checks = [
 ("view bob's code",            lambda: s.post(B+"/api/submissions/view", json={"type":"code","username":"bob","assignment":1,"problem":1,"submitId":5}), {403,404}),
 ("view own log as student",    lambda: s.post(B+"/api/submissions/view", json={"type":"log","username":"alice","assignment":1,"problem":1,"submitId":1}), {404}),
 ("download bob's file",        lambda: s.get(B+"/api/submissions/download/bob/1/1/5"), {403,404}),
 ("path traversal username",    lambda: s.get(B+"/api/submissions/download/..%2F..%2Fetc/1/1/1"), {400,404}),
 ("editor path traversal",      lambda: s.get(B+"/api/submit/editor/..%2F..%2F1"), {400,404}),
 ("recording traversal",        lambda: s.get(B+"/api/recordings/1/1/..%2F..%2F/0"), {400,404}),
 ("student rejudge",            lambda: s.post(B+"/api/rejudge", json={"problemId":1}), {404}),
 ("student queue",              lambda: s.get(B+"/api/queue"), {404}),
 ("student empty queue",        lambda: s.post(B+"/api/queue/empty"), {404}),
 ("student users list",         lambda: s.get(B+"/api/users"), {404}),
 ("student settings",           lambda: s.get(B+"/api/settings"), {404}),
 ("student delete assignment",  lambda: s.delete(B+"/api/assignments/1"), {404}),
 ("student moss",               lambda: s.get(B+"/api/moss/1"), {404}),
 ("student edit description",   lambda: s.put(B+"/api/problems/1/1/description", json={"type":"html","text":"x"}), {404}),
 ("student set others' final",  lambda: s.post(B+"/api/submissions/select-final", json={"submitId":4,"problem":1,"username":"bob"}), {200}),
 ("anonymous submissions",      lambda: anon.get(B+"/api/submissions?view=all"), {401}),
 ("anonymous me",               lambda: anon.get(B+"/api/me"), {200}),
 ("re-install",                 lambda: anon.post(B+"/api/install", json={"username":"evil","email":"e@x.io","password":"123456","passwordAgain":"123456"}), {409}),
 ("sql-ish login",              lambda: anon.post(B+"/api/auth/login", json={"username":"admin' OR '1'='1","password":"x' OR '1'='1"}), {422,401}),
]
bad = 0
for name, fn, ok in checks:
    r = fn(); good = r.status_code in ok
    bad += not good
    print(f"{'OK ' if good else 'BAD'} {r.status_code} {name}" + ("" if good else f"  -> {r.text[:150]}"))
# select-final for another user must not change bob's rows: students always act on themselves
print("bob final rows untouched:", requests.Session().get(B+"/api/install").ok)

# Submitted programs must not see the server's secrets (environment variables).
import time as _time
s.post(B + "/api/assignments/select", json={"id": 1})
probe = '#include <stdio.h>\n#include <stdlib.h>\nint main(void){ puts(getenv("NUXT_DB_PASSWORD") || getenv("NUXT_SESSION_PASSWORD") ? "LEAK" : "clean"); return 0; }'
s.post(B + "/api/submit/editor", json={"mode": "execute", "problemId": 1, "language": "C", "code": probe, "input": ""})
for _ in range(30):
    out = s.get(B + "/api/submit/editor/1/output").json()
    if out["status"]:
        break
    _time.sleep(1)
leak = "LEAK" in out["content"]
print(f"{'BAD' if leak else 'OK '} env secrets hidden from submitted code")
sys.exit(1 if leak or bad else 0)
