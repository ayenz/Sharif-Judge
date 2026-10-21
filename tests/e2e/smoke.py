# Run after tests/regression/run.py (uses its users and assignments): uv run --with requests --with playwright python tests/e2e/smoke.py
import requests, re, sys
B = "http://172.30.30.101:8402"
pages_all = ["/", "/notifications", "/assignments", "/problems", "/problems/1/1", "/problems/1/2", "/submit", "/submit?problem=1",
             "/submissions/final", "/submissions/all", "/submissions/all?user=alice&problem=1", "/scoreboard", "/hall-of-fame", "/profile"]
pages_admin = ["/users", "/users/add", "/settings", "/logs", "/queue", "/rejudge", "/moss/1", "/cheat/1", "/recordings",
               "/assignments/add", "/assignments/1/edit", "/notifications/new", "/problems/1/1/edit", "/profile/3"]
def run(user, pw, pages, expect=200):
    s = requests.Session()
    r = s.post(B + "/api/auth/login", json={"username": user, "password": pw}); r.raise_for_status()
    s.post(B + "/api/assignments/select", json={"id": 1})
    bad = 0
    for p in pages:
        r = s.get(B + p)
        err = re.search(r'"statusCode":(\d+)|__NUXT_ERROR|nuxt-error|Internal Server Error', r.text)
        ok = r.status_code == expect and (expect != 200 or not err)
        if not ok: bad += 1
        print(f"  {'OK ' if ok else 'BAD'} {user:6} {r.status_code} {len(r.content):7}B {p}" + (f"  <{err.group(0)}>" if err and not ok else ""))
    return bad
bad = run("admin", "admin123", pages_all + pages_admin)
bad += run("alice", "secret123", pages_all)
print("student blocked from admin pages (expect 404):")
bad += run("alice", "secret123", pages_admin, expect=404)
print("BAD:", bad); sys.exit(1 if bad else 0)
