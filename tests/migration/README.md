# Migration test

Checks [docs/migration-from-php.md](../../docs/migration-from-php.md): a Nuxt instance on a copy of a
PHP installation must match the PHP app on the original data.

Setup on the test server (after `tests/regression/run.py`, so the PHP app on port 8401 has data):

1. Follow steps 1, 3, 4 and 5 of the guide with the PHP app's database (`shj_ci3`) and assignments
   folder as the source, importing into `shj_migrated`.
2. Run the migrated app as a second instance on port 8403 with a Compose override that extends the
   `web` and `judge` services (`web-mig`, `judge-mig`), sets `NUXT_DB_DATABASE: shj_migrated` and
   mounts the migrated data folder at `/data`.

Then:

```bash
uv run tests/migration/verify.py
```

It checks: old passwords, the start-up migration (folder paths, new settings and tables), identical
submissions, scoreboards, Excel exports and Hall of Fame, that the code and result of every old
submission open, that rejudging every problem gives the same results, and that a new submission is
judged.
