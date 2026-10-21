// Public info the login/register pages need before signing in.
export default defineEventHandler(async () => {
  const installed = await tableExists('settings')
  if (!installed)
    return { installed, registration: false, registrationCodeRequired: false }
  return {
    installed,
    registration: await getSetting('enable_registration') === '1',
    registrationCodeRequired: await getSetting('registration_code') !== '0',
  }
})
