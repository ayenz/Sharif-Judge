export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  modules: ['@nuxt/ui', 'nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },

  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      htmlAttrs: { lang: 'en' },
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', href: '/favicon.ico', sizes: '16x16' },
      ],
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
      ldapBaseDn: '',
      ldapBindDn: '',
      ldapBindPassword: '',
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
    queue: {
      // Set to false on extra web replicas so only one process runs submissions.
      enabled: true,
    },
    session: {
      name: 'shj-session',
      maxAge: 60 * 60 * 2,
      // Secure cookies require HTTPS. Set NUXT_SESSION_COOKIE_SECURE=true behind TLS.
      cookie: { secure: false, sameSite: 'lax' },
    },
  },
})
