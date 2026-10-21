import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from '../database/schema'

export { schema }
export type Db = MySql2Database<typeof schema>

let pool: mysql.Pool | undefined
let db: Db | undefined

export function usePool(): mysql.Pool {
  if (!pool) {
    const { db: cfg } = useRuntimeConfig()
    pool = mysql.createPool({
      host: cfg.host,
      port: Number(cfg.port),
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      connectionLimit: 10,
      // Keep DATETIME values as plain strings: they are wall-clock times in the
      // timezone from settings, not UTC.
      dateStrings: true,
      charset: 'utf8mb4',
    })
  }
  return pool
}

export function useDb(): Db {
  if (!db)
    db = drizzle(usePool(), { schema, mode: 'default' })
  return db
}

/** Full table name including the configured prefix, for raw SQL. */
export function tableName(name: string): string {
  return `${useRuntimeConfig().db.prefix}${name}`
}

export async function tableExists(name: string): Promise<boolean> {
  const [rows] = await usePool().query('SHOW TABLES LIKE ?', [tableName(name)])
  return (rows as unknown[]).length > 0
}
