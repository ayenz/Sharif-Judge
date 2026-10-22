import { eq } from 'drizzle-orm'

const { settings } = schema

export type SettingKey =
  | 'timezone' | 'tester_path' | 'assignments_root' | 'file_size_limit' | 'output_size_limit'
  | 'queue_is_working' | 'default_late_rule' | 'enable_easysandbox' | 'enable_c_shield'
  | 'enable_cpp_shield' | 'enable_py2_shield' | 'enable_py3_shield' | 'enable_java_policy'
  | 'enable_log' | 'submit_penalty' | 'enable_registration' | 'registration_code' | 'mail_from'
  | 'mail_from_name' | 'reset_password_mail' | 'add_user_mail' | 'moss_userid'
  | 'results_per_page_all' | 'results_per_page_final' | 'week_start' | 'lock_student_display_name'
  | 'enable_python2'

export async function getAllSettings(): Promise<Record<SettingKey, string>> {
  const rows = await useDb().select().from(settings)
  return Object.fromEntries(rows.map(r => [r.key, r.value])) as Record<SettingKey, string>
}

export async function getSetting(key: SettingKey): Promise<string> {
  const [row] = await useDb().select({ value: settings.value }).from(settings).where(eq(settings.key, key))
  return row?.value ?? ''
}

/** Python 2 is end-of-life and not installed in the image: off unless an admin enables it. */
export async function python2Enabled(): Promise<boolean> {
  return (await getSetting('enable_python2')) === '1'
}

export async function setSetting(key: SettingKey, value: string | number): Promise<void> {
  await useDb().update(settings).set({ value: String(value) }).where(eq(settings.key, key))
}

export async function setSettings(values: Partial<Record<SettingKey, string | number>>): Promise<void> {
  for (const [key, value] of Object.entries(values))
    await setSetting(key as SettingKey, value as string | number)
}
