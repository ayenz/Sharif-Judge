#!/bin/bash
# Full test run against the Docker test setup (see tests/README.md).
# WARNING: the regression test deletes all data of both apps on the test server.
#
#   tests/run-all.sh
cd "$(dirname "$0")/.." || exit 1
SSH_HOST=${SSH_HOST:-stillmen.dell}
COMPOSE="cd ~/stillmen/sharif-judge/repo/docker && docker compose"
results=()
failed=0

step() { # name, command...
  local name=$1; shift
  local start=$SECONDS
  printf '\n=== %s\n' "$name"
  if "$@"; then
    results+=("PASS  $name ($((SECONDS - start)) s)")
  else
    results+=("FAIL  $name ($((SECONDS - start)) s)")
    failed=$((failed + 1))
  fi
}

shields() { # 0 or 1
  ssh "$SSH_HOST" "$COMPOSE exec -T db mariadb -uroot -pshj_root shj_web -e \"UPDATE shj_settings SET shj_value=$1 WHERE shj_key IN ('enable_c_shield','enable_py3_shield','enable_java_policy')\""
}
isolation_without_shields() {
  shields 0 && uv run --with requests python tests/e2e/isolation.py
  local rc=$?
  shields 1
  return $rc
}
py() { uv run --with requests python "$@"; }

step "Regression: legacy PHP vs Nuxt" uv run tests/regression/run.py
step "Pages and permissions"           py tests/e2e/smoke.py
step "Security"                        py tests/e2e/security.py
step "Isolation (shields on)"          py tests/e2e/isolation.py
step "Isolation (shields off)"         isolation_without_shields
step "Editor, recording, rejudge"      py tests/e2e/editor-flow.py
step "Live updates"                    py tests/e2e/live.py
step "Python 2 setting"                py tests/e2e/python2.py
step "JavaScript, Go, Kotlin, Swift"   py tests/e2e/languages.py
step "Java zip and JAR"                py tests/e2e/java-archives.py
step "Export and import"               uv run --with requests --with playwright python tests/e2e/export-import.py
step "Cheat detection and history"     py tests/e2e/cheat-flow.py
step "Cloudflare Turnstile"            uv run --with requests --with playwright python tests/e2e/turnstile.py
step "Browser (Chromium)"              uv run --with requests --with playwright python tests/e2e/browser.py

printf '\n=== Summary\n'
printf '%s\n' "${results[@]}"
exit $((failed > 0))
