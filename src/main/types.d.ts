declare module 'heic-convert' {
  function convert(o: { buffer: Buffer; format: 'PNG' | 'JPEG'; quality?: number }): Promise<ArrayBuffer>
  export default convert
}
