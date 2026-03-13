/**
 * Browser-compatible TOTP generator using Web Crypto API.
 * Zero external dependencies. Uses the same algorithm as the backend (SHA1, 30s period, 6 digits).
 *
 * Used for one-click 2FA activation: the web app calls /auth/2fa/setup to get a TOTP secret,
 * generates a code from it, and immediately calls /auth/2fa/verify-setup — no QR scanning needed.
 */

function base32Decode(encoded: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const stripped = encoded.replace(/[\s=]+/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of stripped) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return new Uint8Array(output);
}

/**
 * Generate a 6-digit TOTP code from a base32-encoded secret.
 * Compatible with Google Authenticator, Authy, and the backend's otpauth library.
 */
export async function generateTOTP(secretBase32: string): Promise<string> {
  const secret = base32Decode(secretBase32);
  const counter = Math.floor(Date.now() / 1000 / 30);

  // Build 8-byte big-endian counter
  const counterBuf = new ArrayBuffer(8);
  const view = new DataView(counterBuf);
  view.setUint32(0, Math.floor(counter / 0x100000000), false);
  view.setUint32(4, counter >>> 0, false);

  // HMAC-SHA1
  const key = await crypto.subtle.importKey(
    'raw',
    secret.buffer.slice(secret.byteOffset, secret.byteOffset + secret.byteLength) as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, counterBuf));

  // Dynamic truncation (RFC 4226 §5.4)
  const offset = sig[sig.length - 1] & 0x0f;
  const code =
    (((sig[offset] & 0x7f) << 24) |
      ((sig[offset + 1] & 0xff) << 16) |
      ((sig[offset + 2] & 0xff) << 8) |
      (sig[offset + 3] & 0xff)) %
    1000000;

  return code.toString().padStart(6, '0');
}
