// Save a problem description (legacy save_problem_description).
// type "md" writes desc.md and renders desc.html; "html" writes desc.html and removes desc.md.
export default defineEventHandler(async (event) => {
  await requireUser(event, 2)
  const { assignment, problemId } = await problemFromParams(event)
  const body = await readForm(event, z.object({
    type: z.enum(['md', 'html']),
    text: z.string().max(5_000_000, 'Description is too long.'),
  }))
  await problemSaveDescription(assignment.id, problemId, body.text, body.type)
  return { done: true }
})
