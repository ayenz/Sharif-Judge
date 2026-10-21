import { desc, eq, gt } from 'drizzle-orm'

const { notifications } = schema

export type NotificationRow = typeof schema.notifications.$inferSelect

/** All notifications, newest first (legacy orders by id desc). */
export async function notificationsAll(): Promise<NotificationRow[]> {
  return useDb().select().from(notifications).orderBy(desc(notifications.id))
}

export async function notificationGet(id: number): Promise<NotificationRow | undefined> {
  const [row] = await useDb().select().from(notifications).where(eq(notifications.id, id))
  return row
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ', zwnj: '‌' }

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? Number.parseInt(e.slice(2), 16) : Number(e.slice(1))
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

/**
 * The 10 latest notifications with plain-text excerpts, like the legacy
 * get_latest_notifications(): strip tags, trim, cut to 300 chars, decode
 * entities and join lines.
 */
export async function notificationsLatest(limit = 10) {
  const rows = await useDb().select().from(notifications).orderBy(desc(notifications.id)).limit(limit)
  return rows.map((n) => {
    // Block-level tags become spaces so words of adjacent paragraphs do not run together.
    let text = n.text.replace(/<\/(p|div|li|h\d|tr)>|<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').trim()
    // Legacy cuts bytes (substr); we cut characters so multibyte text is not broken.
    text = [...text].slice(0, 300).join('')
    text = decodeEntities(text).replace(/\r?\n|\n?\r/g, ' ').replace(/\s{2,}/g, ' ')
    return { id: n.id, title: n.title, time: n.time, text }
  })
}

/** True if a notification is newer than the given wall-clock time. */
export async function notificationsNewerThan(time: string): Promise<boolean> {
  const [row] = await useDb().select({ id: notifications.id }).from(notifications).where(gt(notifications.time, time)).limit(1)
  return Boolean(row)
}

/**
 * Removes the most dangerous constructs from notification HTML. The legacy app
 * stored it unfiltered ("todo: xss clean"); authors are head instructors, so this
 * is defense in depth rather than a full sanitizer.
 */
export function notificationSanitize(html: string): string {
  return html
    .replace(/<(script|style|iframe|object|frameset)\b[\s\S]*?(<\/\1\s*>|$)/gi, '')
    .replace(/<\/?(script|style|iframe|object|embed|frame|frameset|meta|link|base)\b[^>]*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src|action|formaction)\s*=\s*(["']?)\s*(javascript|vbscript|data):/gi, '$1=$2#')
}

/** Body of the add/edit notification form. */
export function notificationFormSchema() {
  return z.object({
    title: z.string().trim().max(200, 'The title field cannot exceed 200 characters in length.').default(''),
    text: z.string().max(60000, 'The text is too long.').default(''),
  })
}
