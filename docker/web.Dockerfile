# SharIF Judge (Nuxt) — build context is the repository root.

FROM node:24-bookworm-slim AS build
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --ignore-scripts
COPY web/ ./
RUN npx nuxt prepare && npm run build

# Cheat detection engine: JPlag 6.3 needs Java 25. It gets its own JRE so the tester
# can stay on Java 17 (tester.sh relies on the Security Manager, removed in Java 24).
FROM node:24-bookworm-slim AS jplag
ADD --checksum=sha256:1731a34baadec5479258ea0202e4d5d865d2efeee60cb0c7d7eb056fe96ca219 \
    https://github.com/adoptium/temurin25-binaries/releases/download/jdk-25.0.4.1%2B1/OpenJDK25U-jre_x64_linux_hotspot_25.0.4.1_1.tar.gz /tmp/jre.tar.gz
ADD --checksum=sha256:5f2c21e8b88ed77134effcb3a5a3ab13d188f6a3e16d401387f7479e92db9aa2 \
    https://github.com/jplag/JPlag/releases/download/v6.3.0/jplag-6.3.0-jar-with-dependencies.jar /opt/jplag/jplag.jar
RUN mkdir -p /opt/jre25 && tar -xzf /tmp/jre.tar.gz -C /opt/jre25 --strip-components=1 \
    && rm -rf /opt/jre25/man /opt/jre25/legal /tmp/jre.tar.gz \
    && chmod 644 /opt/jplag/jplag.jar

# Runtime: Node plus the compilers and tools tester.sh needs.
FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc g++ make libc6-dev default-jdk-headless python3 perl procps diffutils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /src/web/.output ./web
COPY tester ./tester
COPY judge ./judge
COPY --from=jplag /opt/jre25 /opt/jre25
COPY --from=jplag /opt/jplag /opt/jplag
# EasySandbox is intentionally not built: it kills every program on current glibc
# (seccomp strict mode), and the legacy setup never built it either, so tester.sh
# runs C/C++ without it. Replacing it with a working sandbox is tracked separately.
# shjrun (uid 2000) compiles and runs submissions in the judge container: it owns
# nothing but its jail directory and cannot read /data.
RUN useradd --system --uid 2000 --no-create-home --shell /usr/sbin/nologin shjrun \
    && mkdir -p /data/assignments /data/cheat /data/jobs \
    && chown -R node:node /app/tester /data \
    && chmod 711 /data /data/assignments /app/tester \
    && chmod 700 /data/jobs /data/cheat

ENV NODE_ENV=production \
    PORT=3000 \
    NUXT_PATHS_TESTER=/app/tester \
    NUXT_PATHS_ASSIGNMENTS=/data/assignments \
    NUXT_CHEAT_JAVA=/opt/jre25/bin/java \
    NUXT_CHEAT_JPLAG_JAR=/opt/jplag/jplag.jar \
    NUXT_CHEAT_WORK_DIR=/data/cheat
USER node
EXPOSE 3000
VOLUME ["/data"]
CMD ["node", "web/server/index.mjs"]
