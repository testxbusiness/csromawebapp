const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04]
const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function startsWithBytes(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((value, index) => bytes[index] === value)
}

function isWebp(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  )
}

function isUtf8Text(bytes: Uint8Array): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return !bytes.includes(0)
  } catch {
    return false
  }
}

/** Verifies the content signature against the browser-provided MIME type. */
export function hasValidMagicBytes(mimeType: string, bytes: Uint8Array): boolean {
  switch (mimeType) {
    case 'application/pdf':
      return bytes.length >= 5 && new TextDecoder().decode(bytes.subarray(0, 5)) === '%PDF-'
    case 'image/jpeg':
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    case 'image/png':
      return startsWithBytes(bytes, PNG_SIGNATURE)
    case 'image/webp':
      return isWebp(bytes)
    case 'application/msword':
    case 'application/vnd.ms-excel':
      return startsWithBytes(bytes, OLE_SIGNATURE)
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return startsWithBytes(bytes, ZIP_SIGNATURE)
    case 'text/plain':
    case 'text/csv':
      return isUtf8Text(bytes.subarray(0, Math.min(bytes.length, 64 * 1024)))
    default:
      return false
  }
}
