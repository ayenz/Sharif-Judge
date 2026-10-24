# Run after tests/regression/run.py: uv run --with requests python tests/e2e/isolation.py
#
# Submitted code tries to read expected outputs, other students' code and server
# secrets, and to reach the network. Every probe must print "blocked". Run it once
# with the shields off (Settings) too: the container isolation must hold on its own.
import os
import sys
import time

import requests

B = os.environ.get("SHJ_URL", "http://172.30.30.101:8402").rstrip("/")  # e.g. http://127.0.0.1:8499/judge
ANSWER = "/data/assignments/assignment_1/p1/out/output1.txt"
OTHER = "/data/assignments/assignment_1/p1/alice/p1-c-ok-1.c"

PROBES = {
    "C: #include an expected output at compile time": ("C", f'''
#include <stdio.h>
int main(void) {{ int x =
#include "{ANSWER}"
; printf("LEAK %d\\n", x); return 0; }}'''),
    "C: read another student's code at run time": ("C", f'''
#include <stdio.h>
int main(void) {{ FILE *f = fopen("{OTHER}", "r"); puts(f ? "LEAK" : "blocked"); return 0; }}'''),
    "Python: read an expected output": ("Python 3", f'''
try:
    print("LEAK", open("{ANSWER}").read().strip())
except Exception as e:
    print("blocked", type(e).__name__)'''),
    "Python: read another student's code": ("Python 3", f'''
try:
    print("LEAK", len(open("{OTHER}").read()))
except Exception as e:
    print("blocked", type(e).__name__)'''),
    "Python: list the assignments folder": ("Python 3", '''
try:
    import os
    print("LEAK", os.listdir("/data/assignments/assignment_1"))
except Exception as e:
    print("blocked", type(e).__name__)'''),
    "Python: connect to the database": ("Python 3", '''
try:
    import socket
    socket.create_connection(("db", 3306), timeout=2)
    print("LEAK connected")
except Exception as e:
    print("blocked", type(e).__name__)'''),
    "Python: read server secrets from the environment": ("Python 3", '''
try:
    import os
    v = [k for k in os.environ if k.startswith("NUXT_")]
    print("LEAK" if v else "blocked", v)
except Exception as e:
    print("blocked", type(e).__name__)'''),
    "Java: read an expected output": ("Java", f'''
import java.nio.file.*;
public class Main {{ public static void main(String[] a) {{
  try {{ System.out.println("LEAK " + new String(Files.readAllBytes(Paths.get("{ANSWER}")))); }}
  catch (Throwable e) {{ System.out.println("blocked " + e.getClass().getSimpleName()); }}
}} }}'''),
}

s = requests.Session()
s.post(B + "/api/auth/login", json={"username": "frank", "password": "secret123"}).raise_for_status()
s.post(B + "/api/assignments/select", json={"id": 1}).raise_for_status()

bad = 0
for name, (language, code) in PROBES.items():
    for _ in range(20):  # the previous run may still be leaving the queue
        r = s.post(B + "/api/submit/editor", json={"mode": "execute", "problemId": 1, "language": language, "code": code, "input": ""}).json()
        if r.get("status") or "queue" not in r.get("message", ""):
            break
        time.sleep(1)
    if not r.get("status"):
        print("ERR", name, r)
        bad += 1
        continue
    out = {"content": ""}
    for _ in range(60):
        out = s.get(B + "/api/submit/editor/1/output").json()
        if out["status"]:
            break
        time.sleep(1)
    text = out["content"].replace("\n", " ").strip()
    leaked = "LEAK" in text
    bad += leaked
    print(f"{'BAD' if leaked else 'OK '} {name}: {text[:150]}")

print("leaks:", bad)
sys.exit(1 if bad else 0)
