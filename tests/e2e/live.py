# Run after tests/regression/run.py: uv run --with requests python tests/e2e/live.py
# Live events (server-sent events): a student gets their own judging results and
# nothing about other students; staff get queue events.
import json
import sys
import threading
import time
from pathlib import Path

import requests

B = "http://172.30.30.101:8402"
CODE = (Path(__file__).parent.parent / "regression/corpus/p1_c_ok.c").read_bytes()


def session(user, pw):
    s = requests.Session()
    s.post(B + "/api/auth/login", json={"username": user, "password": pw}).raise_for_status()
    s.post(B + "/api/assignments/select", json={"id": 1}).raise_for_status()
    return s


def listen(s, events, stop):
    with s.get(B + "/api/events", stream=True, timeout=60) as r:
        name = None
        for raw in r.iter_lines(decode_unicode=True):
            if stop.is_set():
                return
            if raw.startswith("event:"):
                name = raw[6:].strip()
            elif raw.startswith("data:") and name not in (None, "ping"):
                events.append((name, json.loads(raw[5:])))


alice, bob, admin = session("alice", "secret123"), session("bob", "secret123"), session("admin", "admin123")
streams = {name: [] for name in ("alice", "admin")}
stop = threading.Event()
for name, s in (("alice", alice), ("admin", admin)):
    threading.Thread(target=listen, args=(s, streams[name], stop), daemon=True).start()
time.sleep(1.5)

started = time.time()
for user in (alice, bob):
    user.post(B + "/api/submit", files={"problem": (None, "1"), "language": (None, "C"), "file": ("live-test.c", CODE)}).raise_for_status()
deadline = time.time() + 60
while time.time() < deadline and sum(1 for n, e in streams["admin"] if n == "judged") < 2:
    time.sleep(0.2)
stop.set()

alice_judged = [e for n, e in streams["alice"] if n == "judged"]
admin_judged = [e for n, e in streams["admin"] if n == "judged"]
admin_queue = [e for n, e in streams["admin"] if n == "queue"]
print("alice got  :", [(e["username"], e["submitId"], e["status"], e["preScore"]) for e in alice_judged])
print("admin got  :", [(e["username"], e["submitId"], e["status"]) for e in admin_judged], f"+ {len(admin_queue)} queue events")
print(f"first result after {round(time.time() - started, 1)} s total wait")
ok = (len(alice_judged) == 1 and alice_judged[0]["username"] == "alice" and alice_judged[0]["preScore"] == 10000
      and {e["username"] for e in admin_judged} == {"alice", "bob"} and admin_queue
      and not any(n == "queue" for n, _ in streams["alice"]))
print("RESULT:", "PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
