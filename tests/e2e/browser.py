# Run after tests/regression/run.py (uses its users and assignments): uv run --with requests --with playwright python tests/e2e/browser.py
import os; os.makedirs("/tmp/sharif-shots", exist_ok=True)
import sys
from playwright.sync_api import sync_playwright
B = "http://172.30.30.101:8402"
admin_pages = ["/", "/notifications", "/assignments", "/problems/1/1", "/submit?problem=1", "/submissions/final", "/submissions/all",
  "/scoreboard", "/hall-of-fame", "/profile", "/users", "/users/add", "/settings", "/logs", "/queue", "/rejudge", "/moss/1",
  "/recordings", "/recordings/1/1/frank", "/assignments/add", "/assignments/1/edit", "/notifications/new", "/problems/1/1/edit"]
problems = []
with sync_playwright() as p:
    br = p.chromium.launch()
    student_pages = ["/", "/notifications", "/assignments", "/problems/1/1", "/submit?problem=1", "/submissions/final", "/submissions/all", "/scoreboard", "/hall-of-fame", "/profile"]
    for user, pw, pages, vp in [("admin", "admin123", admin_pages, (1366, 860)), ("alice", "secret123", student_pages, (390, 844))]:
        ctx = br.new_context(viewport={"width": vp[0], "height": vp[1]})
        page = ctx.new_page()
        errs = []
        page.on("console", lambda m: errs.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
        page.goto(B + "/login"); page.fill("input[autocomplete=username]", user); page.fill("input[type=password]", pw)
        page.click("button[type=submit]"); page.wait_for_url(B + "/")
        for path in pages:
            errs.clear()
            page.goto(B + path, wait_until="networkidle")
            page.wait_for_timeout(700)
            name = path.strip("/").replace("/", "_").replace("?", "_") or "dashboard"
            page.screenshot(path=f"/tmp/sharif-shots/{user}-{name}.png", full_page=False)
            wide = page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
            if wide: errs.append("horizontal page scroll")
            if "submit" in path:
                ace = page.locator(".ace_editor").count()
                if not ace: errs.append("ace editor not rendered")
            print(("OK  " if not errs else "ERR ") + user + " " + path + ("" if not errs else "  " + " | ".join(errs[:3])))
            if errs: problems.append(path)
    br.close()
print("pages with errors:", problems)
sys.exit(1 if problems else 0)
