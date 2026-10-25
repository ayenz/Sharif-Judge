import { ARCHIVE_LANGUAGES, JUDGED_LANGUAGES } from '#shared/languages'

/**
 * Languages for the sign-in pages' tagline: one name per language (Java zips and JARs are Java,
 * Python 2 and 3 are Python), without the ones this judge cannot run (Swift when not installed).
 */
function taglineLanguages(unavailable: string[]): string[] {
  const names = JUDGED_LANGUAGES
    .filter(l => !ARCHIVE_LANGUAGES.includes(l) && !unavailable.includes(l))
    .map(l => (l.startsWith('Python') ? 'Python' : l))
  return [...new Set(names)]
}

// Public info the login/register pages need before signing in.
export default defineEventHandler(async () => {
  const installed = await tableExists('settings')
  if (!installed)
    return { installed, registration: false, registrationCodeRequired: false, languages: taglineLanguages(swiftInstalled() ? [] : ['Swift']) }
  return {
    installed,
    registration: await getSetting('enable_registration') === '1',
    registrationCodeRequired: await getSetting('registration_code') !== '0',
    languages: taglineLanguages(await unavailableLanguages()),
  }
})
