import dgram from 'node:dgram'
import radius from 'radius'
import { Client } from 'ldapts'

/** Checks credentials against the configured LDAP or RADIUS server, if any. */
export async function externalAuthenticate(username: string, password: string): Promise<boolean> {
  const { auth } = useRuntimeConfig()
  try {
    if (auth.method === 'ldap' && auth.ldapUrl)
      return await ldapAuth(username, password)
    if (auth.method === 'radius' && auth.radiusServer)
      return await radiusAuth(username, password)
  }
  catch (error) {
    console.warn(`[auth] ${auth.method} authentication failed:`, (error as Error).message)
  }
  return false
}

async function ldapAuth(username: string, password: string): Promise<boolean> {
  const { auth } = useRuntimeConfig()
  const client = new Client({ url: auth.ldapUrl, timeout: 5000, connectTimeout: 5000 })
  try {
    // Active Directory accepts "user@domain" as bind DN, which is what adldap2 did.
    await client.bind(`${username}${auth.ldapAccountSuffix}`, password)
    return true
  }
  catch {
    return false
  }
  finally {
    await client.unbind().catch(() => {})
  }
}

const RADIUS_TIMEOUT_MS = 2000
const RADIUS_TRIES = 3

/**
 * PAP Access-Request. Sends a Message-Authenticator (required by servers hardened
 * against BlastRADIUS, CVE-2024-3596), verifies that the answer is signed with the shared
 * secret (so a spoofed Access-Accept is rejected), and retransmits a few times because
 * RADIUS runs over UDP.
 */
function radiusAuth(username: string, password: string): Promise<boolean> {
  const { auth } = useRuntimeConfig()
  const secret = String(auth.radiusSecret)
  const [host = '', port = '1812'] = String(auth.radiusServer).split(':')
  const identifier = Math.floor(Math.random() * 256)
  const request = radius.encode({
    code: 'Access-Request',
    secret,
    identifier,
    add_message_authenticator: true,
    attributes: [['User-Name', username], ['User-Password', password], ['NAS-Identifier', 'sharif-judge']],
  })

  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4')
    let tries = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let done = false
    const finish = (ok: boolean, reason?: string) => {
      if (done)
        return
      done = true
      clearTimeout(timer)
      socket.close()
      if (reason)
        console.warn(`[auth] RADIUS ${host}:${port}: ${reason}`)
      resolve(ok)
    }
    const send = () => {
      if (tries++ >= RADIUS_TRIES)
        return finish(false, `no answer after ${RADIUS_TRIES} tries`)
      socket.send(request, Number(port), host, (error) => {
        if (error)
          finish(false, error.message)
      })
      timer = setTimeout(send, RADIUS_TIMEOUT_MS)
    }
    socket.on('error', error => finish(false, error.message))
    socket.on('message', (response) => {
      try {
        const decoded = radius.decode({ packet: response, secret })
        if (decoded.identifier !== identifier)
          return // an answer to something else: keep waiting
        if (!radius.verify_response({ request, response, secret }))
          return finish(false, 'answer failed verification (wrong shared secret or spoofed packet)')
        finish(decoded.code === 'Access-Accept')
      }
      catch (error) {
        finish(false, `unreadable answer: ${(error as Error).message}`)
      }
    })
    send()
  })
}
