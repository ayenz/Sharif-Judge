// Both programs of a pair with the matching line ranges, for the side-by-side view.
export default defineEventHandler(async (event) => {
  await requireUser(event, 2)
  const detail = await cheatPairDetail(intParam(event, 'id'))
  if (!detail)
    throw createError({ statusCode: 404, statusMessage: 'Pair not found' })
  return detail
})
