declare module 'radius' {
  interface EncodeArgs {
    code: string
    secret: string
    identifier?: number
    add_message_authenticator?: boolean
    attributes?: [string, string][]
  }
  interface Decoded {
    code: string
    identifier: number
    attributes: Record<string, unknown>
  }
  const radius: {
    encode: (args: EncodeArgs) => Buffer
    decode: (args: { packet: Buffer, secret: string }) => Decoded
    verify_response: (args: { request: Buffer, response: Buffer, secret: string }) => boolean
  }
  export default radius
}
