// Live preview for the markdown description editor.
export default defineEventHandler(async (event) => {
  await requireUser(event, 2)
  const { text } = await readForm(event, z.object({ text: z.string().max(5_000_000) }))
  return { html: markdownRender(text) }
})
