export default defineAppConfig({
  ui: {
    colors: {
      primary: 'ifblue',
      neutral: 'slate',
    },
    // Same look as the plain tables (.data-table in assets/css/main.css).
    table: {
      slots: {
        thead: 'bg-elevated/60',
        th: 'px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-muted whitespace-nowrap',
        td: 'px-3 py-2 text-sm text-default',
      },
    },
  },
})
