// Bulk add users from text (legacy users/add), optionally mailing each new user.
export default defineEventHandler(async (event) => {
  await requireUser(event, 3)
  const form = await readForm(event, z.object({
    newUsers: z.string().trim().min(1, 'The New Users field is required.'),
    sendMail: z.boolean().optional().default(false),
    delay: z.coerce.number().int('Delay must be a whole number of seconds.').min(0, 'Delay must be at least 0.').max(60, 'Delay must be at most 60 seconds.').optional().default(2),
  }))

  const { ok, errors } = await usersAddBulk(form.newUsers)

  let mailed = 0
  if (form.sendMail && ok.length) {
    const template = await getSetting('add_user_mail')
    const site = siteUrl(event)
    for (const [i, [username, email, , password, role]] of ok.entries()) {
      const text = template
        .replaceAll('{SITE_URL}', site)
        .replaceAll('{ROLE}', role)
        .replaceAll('{USERNAME}', username)
        .replaceAll('{PASSWORD}', escapeHtml(password))
        .replaceAll('{LOGIN_URL}', site)
      if (await sendMail(email, 'SharIF Judge Username and Password', text))
        mailed++
      // Wait between mails like the legacy app, so the SMTP server does not reject a burst.
      if (i < ok.length - 1 && form.delay > 0)
        await new Promise(resolve => setTimeout(resolve, form.delay * 1000))
    }
  }

  return { ok, errors, mailed, mailRequested: form.sendMail }
})

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}
