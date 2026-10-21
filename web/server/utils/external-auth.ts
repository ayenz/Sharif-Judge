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

function radiusAuth(username: string, password: string): Promise<boolean> {
  const { auth } = useRuntimeConfig()
  const [host, port = '1812'] = String(auth.radiusServer).split(':')
  const packet = radius.encode({
    code: 'Access-Request',
    secret: auth.radiusSecret,
    identifier: Math.floor(Math.random() * 256),
    attributes: [['User-Name', username], ['User-Password', password]],
  })
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4')
    const timer = setTimeout(() => {
      socket.close()
      resolve(false)
    }, 5000)
    socket.on('message', (msg) => {
      clearTimeout(timer)
      socket.close()
      try {
        const response = radius.decode({ packet: msg, secret: auth.radiusSecret })
        resolve(response.code === 'Access-Accept')
      }
      catch {
        resolve(false)
      }
    })
    socket.send(packet, Number(port), host)
  })
}
