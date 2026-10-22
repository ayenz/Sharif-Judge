# Troubleshooting

Start with the logs:

```bash
cd Sharif-Judge/docker
docker compose ps                  # are db, web, judge, backup running?
docker compose logs --tail 50 web
docker compose logs --tail 50 judge
```

| Symptom | Cause and fix |
|---|---|
| Submissions stay `PENDING` | The `judge` service is not running: `docker compose up -d judge`. Check Tools > Queue is not paused. |
| Every submission is `Judge Error` | See `docker compose logs judge`. After a migration, check the folders in Settings > General. |
| Dashboard: folder not found / not writable | Settings > General paths must be `/app/tester` and `/data/assignments` in Docker; the assignments folder must belong to uid 1000. |
| Dashboard: backup warning | Settings > Backups shows the reason; `docker compose up -d backup` if the service is stopped. |
| "Too many failed sign-in attempts" | Wait 15 minutes, or restart `web` (the counters are in memory). Behind a proxy, set `NUXT_TRUST_PROXY=true`. |
| Everybody is signed out | `NUXT_SESSION_PASSWORD` changed, or the cookie is `secure` without HTTPS (`NUXT_SESSION_COOKIE_SECURE`). |
| No password-reset mails | Set `NUXT_MAIL_*`; the `web` log shows "SMTP is not configured" or the mail error. |
| RADIUS users cannot sign in | `docker compose logs web \| grep auth` gives the reason: no answer (firewall, address), failed verification (shared secret). |
| Late coefficient shows `error` | Edit the assignment; saving shows the rule's syntax error. |
| A problem with `tester.cpp` fails | `Invalid Tester Code`: the tester does not compile. Delete an old `tester.executable` after a migration. |
| Cheat detection: engine not available | `NUXT_CHEAT_*` are not set (outside Docker) or the image is outdated: rebuild. |
| Cheat detection: "not compared" | The programs are too short to compare reliably, or JPlag could not parse them (e.g. Python 2). |
| Live results do not appear | A proxy buffers `/api/events`; the pages fall back to polling every few seconds. |
