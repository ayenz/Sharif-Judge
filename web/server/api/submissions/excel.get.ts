const hhmm = timeHhmm

// Excel export of the current submissions view (legacy Submissions::_download_excel).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const view = getQuery(event).view === 'final' ? 'final' : 'all'
  const q = { ...submissionsQuery(event, view), page: undefined }
  const { items } = await submissionsList(user, q)
  const now = await nowStr()

  const student = user.level === 0
  const header = student
    ? ['Final', 'Problem', 'Submit Time', 'Score', 'Delay (HH:MM)', 'Coefficient', 'Final Score', 'Language', 'Status']
    : ['Final', 'Submit ID', 'Username', 'Name', 'Problem', 'Submit Time', 'Score', 'Delay (HH:MM)', 'Coefficient', 'Final Score', 'Language', 'Status']
  if (!student && view === 'final')
    header.unshift('#1', '#2')

  let i = 0
  let j = 0
  let lastUser = ''
  const rows = items.map((s) => {
    i++
    if (s.username !== lastUser)
      j++
    lastUser = s.username
    const common = [
      `${s.problem} (${s.problemName})`, s.time, s.preScore,
      s.delay <= 0 ? 'No Delay' : hhmm(s.delay), s.coefficient, s.finalScore, s.language, s.status,
    ]
    if (student)
      return [s.isFinal ? '*' : '', ...common]
    const row = [s.isFinal ? '*' : '', s.submitId, s.username, s.name, ...common]
    return view === 'final' ? [i, j, ...row] : row
  })

  return sendExcel(event, {
    filename: `judge_${view}_submissions`,
    title: 'SharIF Judge Submissions',
    meta: [
      ['Assignment:', user.selectedAssignment.name],
      ['Time:', now],
      ['Username Filter:', q.filterUser || 'No filter'],
      ['Problem Filter:', q.filterProblem || 'No filter'],
    ],
    header,
    rows,
  })
})
