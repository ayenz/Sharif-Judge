declare module 'radius' {
  interface EncodeArgs {
    code: string
    secret: string
    identifier?: number
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
  }
  export default radius
}
