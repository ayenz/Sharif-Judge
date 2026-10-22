import { brotliCompressSync, constants, gzipSync } from 'node:zlib'

// Compresses HTML pages and JSON responses. The app is usually reached directly (no
// reverse proxy), so nothing else would compress them. Streams (live events, file
// downloads) and small bodies are left alone.
const MIN_BYTES = 1024

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('beforeResponse', (event, response) => {
    // Internal requests (Nuxt renders error pages through /__nuxt_error, SSR calls the API
    // in-process) read the body as text: compressing them corrupts the final response.
    if (event.path.startsWith('/__nuxt') || !event.node.req.socket?.remoteAddress)
      return
    const accept = getRequestHeader(event, 'accept-encoding') ?? ''
    const encoding = /\bbr\b/.test(accept) ? 'br' : /\bgzip\b/.test(accept) ? 'gzip' : null
    if (!encoding || getResponseHeader(event, 'content-encoding'))
      return

    let body = response.body
    if (body === null || body === undefined || typeof body === 'number' || typeof body === 'boolean')
      return
    let isJson = false
    if (typeof body !== 'string') {
      // Plain objects and arrays become JSON; anything else (Buffer, stream) is sent as is.
      const proto = Object.getPrototypeOf(body)
      if (!Array.isArray(body) && proto !== Object.prototype && proto !== null)
        return
      body = JSON.stringify(body)
      isJson = true
    }
    if (Buffer.byteLength(body as string) < MIN_BYTES)
      return

    const data = encoding === 'br'
      ? brotliCompressSync(body as string, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } })
      : gzipSync(body as string, { level: 6 })
    if (isJson && !getResponseHeader(event, 'content-type'))
      setResponseHeader(event, 'content-type', 'application/json; charset=utf-8')
    setResponseHeader(event, 'content-encoding', encoding)
    appendResponseHeader(event, 'vary', 'Accept-Encoding')
    removeResponseHeader(event, 'content-length')
    response.body = data
  })
})
