import { defineConfig } from 'vitepress'

// Published on GitHub Pages at https://ayenz.github.io/Sharif-Judge/
export default defineConfig({
  title: 'SharIF Judge',
  description: 'Online judge for C, C++, Java and Python programming courses',
  lang: 'en-US',
  base: '/Sharif-Judge/',
  cleanUrls: true,
  lastUpdated: true,
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/Sharif-Judge/logo.svg' }]],
  themeConfig: {
    logo: { light: '/logo.svg', dark: '/logo-dark.svg', alt: 'SharIF Judge' },
    nav: [
      { text: 'Guide', link: '/guide/introduction', activeMatch: '/guide/' },
      { text: 'Development', link: '/development/getting-started', activeMatch: '/development/' },
      { text: 'GitHub', link: 'https://github.com/ayenz/Sharif-Judge' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Getting started',
          items: [
            { text: 'Introduction', link: '/guide/introduction' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Configuration', link: '/guide/configuration' },
            { text: 'Migrating from PHP', link: '/guide/migration-from-php' },
          ],
        },
        {
          text: 'Running the judge',
          items: [
            { text: 'Users and sign-in', link: '/guide/users-and-sign-in' },
            { text: 'Assignments and problems', link: '/guide/assignments' },
            { text: 'Judging', link: '/guide/judging' },
            { text: 'Cheat detection', link: '/guide/cheat-detection' },
          ],
        },
        {
          text: 'Operations',
          items: [
            { text: 'Backups', link: '/guide/backups' },
            { text: 'Security', link: '/guide/security' },
            { text: 'Troubleshooting', link: '/guide/troubleshooting' },
          ],
        },
      ],
      '/development/': [
        {
          text: 'Development',
          items: [
            { text: 'Getting started', link: '/development/getting-started' },
            { text: 'Architecture', link: '/development/architecture' },
            { text: 'Judge engine', link: '/development/judge-engine' },
            { text: 'Database', link: '/development/database' },
            { text: 'Testing', link: '/development/testing' },
            { text: 'Conventions', link: '/development/conventions' },
          ],
        },
      ],
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/ayenz/Sharif-Judge' }],
    search: { provider: 'local' },
    editLink: {
      pattern: 'https://github.com/ayenz/Sharif-Judge/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
    footer: {
      message: 'Released under the GNU General Public License v3.',
      copyright: 'Based on Sharif Judge by Mohammad Javad Naderi and the SharIF Judge work of FTIS UNPAR.',
    },
    outline: { level: [2, 3] },
  },
})
