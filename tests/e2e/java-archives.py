# Java (zip) and JAR submissions: judging, checks, code view, editor refusal, cheat detection.
# Run after tests/regression/run.py: uv run --with requests python tests/e2e/java-archives.py
#
# Zips are built here; JARs are built with the image's javac/jar in the web container (sources
# below), so no binaries live in the repository.
import io
import json
import os
import re
import subprocess
import sys
import tarfile
import time
import zipfile
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import requests

B = os.environ.get("SHJ_URL", "http://172.30.30.101:8402").rstrip("/")  # e.g. http://127.0.0.1:8499/judge
SSH = ["ssh", os.environ.get("SHJ_SSH", "stillmen.dell")]
COMPOSE = os.environ.get("SHJ_COMPOSE", "cd ~/stillmen/sharif-judge/repo/docker && docker compose")
TESTS = [("1 2", "3"), ("5 7", "12"), ("100 200", "300"), ("-4 4", "0"), ("123456 654321", "777777")]
now = datetime.now(ZoneInfo("Asia/Jakarta"))
fmt = "%Y-%m-%d %H:%M:%S"
failures = []

MAIN_APP = """package app;

import java.util.Scanner;
import util.Calc;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        long a = in.nextLong(), b = in.nextLong();
        System.out.println(Calc.add(a, b));
    }
}
"""
CALC = """package util;

public class Calc {
    public static long add(long a, long b) {
        return a + b;
    }
}
"""
NO_PKG_MAIN = """import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        System.out.println(Helper.sum(in.nextLong(), in.nextLong()));
    }
}
"""
NO_PKG_HELPER = """public class Helper {
    static long sum(long a, long b) { return a + b; }
}
"""


def main_class(name, body):
    return f"public class {name} {{\n    public static void main(String[] args) {{\n        {body}\n    }}\n}}\n"


TOOL = main_class("Tool", 'System.out.println("tool");')
ZIPS = {
    "packages": ({"src/app/Main.java": MAIN_APP, "src/util/Calc.java": CALC}, "SCORE", 100, "ACCEPT"),
    "default-package": ({"Main.java": NO_PKG_MAIN, "Helper.java": NO_PKG_HELPER}, "SCORE", 100, "ACCEPT"),
    "two-mains-one-named-Main": ({"Main.java": NO_PKG_MAIN, "Helper.java": NO_PKG_HELPER, "Tool.java": TOOL}, "SCORE", 100, "ACCEPT"),
    "wrong": ({"Main.java": NO_PKG_MAIN.replace("Helper.sum(", "1 + Helper.sum("), "Helper.java": NO_PKG_HELPER}, "SCORE", 0, "WRONG"),
    "ambiguous-mains": ({"A.java": main_class("A", ""), "B.java": main_class("B", "")}, "Compilation Error", 0, "Several classes have a main method: A, B"),
    "no-main": ({"Helper.java": NO_PKG_HELPER}, "Compilation Error", 0, "No class has a main method"),
    "compile-error": ({"Main.java": NO_PKG_MAIN, "Helper.java": NO_PKG_HELPER.replace("a + b", "a + c")}, "Compilation Error", 0, "cannot find symbol"),
    "runtime-error": ({"Main.java": main_class("Main", "int[] x = new int[1]; System.out.println(x[5]);")}, "SCORE", 0, "Runtime Error"),
    "memory": ({"Main.java": main_class("Main", "java.util.List<long[]> k = new java.util.ArrayList<>(); while (true) k.add(new long[1 << 20]);")},
               "SCORE", 0, "Memory Limit Exceeded"),
}

# JAR sources: built in the container by BUILD below.
JAR_SOURCES = {"ok/app/Main.java": MAIN_APP, "ok/util/Calc.java": CALC, "plain/Main.java": NO_PKG_MAIN, "plain/Helper.java": NO_PKG_HELPER}
BUILD = r"""
set -e
javac -d ok/classes ok/app/Main.java ok/util/Calc.java
jar cfe ok.jar app.Main -C ok/classes .
javac -d plain/classes plain/Main.java plain/Helper.java
jar cf no-manifest.jar -C plain/classes .
jar cfe missing-main.jar app.Missing -C ok/classes .
# a class file marked as Java 21 (major version 65)
cp -r ok/classes new && python3 -c "import sys; p='new/app/Main.class'; b=bytearray(open(p,'rb').read()); b[7]=65; open(p,'wb').write(b)"
jar cfe java21.jar app.Main -C new .
"""
JARS = {
    "ok": ("SCORE", 100, "ACCEPT"),
    "no-manifest": ("Compilation Error", 0, "no Main-Class"),
    "missing-main": ("Compilation Error", 0, "The Main-Class app.Missing is not in the JAR file"),
    "java21": ("Compilation Error", 0, "compiled for Java 21, but the judge runs Java 17"),
}


def check(ok, label):
    print(f"{'OK ' if ok else 'BAD'} {label}")
    if not ok:
        failures.append(label)


def session(user, pw="secret123"):
    s = requests.Session()
    s.post(B + "/api/auth/login", json={"username": user, "password": pw}).raise_for_status()
    return s


def make_zip(files):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for name, text in files.items():
            z.writestr(name, text)
    return buf.getvalue()


def build_jars():
    src = io.BytesIO()
    with tarfile.open(fileobj=src, mode="w") as t:
        for name, text in {**JAR_SOURCES, "build.sh": BUILD}.items():
            data = text.encode()
            info = tarfile.TarInfo(name)
            info.size = len(data)
            t.addfile(info, io.BytesIO(data))
    cmd = f"{COMPOSE} exec -T web sh -c 'rm -rf /tmp/jarbuild && mkdir /tmp/jarbuild && cd /tmp/jarbuild && tar x && sh build.sh >&2 && tar c *.jar'"
    out = subprocess.run(SSH + [cmd], input=src.getvalue(), capture_output=True, check=True).stdout
    with tarfile.open(fileobj=io.BytesIO(out)) as t:
        return {m.name[:-4]: t.extractfile(m).read() for m in t.getmembers()}


admin = session("admin", "admin123")
jars = build_jars()
check(set(JARS) <= set(jars), f"JARs built in the container ({sorted(jars)})")

# 1. An assignment that allows both, plus single-file Java for the cheat check
tests = io.BytesIO()
with zipfile.ZipFile(tests, "w") as z:
    for i, (inp, out) in enumerate(TESTS, 1):
        z.writestr(f"p1/in/input{i}.txt", inp + "\n")
        z.writestr(f"p1/out/output{i}.txt", out + "\n")
body = dict(name="Java archives", startTime=(now - timedelta(hours=1)).strftime(fmt), finishTime=(now + timedelta(hours=3)).strftime(fmt),
            extraTime="0", participants="ALL", lateRule=admin.get(B + "/api/assignments/0").json()["lateRule"], open=True, scoreboard=False,
            javaexceptions=False, archived=False,
            problems=[dict(name="Sum", score=100, cTimeLimit=500, pythonTimeLimit=1500, javaTimeLimit=2000, memoryLimit=50000,
                           languages=["Java", "Java (zip)", "JAR"], diffCmd="diff", diffArg="-bB", isUploadOnly=False)])
res = admin.post(B + "/api/assignments", files={"data": (None, json.dumps(body)), "tests_desc": ("t.zip", tests.getvalue(), "application/zip")})
res.raise_for_status()
aid = res.json()["id"]
check(admin.get(B + f"/api/assignments/{aid}").json()["problems"][0]["languages"] == ["Java", "Java (zip)", "JAR"], "problem keeps Java (zip) and JAR")

alice = session("alice")
alice.post(B + "/api/assignments/select", json={"id": aid}).raise_for_status()


def wait_queue(timeout=300):
    start = time.time()
    while time.time() - start < timeout:
        if not admin.get(B + "/api/queue").json()["items"]:
            return
        time.sleep(1)
    raise TimeoutError("queue")


def submit(s, language, filename, data):
    r = s.post(B + "/api/submit", files={"problem": (None, "1"), "language": (None, language), "file": (filename, data)})
    if r.ok:
        wait_queue()
    return r


def view(s, user, submit_id, kind):
    return s.post(B + "/api/submissions/view", json=dict(type=kind, username=user, assignment=aid, problem=1, submitId=submit_id)).json()


def judged(language, filename, data, status, score, text):
    r = submit(alice, language, filename, data)
    if not r.ok:
        check(False, f"{filename}: upload refused ({r.status_code} {r.text[:100]})")
        return None
    sid = r.json()["submitId"]
    item = next(i for i in alice.get(B + "/api/submissions", params={"view": "all"}).json()["items"] if i["submitId"] == sid)
    result = view(alice, "alice", sid, "result")["text"]
    plain = " ".join(re.sub(r"<[^>]+>", " ", result).split())
    check(item["status"] == status and item["preScore"] == score and text in plain,
          f"{filename}: {item['status']} {item['preScore']} (expected {status} {score}, '{text}') {plain[:120]}")
    return sid


# 2. Zips of sources
ids = {}
for name, (files, status, score, text) in ZIPS.items():
    ids[name] = judged("Java (zip)", f"{name}.zip", make_zip(files), status, score, text)

# 3. JARs
for name, (status, score, text) in JARS.items():
    ids[f"jar-{name}"] = judged("JAR", f"{name}.jar", jars[name], status, score, text)

# 4. Refused on upload
for label, language, filename, data, text in [
    ("zip without .java files", "Java (zip)", "notes.zip", make_zip({"readme.txt": "hi"}), "no .java files"),
    ("zip with a path leaving the folder", "Java (zip)", "evil.zip", make_zip({"../Evil.java": "class Evil {}"}), "Unsafe path"),
    ("text file renamed to .jar", "JAR", "fake.jar", b"not a jar", "not a valid JAR"),
    ("zip submitted as JAR without classes", "JAR", "empty.jar", make_zip({"a.txt": "x"}), "no classes"),
]:
    r = submit(alice, language, filename, data)
    check(r.status_code == 400 and text in r.text, f"refused: {label} ({r.status_code} {r.json().get('message', '')[:80] if r.headers.get('content-type', '').startswith('application/json') else ''})")

# The tester's own checks (in case a zip reaches it some other way, e.g. a raised size limit)
def helper(zip_bytes):
    return subprocess.run(SSH + [f"{COMPOSE} exec -T judge sh -c 'rm -rf /tmp/ev && mkdir -p /tmp/ev/a/b && cd /tmp/ev/a/b && cat > s.zip && "
                                 "python3 -I /app/tester/java_archive.py sources s.zip src; echo rc=$? found=$(find /tmp/ev -name Evil.java | wc -l); rm -rf /tmp/ev' 2>&1"],
                          input=zip_bytes, capture_output=True).stdout.decode()


out = helper(make_zip({"../../Evil.java": "class Evil {}"}))
check("rc=1" in out and "found=0" in out and "Unsafe path" in out, f"java_archive.py refuses a path leaving the folder ({' '.join(out.split())[:90]})")
out = helper(make_zip({f"C{i}.java": f"class C{i} {{}}" for i in range(501)}))
check("rc=1" in out and "more than 500" in out, f"java_archive.py refuses more than 500 files ({' '.join(out.split())[:90]})")

# 5. Editor refuses archives; code view shows sources / the class list; download works
r = alice.post(B + "/api/submit/editor", json={"mode": "submit", "problemId": 1, "language": "JAR", "code": "x", "input": ""}).json()
check(r.get("status") is False and "Upload a file" in r.get("message", ""), f"editor refuses JAR ({r.get('message')})")
code = view(alice, "alice", ids["packages"], "code")
check("// ===== src/util/Calc.java =====" in code["text"] and "Calc.add" in code["text"] and code.get("lang") == "java",
      "code view of a zip shows every source file")
code = view(alice, "alice", ids["jar-ok"], "code")
check("Main-Class: app.Main" in code["text"] and "util/Calc.class" in code["text"], "code view of a JAR lists its classes")
dl = alice.get(B + f"/api/submissions/download/alice/{aid}/1/{ids['jar-ok']}")
check(dl.ok and dl.content == jars["ok"], "the JAR can be downloaded unchanged")
bob = session("bob")
check(bob.post(B + "/api/submissions/view", json=dict(type="code", username="alice", assignment=aid, problem=1, submitId=ids["packages"])).status_code == 403,
      "another student cannot see the zip's code")

# 6. Cheat detection: a single-file Java solution and a zip that splits the same code over packages
# (erin and frank: the pair cheat-flow.py already treats as copying, so its history stays as expected)
frank = session("frank")
frank.post(B + "/api/assignments/select", json={"id": aid}).raise_for_status()
submit(frank, "Java (zip)", "project.zip", make_zip(ZIPS["packages"][0]))
erin = session("erin")
erin.post(B + "/api/assignments/select", json={"id": aid}).raise_for_status()
single = MAIN_APP.replace("package app;\n\n", "").replace("import util.Calc;\n", "").replace("Calc.add(a, b)", "add(a, b)").rstrip()[:-1] + \
    "    static long add(long a, long b) {\n        return a + b;\n    }\n}\n"
submit(erin, "Java", "Main.java", single.encode())
dave = session("dave")
dave.post(B + "/api/assignments/select", json={"id": aid}).raise_for_status()
submit(dave, "JAR", "ok.jar", jars["ok"])  # a JAR cannot be compared and must be left out
admin.post(B + f"/api/cheat/{aid}/run", json={"compareAssignments": [], "minTokens": None}).raise_for_status()
for _ in range(120):
    runs = admin.get(B + f"/api/cheat/{aid}").json()["runs"]
    if runs and all(r["status"] in ("done", "failed") for r in runs):
        break
    time.sleep(1)
java_run = next((r for r in runs if r["language"] == "java"), None)
check(java_run is not None and java_run["status"] == "done", f"Java run done ({java_run and (java_run['status'], java_run['submissions'], java_run['error'][:80])})")
pairs = admin.get(B + f"/api/cheat/{aid}/pairs").json()
sim = {frozenset([p["a"]["username"], p["b"]["username"]]): p["similarity"] for p in pairs}
print("  pairs:", {" / ".join(sorted(k)): round(v, 2) for k, v in sim.items()})
check(sim.get(frozenset(["frank", "erin"]), 0) >= 0.7, "a zip and a single Java file with the same code are matched")
check(not any("dave" in k for k in sim), "the JAR is not compared")
if pairs:
    detail = admin.get(B + f"/api/cheat/pairs/{pairs[0]['id']}").json()
    check(bool(detail["codeA"]) and bool(detail["codeB"]), "pair view shows both programs")

print("RESULT:", "PASS" if not failures else f"FAIL ({len(failures)})")
sys.exit(1 if failures else 0)
