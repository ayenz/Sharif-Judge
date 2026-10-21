import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomInt } from 'node:crypto'
import { and, asc, desc, eq, lt, ne } from 'drizzle-orm'
import { ROLES, type Role } from '#shared/roles'

const { users, submissions, logins } = schema

/** Finds a user by exact (case-sensitive) username. */
export async function findUser(username: string) {
  const [row] = await useDb().select().from(users).where(eq(users.username, username))
  return row && row.username === username ? row : undefined
}

export async function findUserById(id: number) {
  const [row] = await useDb().select().from(users).where(eq(users.id, id))
  return row
}

/** True if a user other than `exceptUsername` uses this email. */
export async function emailTaken(email: string, exceptUsername?: string): Promise<boolean> {
  const [row] = await useDb().select({ username: users.username }).from(users).where(eq(users.email, email))
  if (!row)
    return false
  return !(exceptUsername !== undefined && row.username === exceptUsername)
}

/** Map of username to display name. */
export async function getNames(): Promise<Record<string, string>> {
  const rows = await useDb().select({ username: users.username, displayName: users.displayName }).from(users)
  return Object.fromEntries(rows.map(r => [r.username, r.displayName]))
}

/** Local password first, then the configured external method (LDAP/RADIUS). */
export async function validateCredentials(username: string, password: string): Promise<boolean> {
  const user = await findUser(username)
  if (!user)
    return false
  if (checkUserPassword(password, user.password))
    return true
  return externalAuthenticate(username, password)
}

export async function recordLogin(username: string, ip: string): Promise<void> {
  const db = useDb()
  const now = await nowStr()
  const user = await findUser(username)
  if (user && user.firstLoginTime === null)
    await db.update(users).set({ firstLoginTime: now }).where(eq(users.username, username))
  await db.update(users).set({ lastLoginTime: now }).where(eq(users.username, username))

  // 24-hour login log: drop entries older than a day, link to the previous login from another IP.
  await db.delete(logins).where(lt(logins.timestamp, fromEpoch(toEpoch(now) - 86400)))
  const [previous] = await db.select({ loginId: logins.loginId }).from(logins)
    .where(and(eq(logins.username, username), ne(logins.ipAddress, ip)))
    .orderBy(desc(logins.timestamp)).limit(1)
  await db.insert(logins).values({
    username,
    timestamp: now,
    ipAddress: ip.slice(0, 15),
    last24hLoginId: previous?.loginId ?? null,
  })
}

/** Adds one user. Returns true or an error message (same messages as the legacy app). */
export async function addUser(username: string, email: string, displayName: string, password: string, role: string): Promise<true | string> {
  if (!/^[a-z0-9]+$/i.test(username))
    return 'Username may only contain alpha-numeric characters.'
  if (username.length < 3 || username.length > 20 || password.length < 6 || password.length > 200)
    return 'Username or password length error.'
  if (await findUser(username))
    return 'User with this username exists.'
  if (await emailTaken(email))
    return 'User with this email exists.'
  if (username.toLowerCase() !== username)
    return 'Username must be lowercase.'
  if (!ROLES.includes(role as Role))
    return 'Users role is not valid.'
  await useDb().insert(users).values({
    username,
    email,
    displayName,
    password: hashUserPassword(password),
    role,
  })
  return true
}

async function removeUserFiles(username: string): Promise<void> {
  const root = await getSetting('assignments_root')
  const { readdir } = await import('node:fs/promises')
  const assignmentsDirs = await readdir(root).catch(() => [])
  for (const a of assignmentsDirs) {
    const problemDirs = await readdir(join(root, a)).catch(() => [])
    for (const p of problemDirs)
      await rm(join(root, a, p, username), { recursive: true, force: true })
  }
}

export async function deleteUser(userId: number): Promise<boolean> {
  const user = await findUserById(userId)
  if (!user)
    return false
  await useDb().transaction(async (tx) => {
    await tx.delete(users).where(eq(users.id, userId))
    await tx.delete(submissions).where(eq(submissions.username, user.username))
  })
  await removeUserFiles(user.username)
  return true
}

export async function deleteUserSubmissions(userId: number): Promise<boolean> {
  const user = await findUserById(userId)
  if (!user)
    return false
  await useDb().delete(submissions).where(eq(submissions.username, user.username))
  await removeUserFiles(user.username)
  return true
}

// ---------------------------------------------------------------------------
// Users administration (bulk add, list)

const RANDOM_PASSWORD_POOL = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ|!@#$%^&*()_-+=\\/[]{}\'":;?<>.,~'

/** Random password from the same character pool as the legacy shj_random_password(). */
export function usersRandomPassword(length: number): string {
  let password = ''
  for (let i = 0; i < length; i++)
    password += RANDOM_PASSWORD_POOL[randomInt(RANDOM_PASSWORD_POOL.length)]
  return password
}

/** [username, email, displayName, password, role] */
export type BulkUser = [string, string, string, string, string]

/**
 * Adds users from text, one per line: USERNAME,EMAIL,DISPLAY-NAME,PASSWORD,ROLE.
 * Lines starting with # are comments; RANDOM[n] generates an n-character password.
 * Same parsing as the legacy User_model::add_users().
 */
export async function usersAddBulk(text: string): Promise<{ ok: BulkUser[], errors: [...BulkUser, string][] }> {
  const ok: BulkUser[] = []
  const errors: [...BulkUser, string][] = []
  for (const raw of text.split(/\r?\n|\n?\r/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#'))
      continue
    // Legacy splits on runs of commas without trimming the parts; we also trim each part
    // so "user, mail@x.y, ..." does not store an email with a leading space.
    const parts = line.split(/,+/).map(p => p.trim())
    const user = [0, 1, 2, 3, 4].map(i => parts[i] ?? '') as BulkUser
    if (parts.length !== 5) {
      errors.push([...user, 'Wrong Format'])
      continue
    }
    if (user[3].slice(0, 6).toLowerCase() === 'random') {
      const len = user[3].slice(6).replace(/^[[\]]+|[[\]]+$/g, '').trim()
      // Capped so a typo like RANDOM[99999999] cannot hang the request (it fails the length check anyway).
      if (/^\d+$/.test(len))
        user[3] = usersRandomPassword(Math.min(Number(len), 201))
    }
    const result = await addUser(...user)
    if (result === true)
      ok.push(user)
    else
      errors.push([...user, result])
  }
  return { ok, errors }
}

/** All users ordered like the legacy get_all_users(): by role, then id. */
export async function usersAll() {
  return useDb().select({
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    email: users.email,
    role: users.role,
    firstLoginTime: users.firstLoginTime,
    lastLoginTime: users.lastLoginTime,
  }).from(users).orderBy(asc(users.role), asc(users.id))
}

/**
 * The user whose profile is requested by route param `id`. Admins may access
 * anyone; other users only themselves, else 404 (legacy Profile controller).
 */
export async function usersProfileTarget(event: import('h3').H3Event, me: CurrentUser) {
  const target = await findUserById(intParam(event, 'id'))
  if (!target || (me.level < 3 && target.username !== me.username))
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  return target
}
