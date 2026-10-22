# JavaScript, Go, Kotlin and Swift: judging, limits and "run with input".
# Run after tests/regression/run.py: uv run --with requests python tests/e2e/languages.py
#
# Every program in tests/e2e/languages/ is submitted to a "Sum" problem (5 tests, 50 MB) and
# must get the expected result: accepted, wrong, syntax/compile error, time limit, runtime
# error, memory limit (a growing program and a short burst), a program that fits the limit,
# a Go package that is not in the image's build cache, and Kotlin with main in an object. Then
# "Run" in the editor, and isolation probes like tests/e2e/isolation.py. Swift is optional in the
# image (WITH_SWIFT=1): without it the Swift cases are skipped and the test checks instead that
# Swift is hidden and refused.
import io
import json
import re
import sys
import time
import zipfile
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

B = "http://172.30.30.101:8402"
HERE = Path(__file__).parent / "languages"
TESTS = [("1 2", "3"), ("5 7", "12"), ("100 200", "300"), ("-4 4", "0"), ("123456 654321", "777777")]
now = datetime.now(ZoneInfo("Asia/Jakarta"))
fmt = "%Y-%m-%d %H:%M:%S"
failures = []

# file -> (expected status, expected score in percent, text that must appear in the result)
CASES = {
    "js_ok.js": ("SCORE", 100, "ACCEPT"),
    "js_esm.js": ("SCORE", 100, "ACCEPT"),
    "js_wrong.js": ("SCORE", 0, "WRONG"),
    "js_se.js": ("Syntax Error", 0, "SyntaxError"),
    "js_tle.js": ("SCORE", 0, "Time Limit Exceeded"),
    "js_rte.js": ("SCORE", 0, "Runtime Error"),
    "js_mle_heap.js": ("SCORE", 0, "Memory Limit Exceeded"),
    "js_mle_burst.js": ("SCORE", 0, "Memory Limit Exceeded"),
    "js_fits.js": ("SCORE", 100, "ACCEPT"),
    "go_ok.go": ("SCORE", 100, "ACCEPT"),
    "go_wrong.go": ("SCORE", 0, "WRONG"),
    "go_ce.go": ("Compilation Error", 0, "undefined: c"),
    "go_tle.go": ("SCORE", 0, "Time Limit Exceeded"),
    "go_rte.go": ("SCORE", 0, "Runtime Error"),
    "go_mle.go": ("SCORE", 0, "Memory Limit Exceeded"),
    "go_mle_burst.go": ("SCORE", 0, "Memory Limit Exceeded"),
    "go_fits.go": ("SCORE", 100, "ACCEPT"),
    "go_uncached.go": ("SCORE", 100, "ACCEPT"),
    "kt_ok.kt": ("SCORE", 100, "ACCEPT"),
    "kt_object.kt": ("SCORE", 100, "ACCEPT"),
    "kt_wrong.kt": ("SCORE", 0, "WRONG"),
    "kt_ce.kt": ("Compilation Error", 0, "unresolved reference 'c'"),
    "kt_tle.kt": ("SCORE", 0, "Time Limit Exceeded"),
    "kt_rte.kt": ("SCORE", 0, "Runtime Error"),
    "kt_mle.kt": ("SCORE", 0, "Memory Limit Exceeded"),
    "swift_ok.swift": ("SCORE", 100, "ACCEPT"),
    "swift_foundation.swift": ("SCORE", 100, "ACCEPT"),
    "swift_wrong.swift": ("SCORE", 0, "WRONG"),
    "swift_ce.swift": ("Compilation Error", 0, "cannot find 'missing' in scope"),
    "swift_tle.swift": ("SCORE", 0, "Time Limit Exceeded"),
    "swift_rte.swift": ("SCORE", 0, "Runtime Error"),
    "swift_mle.swift": ("SCORE", 0, "Memory Limit Exceeded"),
    "swift_fits.swift": ("SCORE", 100, "ACCEPT"),
}
LANGUAGE = {".js": "JavaScript", ".go": "Go", ".kt": "Kotlin", ".swift": "Swift"}


def check(ok, label):
    print(f"{'OK ' if ok else 'BAD'} {label}")
    if not ok:
        failures.append(label)


def session(user, pw):
    s = requests.Session()
    s.post(B + "/api/auth/login", json={"username": user, "password": pw}).raise_for_status()
    return s


admin = session("admin", "admin123")

# 1. The languages are offered and saved
defaults = admin.get(B + "/api/assignments/0").json()
swift = "Swift" not in defaults["unavailableLanguages"]
print("Swift installed:", swift)
WANTED = ["Kotlin", "JavaScript", "Go"] + (["Swift"] if swift else [])
tests = io.BytesIO()
with zipfile.ZipFile(tests, "w") as z:
    for i, (inp, out) in enumerate(TESTS, 1):
        z.writestr(f"p1/in/input{i}.txt", inp + "\n")
        z.writestr(f"p1/out/output{i}.txt", out + "\n")
body = dict(name="Languages", startTime=(now - timedelta(hours=1)).strftime(fmt), finishTime=(now + timedelta(hours=3)).strftime(fmt),
            extraTime="0", participants="ALL", lateRule=defaults["lateRule"], open=True, scoreboard=False, javaexceptions=False, archived=False,
            problems=[dict(name="Sum", score=100, cTimeLimit=500, pythonTimeLimit=1500, javaTimeLimit=2000, memoryLimit=50000,
                           languages=["Kotlin", "JavaScript", "Go", "Swift"], diffCmd="diff", diffArg="-bB", isUploadOnly=False)])
res = admin.post(B + "/api/assignments", files={"data": (None, json.dumps(body)), "tests_desc": ("t.zip", tests.getvalue(), "application/zip")})
res.raise_for_status()
aid = res.json()["id"]
saved = admin.get(B + f"/api/assignments/{aid}").json()["problems"][0]["languages"]
check(saved == WANTED, f"problem keeps {', '.join(WANTED)}{'' if swift else ' (Swift dropped: not installed)'} ({saved})")

alice = session("alice", "secret123")
alice.post(B + "/api/assignments/select", json={"id": aid}).raise_for_status()
langs = alice.get(B + "/api/submit").json()["problems"][0]["languages"]
check(langs == WANTED, f"submit page offers {', '.join(WANTED)} ({langs})")
r = alice.post(B + "/api/submit", files={"problem": (None, "1"), "language": (None, "Go"), "file": ("sum.js", b"console.log(1)")})
check(r.status_code == 400, f"a .js file submitted as Go is refused ({r.status_code})")
if not swift:
    # Swift in the stored languages (e.g. an import from a judge that has it) is still refused.
    r = alice.post(B + "/api/submit/editor", json={"mode": "submit", "problemId": 1, "language": "Swift", "code": "print(1)", "input": ""}).json()
    check(r.get("status") is False, f"Swift refused when not installed ({r.get('message')})")
    CASES = {k: v for k, v in CASES.items() if not k.endswith(".swift")}


# 2. Judging
def wait_queue(timeout=300):
    start = time.time()
    while time.time() - start < timeout:
        if not admin.get(B + "/api/queue").json()["items"]:
            return
        time.sleep(1)
    raise TimeoutError("queue")


ids = {}
start = time.time()
for name in CASES:  # one at a time: a student can have only one submission in the queue
    language = LANGUAGE[Path(name).suffix]
    r = alice.post(B + "/api/submit", files={"problem": (None, "1"), "language": (None, language), "file": (name, (HERE / name).read_bytes())})
    r.raise_for_status()
    ids[name] = r.json()["submitId"]
    wait_queue()
print(f"judged {len(CASES)} submissions in {time.time() - start:.0f} s")

items = {i["submitId"]: i for i in alice.get(B + "/api/submissions", params={"view": "all", "page_size": 100}).json()["items"]}
for name, (status, score, text) in CASES.items():
    item = items.get(ids[name])
    if not item:
        check(False, f"{name}: submission {ids[name]} not listed")
        continue
    result = alice.post(B + "/api/submissions/view", json=dict(type="result", username="alice", assignment=aid, problem=1,
                                                               submitId=ids[name])).json()["text"]
    ok = item["status"] == status and item["preScore"] == score and text in result
    plain = re.sub(r"<[^>]+>", " ", result)
    check(ok, f"{name}: {item['status']} {item['preScore']} (expected {status} {score}, '{text}') {' '.join(plain.split())[:110]}")

# The judge logs show how long the builds took.
for name in ("go_ok.go", "kt_ok.kt") + (("swift_ok.swift",) if swift else ()):
    log = admin.post(B + "/api/submissions/view", json=dict(type="log", username="alice", assignment=aid, problem=1, submitId=ids[name])).json()["text"]
    build = [line for line in log.splitlines() if line.startswith("Compiled.")]
    print(f"{name} build:", build[0] if build else "(no log line)")


# 3. Run with input (editor)
def run(language, code, stdin=""):
    for _ in range(20):  # the previous run may still be leaving the queue
        r = alice.post(B + "/api/submit/editor", json={"mode": "execute", "problemId": 1, "language": language, "code": code, "input": stdin}).json()
        if r.get("status") or "queue" not in r.get("message", ""):
            break
        time.sleep(1)
    out = {"content": ""}
    for _ in range(60):
        out = alice.get(B + "/api/submit/editor/1/output").json()
        if out["status"]:
            break
        time.sleep(1)
    return " ".join(out["content"].split())


for language, name in (("JavaScript", "js_ok.js"), ("Go", "go_ok.go"), ("Kotlin", "kt_ok.kt")) + ((("Swift", "swift_ok.swift"),) if swift else ()):
    text = run(language, (HERE / name).read_text(), "40 2")
    check("42" in text, f"{language} run with input prints 42: {text[:100]}")


# 4. Isolation: the same probes as tests/e2e/isolation.py, from JavaScript and Go
ANSWER = "/data/assignments/assignment_1/p1/out/output1.txt"
OTHER = "/data/assignments/assignment_1/p1/bob"
GO_PROBE = """package main
import ("fmt"; "net"; "os"; "strings"; "time")
func main() {
	if b, err := os.ReadFile("%s"); err == nil { fmt.Println("LEAK answer", string(b)) } else { fmt.Println("blocked answer") }
	if e, err := os.ReadDir("%s"); err == nil { fmt.Println("LEAK other", len(e)) } else { fmt.Println("blocked other") }
	if c, err := net.DialTimeout("tcp", "db:3306", 2*time.Second); err == nil { c.Close(); fmt.Println("LEAK db") } else { fmt.Println("blocked db") }
	n := 0
	for _, kv := range os.Environ() { if strings.HasPrefix(kv, "NUXT_") || strings.Contains(kv, "PASSWORD") { n++ } }
	if n > 0 { fmt.Println("LEAK env", n) } else { fmt.Println("blocked env") }
}
""" % (ANSWER, OTHER)
JS_PROBE = """const fs = require('fs')
try { console.log('LEAK answer', fs.readFileSync('%s', 'utf8')) } catch { console.log('blocked answer') }
try { console.log('LEAK other', fs.readdirSync('%s').length) } catch { console.log('blocked other') }
try { require('child_process').execSync('cat %s'); console.log('LEAK via shell') } catch { console.log('blocked shell') }
const env = Object.keys(process.env).filter(k => k.startsWith('NUXT_') || k.includes('PASSWORD'))
console.log(env.length ? 'LEAK env ' + env : 'blocked env')
require('net').connect(3306, 'db').on('connect', () => { console.log('LEAK db'); process.exit() }).on('error', () => console.log('blocked db'))
""" % (ANSWER, OTHER, ANSWER)
KT_PROBE = """import java.io.File
fun main() {
    try { println("LEAK answer " + File("%s").readText()) } catch (e: Throwable) { println("blocked answer") }
    try { println("LEAK other " + File("%s").list()!!.size) } catch (e: Throwable) { println("blocked other") }
    try { java.net.Socket("db", 3306).close(); println("LEAK db") } catch (e: Throwable) { println("blocked db") }
    val env = try { System.getenv().keys.filter { it.startsWith("NUXT_") || it.contains("PASSWORD") } } catch (e: Throwable) { emptyList() }
    println(if (env.isEmpty()) "blocked env" else "LEAK env $env")
}
""" % (ANSWER, OTHER)
SWIFT_PROBE = """import Foundation
if let s = try? String(contentsOfFile: "%s", encoding: .utf8) { print("LEAK answer", s) } else { print("blocked answer") }
if let e = try? FileManager.default.contentsOfDirectory(atPath: "%s") { print("LEAK other", e.count) } else { print("blocked other") }
let env = ProcessInfo.processInfo.environment.keys.filter { $0.hasPrefix("NUXT_") || $0.contains("PASSWORD") }
print(env.isEmpty ? "blocked env" : "LEAK env \\(env)")
""" % (ANSWER, OTHER)
PROBES = [("Go", GO_PROBE, 4), ("JavaScript", JS_PROBE, 5), ("Kotlin", KT_PROBE, 4)] + ([("Swift", SWIFT_PROBE, 3)] if swift else [])
for language, code, probes in PROBES:
    text = run(language, code)
    check("LEAK" not in text and text.count("blocked") == probes, f"{language}: answers, other students' code, database and secrets are blocked: {text[:160]}")

print("RESULT:", "PASS" if not failures else f"FAIL ({len(failures)})")
sys.exit(1 if failures else 0)
