// Data for the add/edit assignment form. Id 0 returns the defaults for a new assignment.
export default defineEventHandler(async (event) => {
  await requireUser(event, 2)
  const id = intParam(event, 'id')
  const defaultLateRule = await getSetting('default_late_rule')
  const python2 = await python2Enabled()
  if (id === 0) {
    return {
      id: 0,
      name: '',
      startTime: '',
      finishTime: '',
      extraTime: '',
      participants: 'ALL',
      lateRule: defaultLateRule,
      open: false,
      scoreboard: false,
      javaexceptions: false,
      archived: false,
      problems: [],
      hasPdf: false,
      defaultLateRule,
      python2Enabled: python2,
    }
  }
  const a = await getAssignment(id)
  if (!a.id)
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  return {
    id: a.id,
    ...await assignmentFormValues(a, python2),
    hasPdf: Boolean(await assignmentPdfPath(id)),
    defaultLateRule,
    python2Enabled: python2,
  }
})
