# SharIF Judge (Nuxt) — build context is the repository root.

FROM node:24-bookworm-slim AS build
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --ignore-scripts
COPY web/ ./
RUN npx nuxt prepare && npm run build

# Cheat detection engine: JPlag 6.3 needs Java 25. It gets its own runtime so the tester
# can stay on Java 17 (tester.sh relies on the Security Manager, removed in Java 24).
# JPlag parses Java with the JDK's compiler (module jdk.compiler), which a plain JRE does not
# have, so the runtime is made from the JDK with jlink.
#
# The image builds for x86-64 (amd64) and ARM64 (arm64, e.g. Ampere servers): downloads that
# depend on the processor pick the file and checksum for TARGETARCH, set by docker build.
FROM node:24-bookworm-slim AS jplag
ARG TARGETARCH
ADD --checksum=sha256:5f2c21e8b88ed77134effcb3a5a3ab13d188f6a3e16d401387f7479e92db9aa2 \
    https://github.com/jplag/JPlag/releases/download/v6.3.0/jplag-6.3.0-jar-with-dependencies.jar /opt/jplag/jplag.jar
# binutils: jlink --strip-debug calls objcopy (this stage only)
RUN apt-get update && apt-get install -y --no-install-recommends binutils curl ca-certificates && rm -rf /var/lib/apt/lists/* \
    && case "$TARGETARCH" in \
         arm64) JDK=aarch64 SHA=69df11a02cfa3ef7d7ca645e03edce6778ec090e100f6ae2b42097865730ac52 ;; \
         *)     JDK=x64     SHA=dbb698396d478e7fa2b1e50f4103324b2a99b90569ee27c33f2261f9215cf41e ;; \
       esac \
    && curl -fsSLo /tmp/jdk.tar.gz "https://github.com/adoptium/temurin25-binaries/releases/download/jdk-25.0.4.1%2B1/OpenJDK25U-jdk_${JDK}_linux_hotspot_25.0.4.1_1.tar.gz" \
    && echo "$SHA  /tmp/jdk.tar.gz" | sha256sum -c - \
    && mkdir -p /tmp/jdk && tar -xzf /tmp/jdk.tar.gz -C /tmp/jdk --strip-components=1 \
    && /tmp/jdk/bin/jlink --module-path /tmp/jdk/jmods \
       --add-modules java.se,jdk.compiler,jdk.unsupported,jdk.zipfs,jdk.charsets,jdk.localedata,jdk.management,jdk.crypto.cryptoki,jdk.net \
       --strip-debug --no-header-files --no-man-pages --output /opt/jre25 \
    && rm -rf /tmp/jdk /tmp/jdk.tar.gz \
    && chmod 644 /opt/jplag/jplag.jar

# Go toolchain for Go submissions, plus a build cache of the common standard packages
# (see docker/go-cache-warm.go). CGO is off here and in tester.sh so the cache matches.
FROM node:24-bookworm-slim AS golang
ARG TARGETARCH
COPY docker/go-cache-warm.go /tmp/warm/main.go
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/* \
    && case "$TARGETARCH" in \
         arm64) GO_ARCH=arm64 SHA=a06e99309dbcbdca1a8ccd2282c3ee146e55930886e26b4f1193269587165f49 ;; \
         *)     GO_ARCH=amd64 SHA=65efbc80fdc1fa2cd2631cad5b481777a68e8725f34e89f50fc6ac714e379b40 ;; \
       esac \
    && curl -fsSLo /tmp/go.tar.gz "https://go.dev/dl/go1.27.3.linux-${GO_ARCH}.tar.gz" \
    && echo "$SHA  /tmp/go.tar.gz" | sha256sum -c - \
    && tar -xzf /tmp/go.tar.gz -C /usr/local && rm /tmp/go.tar.gz \
    && rm -rf /usr/local/go/test /usr/local/go/api /usr/local/go/doc /usr/local/go/misc \
    && cd /tmp/warm \
    && HOME=/tmp GOCACHE=/opt/go-cache GOTOOLCHAIN=local GOTELEMETRY=off CGO_ENABLED=0 \
       /usr/local/go/bin/go build -o /tmp/warm/warm main.go \
    && chmod -R a+rX /opt/go-cache

# Kotlin compiler. Programs run on the tester's Java 17 with the Kotlin standard library.
FROM node:24-bookworm-slim AS kotlin
ADD --checksum=sha256:7cc140e76daf416a0424a5557f99afd7ca89ebd463ea1101261e3e01c33e75cd \
    https://github.com/JetBrains/kotlin/releases/download/v2.4.21/kotlin-compiler-2.4.21.zip /tmp/kotlin.zip
RUN apt-get update && apt-get install -y --no-install-recommends unzip && rm -rf /var/lib/apt/lists/* \
    && unzip -q /tmp/kotlin.zip -d /opt && rm /tmp/kotlin.zip \
    && rm -f /opt/kotlinc/lib/*-sources.jar && chmod -R a+rX /opt/kotlinc && chmod a+x /opt/kotlinc/bin/*

# Swift compiler, only with the build argument WITH_SWIFT=1 (the toolchain adds about 1.2 GB,
# so it is optional). Only what swiftc needs to compile and link is kept: no debugger, language
# server, package manager or embedded targets. Without it /opt/swift stays empty and the app
# does not offer Swift.
FROM node:24-bookworm-slim AS swift
ARG WITH_SWIFT=0
ARG TARGETARCH
RUN mkdir -p /opt/swift && if [ "$WITH_SWIFT" = "1" ]; then \
      case "$TARGETARCH" in \
        arm64) DIR=debian12-aarch64 FILE=swift-6.4.1-RELEASE-debian12-aarch64.tar.gz SHA=c902b9eb9d50c6469821d054b5b06c0618de56222696411b762c22cc2af98632 ;; \
        *)     DIR=debian12         FILE=swift-6.4.1-RELEASE-debian12.tar.gz         SHA=12a01b5658a679bc5970017a5173bfc28af3d45274e0878f586f2bcdc90acb60 ;; \
      esac \
      && apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/* \
      && curl -fsSLo /tmp/swift.tar.gz "https://download.swift.org/swift-6.4.1-release/$DIR/swift-6.4.1-RELEASE/$FILE" \
      && echo "$SHA  /tmp/swift.tar.gz" | sha256sum -c - \
      && tar -xzf /tmp/swift.tar.gz -C /opt/swift --strip-components=1 && rm /tmp/swift.tar.gz \
      && cd /opt/swift/usr/bin && for f in *; do case "$f" in \
           swift|swiftc|swift-frontend|swift-driver|swift-autolink-extract|clang|clang-[0-9]*|clang++|lld|ld.lld) ;; \
           *) rm -rf "$f" ;; esac; done \
      && cd /opt/swift/usr/lib && rm -rf liblldb* lldb* sourcekitd* libsourcekit* libSwiftSourceKit* \
           swift/embedded swift/pm swift/FrameworkABIBaseline swift_static \
      && rm -rf /opt/swift/usr/share /opt/swift/usr/include /opt/swift/usr/local; \
    fi

# Runtime: Node plus the compilers and tools tester.sh needs.
FROM node:24-bookworm-slim
ARG WITH_SWIFT=0
# libncurses6 and libxml2 are what the Swift compiler needs beyond the C toolchain.
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc g++ make libc6-dev default-jdk-headless python3 perl procps diffutils time \
        $([ "$WITH_SWIFT" = "1" ] && echo libncurses6 libxml2) \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /src/web/.output ./web
COPY tester ./tester
COPY judge ./judge
COPY --from=jplag /opt/jre25 /opt/jre25
COPY --from=jplag /opt/jplag /opt/jplag
COPY --from=golang /usr/local/go /usr/local/go
COPY --from=golang /opt/go-cache /opt/go-cache
RUN ln -s /usr/local/go/bin/go /usr/local/bin/go
COPY --from=kotlin /opt/kotlinc /opt/kotlinc
COPY --from=swift /opt/swift /opt/swift
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
