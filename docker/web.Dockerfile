# SharIF Judge (Nuxt) — build context is the repository root.

FROM node:24-bookworm-slim AS build
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --ignore-scripts
COPY web/ ./
RUN npx nuxt prepare && npm run build

# Runtime: Node plus the compilers and tools tester.sh needs.
FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc g++ make libc6-dev default-jdk-headless python3 perl procps diffutils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /src/web/.output ./web
COPY tester ./tester
# EasySandbox is intentionally not built: it kills every program on current glibc
# (seccomp strict mode), and the legacy setup never built it either, so tester.sh
# runs C/C++ without it. Replacing it with a working sandbox is tracked separately.
RUN mkdir -p /data/assignments \
    && chown -R node:node /app/tester /data

ENV NODE_ENV=production \
    PORT=3000 \
    NUXT_PATHS_TESTER=/app/tester \
    NUXT_PATHS_ASSIGNMENTS=/data/assignments
USER node
EXPOSE 3000
VOLUME ["/data"]
CMD ["node", "web/server/index.mjs"]
