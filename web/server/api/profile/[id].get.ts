// Profile of a user. Admins may view anyone; others only themselves (else 404, like legacy).
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const target = await usersProfileTarget(event, me)
  const locked = await getSetting('lock_student_display_name') === '1'
  return {
    id: target.id,
    username: target.username,
    displayName: target.displayName,
    email: target.email,
    role: target.role,
    // See [id].post.ts for why admins are exempt.
    displayNameLocked: locked && me.level < 3,
    canChangeRole: me.level >= 3,
  }
})
