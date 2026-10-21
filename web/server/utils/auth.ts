import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { ROLE_LEVEL, type Role } from '#shared/roles'

const { users, assignments } = schema

export type Assignment = typeof schema.assignments.$inferSelect

/** Placeholder used when no (valid) assignment is selected, like the legacy app. */
export const NO_ASSIGNMENT = {
  id: 0,
  name: 'Not Selected',
  problems: 0,
  totalSubmits: 0,
  open: 0,
  scoreboard: 0,
  javaexceptions: 0,
  description: '',
  startTime: '',
  finishTime: '',
  extraTime: 0,
  lateRule: '',
  participants: '',
  mossUpdate: 'Never',
  archivedAssignment: 0,
} satisfies Assignment

export interface CurrentUser {
  id: number
  username: string
  displayName: string
  email: string
  role: Role
  level: number
  selectedAssignment: Assignment
}

declare module '#auth-utils' {
  interface User {
    username: string
  }
}

export async function getAssignment(id: number): Promise<Assignment> {
  if (!id)
    return NO_ASSIGNMENT
  const [row] = await useDb().select().from(assignments).where(eq(assignments.id, id))
  return row ?? NO_ASSIGNMENT
}

/** Loads the logged-in user fresh from the database, or null. */
export async function getCurrentUser(event: H3Event): Promise<CurrentUser | null> {
  if (event.context.currentUser !== undefined)
    return event.context.currentUser
  const session = await getUserSession(event)
  let current: CurrentUser | null = null
  if (session.user?.username) {
    const [row] = await useDb().select().from(users).where(eq(users.username, session.user.username))
    // Usernames are compared case-sensitively although the column collation is not.
    if (row && row.username === session.user.username) {
      const role = row.role as Role
      current = {
        id: row.id,
        username: row.username,
        displayName: row.displayName,
        email: row.email,
        role,
        level: ROLE_LEVEL[role] ?? 0,
        selectedAssignment: await getAssignment(row.selectedAssignment),
      }
    }
    else {
      await clearUserSession(event)
    }
  }
  event.context.currentUser = current
  return current
}

/** Throws 401 when not logged in and 404 when below the required level (like the legacy app). */
export async function requireUser(event: H3Event, minLevel = 0): Promise<CurrentUser> {
  const user = await getCurrentUser(event)
  if (!user)
    throw createError({ statusCode: 401, statusMessage: 'Not logged in' })
  if (user.level < minLevel)
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  return user
}

export function hashUserPassword(password: string): string {
  return bcrypt.hashSync(password, 10)
}

export function checkUserPassword(password: string, hash: string): boolean {
  // PHP password_hash() produces "$2y$" hashes, which are bcrypt-compatible.
  try {
    return bcrypt.compareSync(password, hash.replace(/^\$2y\$/, '$2b$'))
  }
  catch {
    return false
  }
}

declare module 'h3' {
  interface H3EventContext {
    currentUser?: CurrentUser | null
  }
}
