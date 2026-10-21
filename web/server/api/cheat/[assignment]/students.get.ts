export default defineEventHandler(async (event) => {
  await requireUser(event, 2)
  return cheatStudentSignals(intParam(event, 'assignment'))
})
