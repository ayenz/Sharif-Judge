# Users and sign-in

## Adding users

**Users > Add users** creates many accounts at once. One user per line:

```
# username,email,display name,password,role
alice,alice@example.edu,Alice Student,secret123,student
bob,bob@example.edu,Bob Student,random[8],student
lecturer1,lect@example.edu,Dr. Lecturer,random[10],head_instructor
```

- Usernames: 3–20 lowercase letters or digits. Passwords: 6–200 characters.
- `random[N]` generates a random password of length N; the result page shows it.
- Roles: `student`, `instructor`, `head_instructor`, `admin` (see [Introduction](./introduction#who-does-what)).
- Lines starting with `#` are ignored.
- **Send mail** emails each new user their username and password (needs SMTP, see
  [Configuration](./configuration#mail)), with a delay between mails.

The users list exports to Excel, and each user can be edited (role, email, password) or deleted.
Deleting a user deletes their submissions too; "delete submissions" keeps the account.

## Self-registration

Settings > Accounts & Mail > **Enable registration** shows a Register link on the sign-in page. Set a
**registration code** to limit it to people who know the code. New accounts are students.

## Display names

Students can change their display name in their profile, unless Settings > Display >
**Lock student display name** is on. Admins can always change it.

## Password reset

"Forgot password?" sends a link valid for one hour (needs SMTP). Requests are limited to five per
hour per address.

## Sign-in limits

Failed sign-ins are limited to protect passwords against guessing: 8 per address and account,
30 per address and 50 per account within 15 minutes. After that the sign-in page asks to wait. Behind
a reverse proxy, set `NUXT_TRUST_PROXY=true`, otherwise all users share the proxy's address.

## Cloudflare Turnstile

[Turnstile](https://developers.cloudflare.com/turnstile/) is Cloudflare's alternative to a CAPTCHA.
When it is on, the sign-in, registration and "forgot password" forms show a small security check,
and the server verifies it with Cloudflare before it looks at the password. This stops automated
password guessing and mass registrations on an installation that is reachable from the internet.

It is **off by default**. Whoever runs the server provides the keys once; an admin then switches it
on and off in Settings:

1. In the Cloudflare dashboard, open **Turnstile**, add a widget for the host name people use (for
   example `judge.example.ac.id`), and copy its site key and secret key.
2. Add them to `docker/.env` and run `docker compose up -d web`:

   ```bash
   TURNSTILE_SITE_KEY=0x4AAAAAAA...
   TURNSTILE_SECRET_KEY=0x4AAAAAAA...
   ```

3. In **Settings > Accounts & Mail**, switch on **Cloudflare Turnstile**, complete the check that
   appears below it, and save. The check proves the keys work for the address you are using, so a
   wrong key or host name cannot lock everybody (yourself included) out of the sign-in page.

Switch it off in Settings at any time. If nobody can sign in any more (for example after moving to
another host name), removing the two keys from `docker/.env` and running `docker compose up -d web`
turns it off whatever Settings says.

Things to know:

- Both the server and the browsers must reach `challenges.cloudflare.com`. **Do not turn it on for
  an installation without internet access** (a campus-only network): if the server cannot reach
  Cloudflare, sign-in is refused, so the check cannot be skipped by blocking that connection.
- The widget only works on the host names registered for the key; on any other address it shows
  an error and nobody can sign in.
- Signed-in pages are not affected, and neither is LDAP or RADIUS sign-in itself (the check runs
  before the password is checked by any method).
- `docker compose logs web | grep turnstile` shows why a check failed (for example
  `invalid-input-secret` when the secret key is wrong).

## LDAP or RADIUS

Accounts always exist in SharIF Judge (added as above). With an external method, a user can sign in
with either their SharIF Judge password or their campus password: the local password is tried first,
then the external server.

### RADIUS

```yaml
# web service environment
NUXT_AUTH_METHOD: radius
NUXT_AUTH_RADIUS_SERVER: 10.0.0.5:1812     # port optional, default 1812
NUXT_AUTH_RADIUS_SECRET: the-shared-secret
```

On the RADIUS server, add the judge server as a client with the same shared secret. The judge sends
PAP requests with a Message-Authenticator, verifies every answer with the shared secret (a forged
"accept" is rejected), and retries three times. Failures are logged by the `web` service with the
reason, e.g. `no answer after 3 tries` or `answer failed verification`. Tested with FreeRADIUS 3.2
(`tests/radius/`).

### LDAP / Active Directory

```yaml
NUXT_AUTH_METHOD: ldap
NUXT_AUTH_LDAP_URL: ldaps://dc.example.edu
NUXT_AUTH_LDAP_ACCOUNT_SUFFIX: "@example.edu"
```

The judge binds as `username` + suffix with the user's password; a successful bind signs the user in.

::: warning
LDAP sign-in has not been tested against a real directory yet. Test it with a staff account before
relying on it.
:::
