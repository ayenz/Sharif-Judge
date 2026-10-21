// Saves the settings page (legacy settings/update).
export default defineEventHandler(async (event) => {
  await requireUser(event, 3)
  const count = (label: string) => z.union([z.string(), z.number()])
    .transform(v => String(v).trim())
    .refine(v => /^\d+$/.test(v), `The ${label} field must contain an integer greater than or equal to 0.`)
  const shield = z.string().nullable().optional()

  const f = await readForm(event, z.object({
    timezone: z.string().trim().min(1, 'The timezone field is required.'),
    testerPath: z.string().trim(),
    assignmentsRoot: z.string().trim(),
    fileSizeLimit: count('File size limit'),
    outputSizeLimit: count('Output size limit'),
    defaultLateRule: z.string(),
    enableEasysandbox: z.boolean(),
    enableCShield: z.boolean(),
    enableCppShield: z.boolean(),
    enablePy2Shield: z.boolean(),
    enablePy3Shield: z.boolean(),
    enableJavaPolicy: z.boolean(),
    enableLog: z.boolean(),
    enableRegistration: z.boolean(),
    registrationCode: z.string().trim(),
    mailFrom: z.string().trim().refine(v => v === '' || z.email().safeParse(v).success, 'The email field must contain a valid email address.'),
    mailFromName: z.string().trim(),
    resetPasswordMail: z.string(),
    addUserMail: z.string(),
    resultsPerPageAll: count('results per page (all submissions)'),
    resultsPerPageFinal: count('results per page (final submissions)'),
    weekStart: z.coerce.number().int().min(0).max(6),
    lockStudentDisplayName: z.boolean(),
    shields: z.object({ defc: shield, defcpp: shield, shieldPy2: shield, shieldPy3: shield }).optional().default({}),
  }))

  // Shield files are written under the tester path saved before this request, like legacy.
  const errors = await settingsWriteShields(await getSetting('tester_path'), f.shields)

  // Legacy falls back to 'Asia/Tehran' for an invalid zone; this deployment is in Indonesia.
  const timezone = settingsIsValidTimezone(f.timezone) ? f.timezone : 'Asia/Jakarta'
  const flag = (b: boolean) => (b ? 1 : 0)

  await setSettings({
    timezone,
    tester_path: f.testerPath,
    assignments_root: f.assignmentsRoot,
    file_size_limit: f.fileSizeLimit,
    output_size_limit: f.outputSizeLimit,
    default_late_rule: f.defaultLateRule,
    enable_easysandbox: flag(f.enableEasysandbox),
    enable_c_shield: flag(f.enableCShield),
    enable_cpp_shield: flag(f.enableCppShield),
    enable_py2_shield: flag(f.enablePy2Shield),
    enable_py3_shield: flag(f.enablePy3Shield),
    enable_java_policy: flag(f.enableJavaPolicy),
    enable_log: flag(f.enableLog),
    enable_registration: flag(f.enableRegistration),
    registration_code: f.registrationCode,
    mail_from: f.mailFrom,
    mail_from_name: f.mailFromName,
    reset_password_mail: f.resetPasswordMail,
    add_user_mail: f.addUserMail,
    results_per_page_all: f.resultsPerPageAll,
    results_per_page_final: f.resultsPerPageFinal,
    week_start: f.weekStart,
    lock_student_display_name: flag(f.lockStudentDisplayName),
  })

  // Not in legacy: warn early when the default late rule cannot be evaluated.
  const warnings: string[] = []
  if (evalLateRule(f.defaultLateRule, 0, 0) === 'error')
    warnings.push('The default coefficient rule could not be evaluated (delay 0 gives "error"). Check its syntax.')

  return { ok: true, errors, warnings, timezone }
})
