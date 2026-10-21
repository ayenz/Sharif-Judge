import { join } from 'node:path'

// All settings for the admin settings page, plus tester shield files and sandbox status.
export default defineEventHandler(async (event) => {
  await requireUser(event, 3)
  const s = await getAllSettings()
  const tester = (s.tester_path ?? '').replace(/\/+$/, '')
  const shields = await settingsReadShields(tester)
  return {
    settings: {
      timezone: s.timezone ?? '',
      testerPath: s.tester_path ?? '',
      assignmentsRoot: s.assignments_root ?? '',
      fileSizeLimit: s.file_size_limit ?? '',
      outputSizeLimit: s.output_size_limit ?? '',
      defaultLateRule: s.default_late_rule ?? '',
      enableEasysandbox: s.enable_easysandbox === '1',
      enableCShield: s.enable_c_shield === '1',
      enableCppShield: s.enable_cpp_shield === '1',
      enablePy2Shield: s.enable_py2_shield === '1',
      enablePy3Shield: s.enable_py3_shield === '1',
      enableJavaPolicy: s.enable_java_policy === '1',
      enableLog: s.enable_log === '1',
      enableRegistration: s.enable_registration === '1',
      registrationCode: s.registration_code ?? '',
      mailFrom: s.mail_from ?? '',
      mailFromName: s.mail_from_name ?? '',
      resetPasswordMail: s.reset_password_mail ?? '',
      addUserMail: s.add_user_mail ?? '',
      resultsPerPageAll: s.results_per_page_all ?? '',
      resultsPerPageFinal: s.results_per_page_final ?? '',
      weekStart: Number(s.week_start) || 0,
      lockStudentDisplayName: s.lock_student_display_name === '1',
    },
    shields,
    sandboxBuilt: tester ? await settingsPathExists(join(tester, 'easysandbox', 'EasySandbox.so')) : false,
    testerPathOk: shields.defc !== null,
    timezones: settingsTimezones(),
    serverTime: await nowStr(),
  }
})
