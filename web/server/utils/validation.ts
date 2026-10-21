import type { H3Event } from 'h3'
import { z } from 'zod'

export { z }

/** Field rules matching the legacy form_validation rules. */
export const rules = {
  username: z.string().trim()
    .min(3, 'Username must be at least 3 characters.')
    .max(20, 'Username must be at most 20 characters.')
    .regex(/^[a-z0-9]+$/, 'Username may only contain lowercase letters and digits.'),
  password: z.string()
    .min(6, 'Password must be at least 6 characters.')
    .max(200, 'Password must be at most 200 characters.'),
  email: z.string().trim().toLowerCase()
    .max(40, 'Email must be at most 40 characters.')
    .email('Enter a valid email address.'),
  id: z.coerce.number().int().positive(),
}

/**
 * Reads and validates the request body. On failure throws a 422 whose data has
 * `errors: { field: message }`, which the client shows next to each field.
 */
export async function readForm<T extends z.ZodType>(event: H3Event, schema: T): Promise<z.infer<T>> {
  const body = await readBody(event).catch(() => ({}))
  const result = schema.safeParse(body ?? {})
  if (!result.success)
    throw validationError(Object.fromEntries(result.error.issues.map(i => [i.path.join('.') || '_', i.message])))
  return result.data
}

export function validationError(errors: Record<string, string>) {
  return createError({ statusCode: 422, statusMessage: 'Validation failed', data: { errors } })
}

/** Parses a route parameter as a positive integer or throws 404. */
export function intParam(event: H3Event, name: string): number {
  const n = Number(getRouterParam(event, name))
  if (!Number.isInteger(n) || n < 0)
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  return n
}
