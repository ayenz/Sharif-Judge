export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  modules: ['@nuxt/ui', 'nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },

  // Static assets are compressed once at build time (served as .br/.gz); pages and API
  // responses are compressed on the fly by server/plugins/compression.ts.
  nitro: {
    compressPublicAssets: { gzip: true, brotli: true },
  },

  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'theme-color', content: '#f2f6fc', media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: '#0f172a', media: '(prefers-color-scheme: dark)' },
      ],
    },
  },

  // System fonts only: no web font download, keeps first paint fast.
  ui: { fonts: false },
  icon: { clientBundle: { scan: true }, serverBundle: 'local' },

  runtimeConfig: {
    // Trust X-Forwarded-For for the client address (only behind a reverse proxy): true for one
    // proxy, or the number of proxies in a row (see clientIp() in server/utils/rate-limit.ts).
    trustProxy: false,
    db: {
      host: 'localhost',
      port: 3306,
      user: '',
      password: '',
      database: '',
      prefix: 'shj_',
    },
    // Optional external authentication, tried after the local password: '' | 'ldap' | 'radius'
    auth: {
      method: '',
      radiusServer: '',
      radiusSecret: '',
      ldapUrl: '',
      ldapAccountSuffix: '',
    },
    mail: {
      host: '',
      port: 465,
      secure: true,
      user: '',
      pass: '',
    },
    // Defaults written to settings on a fresh install.
    paths: {
      tester: '',
      assignments: '',
    },
    // JPlag cheat detection; empty paths disable it (the Docker image sets them).
    cheat: {
      java: '',
      jplagJar: '',
      workDir: '',
    },
    // Where submissions run: 'local' spawns tester.sh in this process (development),
    // 'remote' hands jobs to the isolated judge container through jobsDir.
    judge: {
      mode: 'local',
      jobsDir: '/data/jobs',
    },
    // Folder of the backup service, read to warn admins about missing or failed backups.
    backup: {
      dir: '',
    },
    queue: {
      // Set to false on extra web replicas so only one process runs submissions.
      enabled: true,
    },
    session: {
      name: 'shj-session',
      maxAge: 60 * 60 * 2,
      // Secure cookies require HTTPS. Set NUXT_SESSION_COOKIE_SECURE=true behind TLS.
      // Under a sub-path set NUXT_SESSION_COOKIE_PATH to the base URL too (docker/compose.yml
      // does), so two installations on one domain do not share the cookie.
      cookie: { secure: false, sameSite: 'lax', path: '/' },
    },
  },
})
