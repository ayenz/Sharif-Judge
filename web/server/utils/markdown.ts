import MarkdownIt from 'markdown-it'

let md: ReturnType<typeof MarkdownIt> | undefined

/**
 * Markdown to HTML for problem descriptions (replaces Parsedown). Raw HTML is kept,
 * like Parsedown's default, because descriptions are written by instructors.
 */
export function markdownRender(text: string): string {
  md ??= MarkdownIt({ html: true, linkify: false, typographer: false })
  return md.render(text)
}
