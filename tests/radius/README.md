# RADIUS login test

Manual test of `NUXT_AUTH_METHOD=radius` against a real FreeRADIUS server and a forged one,
on the Docker setup from `docker/` (network `sharif-judge_default`).

```bash
cd tests/radius
# 1. FreeRADIUS 3.2 with one account (radiususer / RadiusPass123) and secret radius-test-secret
docker run -d --name shj-radius --network sharif-judge_default --network-alias radius \
  -v $PWD/clients.conf:/etc/raddb/clients.conf:ro \
  -v $PWD/authorize:/etc/raddb/mods-config/files/authorize:ro \
  freeradius/freeradius-server:3.2.7
# 2. Point the web app at it (add to the web service environment, then `docker compose up -d web`):
#      NUXT_AUTH_METHOD: radius
#      NUXT_AUTH_RADIUS_SERVER: radius:1812
#      NUXT_AUTH_RADIUS_SECRET: radius-test-secret
# 3. Create the judge user `radiususer` with a different local password (Users > Add users).
```

| Case | Expected |
|---|---|
| RADIUS password | signs in |
| wrong password | 401 |
| local password | signs in (the local password is always tried first) |
| wrong shared secret in the app | 401 after 3 tries (~6 s); FreeRADIUS drops the packets |
| RADIUS server stopped | 401, reason in the web log; local passwords still work |
| forged server (`fake.js`, answers Access-Accept without knowing the secret) | 401, web log: `answer failed verification` |

Run the forged server instead of FreeRADIUS with:

```bash
docker stop shj-radius
docker run -d --name shj-fake-radius --network sharif-judge_default --network-alias radius \
  -v $PWD/../../web/node_modules/radius:/r/radius:ro -v $PWD/fake.js:/fake.js:ro \
  node:24-bookworm-slim node /fake.js
```
