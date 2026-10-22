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
