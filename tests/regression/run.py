# /// script
# requires-python = ">=3.11"
# dependencies = ["requests>=2.32", "openpyxl>=3.1"]
# ///
"""
Behavioral regression test: legacy CodeIgniter app vs. the Nuxt rewrite.

Both apps are reset, given the same users, assignments and test cases, and receive
the same submissions in the same order. Then the judged results (status, score,
late coefficient, final flag), scoreboard ranking, Hall of Fame and Excel exports
are compared. The apps run with Docker on a remote host reached over SSH.

    uv run tests/regression/run.py            # full run
    uv run tests/regression/run.py --only web # just exercise the new app

SHJ_URL, SHJ_SSH and SHJ_COMPOSE point it at another stack (see below).
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import io
import json
import os
import re
import subprocess
import sys
import time
import zipfile
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import openpyxl
import requests

HERE = Path(__file__).parent
CORPUS = HERE / "corpus"
SSH_HOST = os.environ.get("SHJ_SSH", "stillmen.dell")
HOST_IP = "172.30.30.101"
# Another test stack (with --only web): SHJ_URL=http://127.0.0.1:8499/judge SHJ_SSH=<host>
# SHJ_COMPOSE="cd ~/shj-test/docker && docker compose -p shj-test"
COMPOSE = os.environ.get("SHJ_COMPOSE", "cd ~/stillmen/sharif-judge/repo/docker && docker compose")
LEGACY_URL = f"http://{HOST_IP}:8401"
WEB_URL = os.environ.get("SHJ_URL", f"http://{HOST_IP}:8402").rstrip("/")
TZ = ZoneInfo("Asia/Jakarta")
ADMIN = ("admin", "admin123")
STUDENT_PASSWORD = "secret123"

# ---------------------------------------------------------------------------
# Scenario

STUDENTS = ["alice", "bob", "carol", "dave", "erin", "frank"]

P1_TESTS = [("1 2", "3"), ("5 7", "12"), ("100 200", "300"), ("-4 4", "0"), ("123456 654321", "777777")]
P2_TESTS = [("abc", "cba"), ("hello world", "dlrow olleh"), ("x", "x")]

PROBLEM_DEFAULTS = dict(c_time_limit=500, python_time_limit=1500, java_time_limit=2000,
                        memory_limit=50000, diff_cmd="diff", diff_arg="-bB")


def problems_spec():
    return [
        dict(name="Sum", score=100, languages="C,C++,Java,Python 3", upload_only=False, **PROBLEM_DEFAULTS),
        dict(name="Reverse", score=50, languages="C,Python 3", upload_only=False, **PROBLEM_DEFAULTS),
        dict(name="Essay", score=20, languages="TXT,PDF", upload_only=True, **PROBLEM_DEFAULTS),
    ]


# (student, assignment index, problem, language, corpus file, expected status)
# Submissions run in this order; each one waits for the queue to drain first.
SUBMISSIONS = [
    ("alice", 0, 1, "C", "p1_c_ok.c", "SCORE"),
    ("alice", 0, 2, "C", "p2_c_ok.c", "SCORE"),
    ("alice", 0, 3, "TXT", "p3_upload.txt", "Uploaded"),
    ("bob", 0, 1, "C", "p1_c_wrong.c", "SCORE"),
    ("bob", 0, 1, "C++", "p1_cpp_ok.cpp", "SCORE"),
    ("bob", 0, 2, "Python 3", "p2_py3_partial.py", "SCORE"),
    ("carol", 0, 1, "C", "p1_c_partial.c", "SCORE"),
    ("carol", 0, 1, "C", "p1_c_ce.c", "Compilation Error"),
    ("carol", 0, 1, "Java", "p1_java_ok.java", "SCORE"),
    ("dave", 0, 1, "C", "p1_c_tle.c", "SCORE"),
    ("dave", 0, 1, "C", "p1_c_rte.c", "SCORE"),
    ("dave", 0, 1, "Python 3", "p1_py3_se.py", "Syntax Error"),
    ("dave", 0, 1, "Python 3", "p1_py3_ok.py", "SCORE"),
    ("erin", 0, 1, "Java", "p1_java_wrong.java", "SCORE"),
    ("erin", 0, 1, "Java", "p1_java_rte.java", "SCORE"),
    ("erin", 0, 1, "Python 3", "p1_py3_rte.py", "SCORE"),
    ("frank", 0, 1, "C", "p1_c_shield.c", "Compilation Error"),
    # Late assignment: finished 3 hours ago, coefficient must follow the late rule (70).
    ("alice", 1, 1, "C", "p1_c_ok.c", "SCORE"),
    ("bob", 1, 1, "Python 3", "p1_py3_ok.py", "SCORE"),
]


def assignments_spec(now: datetime):
    fmt = "%Y-%m-%d %H:%M:%S"
    return [
        dict(name="Regression Open", start=(now - timedelta(hours=1)).strftime(fmt),
             finish=(now + timedelta(hours=2)).strftime(fmt), extra="48*60", scoreboard=True),
        dict(name="Regression Late", start=(now - timedelta(days=1)).strftime(fmt),
             finish=(now - timedelta(hours=3)).strftime(fmt), extra="48*60", scoreboard=True),
    ]


def tests_zip() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for p, tests in ((1, P1_TESTS), (2, P2_TESTS)):
            for i, (inp, out) in enumerate(tests, 1):
                z.writestr(f"p{p}/in/input{i}.txt", inp + "\n")
                z.writestr(f"p{p}/out/output{i}.txt", out + "\n")
        z.writestr("p1/desc.md", "# Sum\n\nRead two integers and print their sum.\n")
        z.writestr("p2/desc.html", "<p>Reverse the line.</p>")
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Remote helpers

def ssh(cmd: str, check=True) -> str:
    r = subprocess.run(["ssh", SSH_HOST, cmd], capture_output=True, text=True)
    if check and r.returncode != 0:
        raise RuntimeError(f"ssh failed: {cmd}\n{r.stderr}")
    return r.stdout


def sql(db: str, query: str) -> list[list[str]]:
    q = query.replace('"', '\\"')
    out = ssh(f'{COMPOSE} exec -T db mariadb -uroot -pshj_root -N -B {db} -e "{q}"')
    return [line.split("\t") for line in out.splitlines() if line]


def reset_databases(legacy=True):
    for db in ("shj_ci3", "shj_web") if legacy else ("shj_web",):
        ssh(f'{COMPOSE} exec -T db mariadb -uroot -pshj_root -e '
            f'"DROP DATABASE IF EXISTS {db}; CREATE DATABASE {db} CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;"')
    if legacy:
        ssh("rm -rf ~/stillmen/sharif-judge/ci3/restricted/assignments/* ~/stillmen/sharif-judge/ci3/application/cache/Twig/*")
    ssh(f"{COMPOSE} exec -T web sh -c 'rm -rf /data/assignments/*'")
    # Restart the web app so no worker state or cached connections survive the reset.
    ssh(f"{COMPOSE} restart web >/dev/null 2>&1")
    for _ in range(30):
        try:
            if requests.get(f"{WEB_URL}/api/install", timeout=2).ok:
                return
        except requests.RequestException:
            pass
        time.sleep(1)
    raise RuntimeError("web app did not come back")


# ---------------------------------------------------------------------------
# Clients

class LegacyClient:
    """Drives the CodeIgniter app through its HTML forms (CSRF token in every form)."""
    name = "legacy"
    db = "shj_ci3"

    def __init__(self):
        self.s = requests.Session()

    def token(self, path: str) -> str:
        html = self.s.get(LEGACY_URL + path).text
        m = re.search(r'name="shj_csrf_token" value="([^"]+)"', html)
        if m:
            return m.group(1)
        return self.s.cookies.get("shjcsrftoken", "")

    def post(self, path: str, data=None, files=None, ajax=False, token_from=None):
        data = dict(data or {})
        data["shj_csrf_token"] = self.token(token_from or path) if not ajax else self.s.cookies.get("shjcsrftoken")
        headers = {"X-Requested-With": "XMLHttpRequest"} if ajax else {}
        return self.s.post(LEGACY_URL + path, data=data, files=files, headers=headers)

    def install(self):
        r = self.post("/install", dict(username=ADMIN[0], email="admin@example.com", password=ADMIN[1], password_again=ADMIN[1]))
        assert "installed" in r.text.lower(), r.text[:500]

    def login(self, username, password):
        self.s = requests.Session()
        r = self.post("/login", dict(username=username, password=password))
        assert "logout" in r.text.lower() or r.url.rstrip("/").endswith(str(HOST_IP) + ":8401"), f"legacy login failed for {username}"

    def add_users(self, text: str):
        self.token("/users/add")
        r = self.post("/users/add", dict(new_users=text, delay="0"), ajax=True)
        assert r.ok, r.text[:300]

    def add_assignment(self, a: dict, problems: list[dict], zip_bytes: bytes):
        data: list[tuple[str, str]] = [
            ("assignment_name", a["name"]), ("start_time", a["start"]), ("finish_time", a["finish"]),
            ("extra_time", a["extra"]), ("participants", "ALL"), ("late_rule", self.default_late_rule()),
            ("open", "1"), ("number_of_problems", str(len(problems))),
        ]
        if a["scoreboard"]:
            data.append(("scoreboard", "1"))
        for i, p in enumerate(problems, 1):
            data += [("name[]", p["name"]), ("score[]", str(p["score"])), ("c_time_limit[]", str(p["c_time_limit"])),
                     ("python_time_limit[]", str(p["python_time_limit"])), ("java_time_limit[]", str(p["java_time_limit"])),
                     ("memory_limit[]", str(p["memory_limit"])), ("languages[]", p["languages"]),
                     ("diff_cmd[]", p["diff_cmd"]), ("diff_arg[]", p["diff_arg"])]
            if p["upload_only"]:
                data.append(("is_upload_only[]", str(i)))
        data.append(("shj_csrf_token", self.token("/assignments/add")))
        files = {"tests_desc": ("tests.zip", zip_bytes, "application/zip"), "pdf": ("", b"", "application/octet-stream")}
        r = self.s.post(LEGACY_URL + "/assignments/add", data=data, files=files)
        assert "successfully" in r.text, r.text[:800]

    _late_rule = None

    def default_late_rule(self):
        if LegacyClient._late_rule is None:
            LegacyClient._late_rule = sql(self.db, "SELECT shj_value FROM shj_settings WHERE shj_key='default_late_rule'")
            LegacyClient._late_rule = "\n".join("\t".join(r) for r in LegacyClient._late_rule).replace("\\n", "\n")
        return LegacyClient._late_rule

    def select_assignment(self, aid: int):
        self.token("/assignments")
        r = self.post("/assignments/select", dict(assignment_select=str(aid)), ajax=True)
        assert r.json().get("done") == 1, r.text

    def submit(self, problem: int, language: str, filename: str, content: bytes):
        r = self.post("/submit", dict(problem=str(problem), language=language),
                      files={"userfile": (filename, content)}, token_from="/submit")
        assert "submissions/all" in r.url or r.history, "legacy submit failed: " + re.sub(r"<[^>]+>|\s+", " ", r.text.split("<body>")[-1])[:300]

    def scoreboard(self) -> list[tuple[str, int]]:
        html = self.s.get(LEGACY_URL + "/scoreboard").text
        rows = re.findall(r"<tr>\s*<td>(\d+)</td>\s*<td>([^<]+)</td>.*?<span style=\"font-weight: bold;\">(-?\d+)</span>", html, re.S)
        return [(u.strip(), int(t)) for _, u, t in rows]

    def hall_of_fame(self) -> list[tuple[str, int]]:
        rows = sql(self.db, "SELECT username, CEILING(SUM(pre_score*coefficient/10000)) t FROM shj_submissions "
                            "WHERE is_final=1 AND file_type NOT IN ('txt','pdf','zip') GROUP BY username ORDER BY t DESC, username")
        return [(u, int(float(t))) for u, t in rows]

    def excel(self, view: str) -> bytes:
        return self.s.get(f"{LEGACY_URL}/submissions/{view}_excel").content


class WebClient:
    """Drives the Nuxt app through its JSON API."""
    name = "web"
    db = "shj_web"

    def __init__(self):
        self.s = requests.Session()

    def call(self, method, path, **kw):
        r = self.s.request(method, WEB_URL + path, **kw)
        if not r.ok:
            raise AssertionError(f"{method} {path} -> {r.status_code}: {r.text[:500]}")
        return r

    def install(self):
        self.call("POST", "/api/install", json=dict(username=ADMIN[0], email="admin@example.com", password=ADMIN[1], passwordAgain=ADMIN[1]))

    def login(self, username, password):
        self.s = requests.Session()
        self.call("POST", "/api/auth/login", json=dict(username=username, password=password))

    def add_users(self, text: str):
        res = self.call("POST", "/api/users/add", json=dict(newUsers=text)).json()
        assert not res["errors"], res["errors"]

    def add_assignment(self, a: dict, problems: list[dict], zip_bytes: bytes):
        defaults = self.call("GET", "/api/assignments/0").json()
        late_rule = defaults.get("lateRule") or defaults.get("assignment", {}).get("lateRule")
        body = dict(
            name=a["name"], startTime=a["start"], finishTime=a["finish"], extraTime=a["extra"], participants="ALL",
            lateRule=late_rule, open=True, scoreboard=a["scoreboard"], javaexceptions=False, archived=False,
            problems=[dict(name=p["name"], score=p["score"], cTimeLimit=p["c_time_limit"], pythonTimeLimit=p["python_time_limit"],
                           javaTimeLimit=p["java_time_limit"], memoryLimit=p["memory_limit"], languages=p["languages"].split(","),
                           diffCmd=p["diff_cmd"], diffArg=p["diff_arg"], isUploadOnly=p["upload_only"]) for p in problems],
        )
        files = {"data": (None, json.dumps(body)), "tests_desc": ("tests.zip", zip_bytes, "application/zip")}
        res = self.call("POST", "/api/assignments", files=files).json()
        errors = [m for m in res.get("messages", []) if m["type"] == "error"]
        assert not errors, errors

    def select_assignment(self, aid: int):
        self.call("POST", "/api/assignments/select", json=dict(id=aid))

    def submit(self, problem: int, language: str, filename: str, content: bytes):
        self.call("POST", "/api/submit", files={"problem": (None, str(problem)), "language": (None, language), "file": (filename, content)})

    def scoreboard(self) -> list[tuple[str, int]]:
        data = self.call("GET", "/api/scoreboard").json()
        return [(r["username"], r["total"]) for r in data["scoreboard"]["rows"]]

    def hall_of_fame(self) -> list[tuple[str, int]]:
        return [(r["username"], r["totalScore"]) for r in self.call("GET", "/api/hall-of-fame").json()]

    def excel(self, view: str) -> bytes:
        return self.call("GET", f"/api/submissions/excel?view={view}").content


# ---------------------------------------------------------------------------
# Run

def wait_queue(client, timeout=180):
    start = time.time()
    while time.time() - start < timeout:
        n = int(sql(client.db, "SELECT COUNT(*) FROM shj_queue")[0][0])
        pending = int(sql(client.db, "SELECT COUNT(*) FROM shj_submissions WHERE status='PENDING'")[0][0])
        if n == 0 and pending == 0:
            return
        time.sleep(1)
    raise TimeoutError(f"{client.name}: queue did not drain")


def run_scenario(client, now: datetime) -> dict:
    t0 = time.time()
    client.install()
    client.login(*ADMIN)
    users = "\n".join(f"{u},{u}@example.com,{u.title()} Student,{STUDENT_PASSWORD},student" for u in STUDENTS)
    client.add_users(users)
    zip_bytes = tests_zip()
    for a in assignments_spec(now):
        client.add_assignment(a, problems_spec(), zip_bytes)

    sessions: dict[str, object] = {}
    for user, a_idx, problem, lang, fname, _ in SUBMISSIONS:
        c = sessions.get(user)
        if c is None:
            c = type(client)()
            c.login(user, STUDENT_PASSWORD)
            sessions[user] = c
        c.select_assignment(a_idx + 1)
        wait_queue(client)
        c.submit(problem, lang, main_name(fname), (CORPUS / fname).read_bytes())
    wait_queue(client)

    client.select_assignment(1)
    result = {
        "submissions": sql(client.db, "SELECT assignment, submit_id, username, problem, is_final, status, pre_score, "
                                       "coefficient, file_type, main_file_name, file_name FROM shj_submissions "
                                       "ORDER BY assignment, submit_id"),
        "scoreboard": client.scoreboard(),
        "hall_of_fame": client.hall_of_fame(),
        "excel_final": excel_rows(client.excel("final")),
        "excel_all": excel_rows(client.excel("all")),
        "seconds": round(time.time() - t0, 1),
    }
    return result


def main_name(fname: str) -> str:
    """Upload name for a corpus file: Java needs the public class name."""
    if fname.endswith(".java"):
        return "Sum.java"
    stem, ext = fname.rsplit(".", 1)
    return f"{stem.replace('_', '-')}.{ext}"


VOLATILE_HEADERS = {"Submit Time", "Delay (HH:MM)"}


def excel_rows(data: bytes) -> list[list[str]]:
    """Excel rows with time-dependent cells blanked."""
    wb = openpyxl.load_workbook(io.BytesIO(data))
    ws = wb.active
    rows = [[("" if c is None else str(c)) for c in r] for r in ws.iter_rows(values_only=True)]
    header_i = next(i for i, r in enumerate(rows) if r and r[0] in ("Final", "#1"))
    header = rows[header_i]
    out = [header]
    for r in rows[header_i + 1:]:
        if not any(r):
            continue
        out.append(["*" if header[i] in VOLATILE_HEADERS else v.rstrip("0").rstrip(".") if re.fullmatch(r"\d+\.0+", v) else v
                    for i, v in enumerate(r)])
    meta = [r[:2] for r in rows[:header_i] if r and r[0] and r[0] != "Time:"]
    return meta + out


def expected_check(result: dict) -> list[str]:
    """Statuses must match the corpus expectations (independent of the other app)."""
    problems = []
    subs = [r for r in result["submissions"] if r[1] != "0"]
    for (user, a_idx, problem, lang, fname, expected), row in zip(SUBMISSIONS, subs):
        if row[2] != user or int(row[3]) != problem or row[5] != expected:
            problems.append(f"{fname} by {user}: got status {row[5]!r} (expected {expected!r})")
    late = [r for r in subs if r[0] == "2"]
    for r in late:
        if r[7] != "70":
            problems.append(f"late submission {r[1]} has coefficient {r[7]} (expected 70)")
    return problems


def compare(a: dict, b: dict) -> list[str]:
    diffs = []
    for key in ("submissions", "scoreboard", "hall_of_fame", "excel_final", "excel_all"):
        if a[key] != b[key]:
            diffs.append(key)
            la, lb = a[key], b[key]
            for i in range(max(len(la), len(lb))):
                x = la[i] if i < len(la) else None
                y = lb[i] if i < len(lb) else None
                if x != y:
                    diffs.append(f"  [{i}] legacy={x}\n       web   ={y}")
    return diffs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=["legacy", "web"])
    ap.add_argument("--no-reset", action="store_true")
    args = ap.parse_args()

    if not args.no_reset:
        print("Resetting databases and assignment folders…")
        reset_databases(legacy=args.only != "web")
    now = datetime.now(TZ).replace(microsecond=0)
    clients = [c for c in (LegacyClient(), WebClient()) if not args.only or c.name == args.only]

    with cf.ThreadPoolExecutor() as pool:
        futures = {c.name: pool.submit(run_scenario, c, now) for c in clients}
        results = {}
        for name, fut in futures.items():
            results[name] = fut.result()
            print(f"{name}: scenario finished in {results[name]['seconds']} s")

    ok = True
    for name, res in results.items():
        problems = expected_check(res)
        print(f"\n== {name}: {len(res['submissions'])} submissions")
        for row in res["submissions"]:
            print("   ", " | ".join(row))
        print("   scoreboard:", res["scoreboard"])
        print("   hall of fame:", res["hall_of_fame"])
        if problems:
            ok = False
            print(f"   EXPECTATION FAILURES ({name}):")
            for p in problems:
                print("    -", p)

    if len(results) == 2:
        diffs = compare(results["legacy"], results["web"])
        print("\n== legacy vs web")
        if diffs:
            ok = False
            print("\n".join(diffs))
        else:
            print("   identical: submissions, scoreboard, hall of fame, excel exports")

    print("\nRESULT:", "PASS" if ok else "FAIL")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
