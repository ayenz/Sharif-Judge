// Users list as an Excel file, same columns as the legacy users/list_excel.
export default defineEventHandler(async (event) => {
  await requireUser(event, 3)
  const now = await nowStr()
  const list = await usersAll()
  return sendExcel(event, {
    filename: 'sharifjudge_users',
    title: 'SharIF Judge Users',
    meta: [['Time:', now]],
    header: ['#', 'User ID', 'Username', 'Display Name', 'Email', 'Role', 'First Login', 'Last Login'],
    rows: list.map((u, i) => [
      i + 1,
      u.id,
      u.username,
      u.displayName,
      u.email,
      u.role,
      u.firstLoginTime ?? 'Never',
      u.lastLoginTime ?? 'Never',
    ]),
  })
})
