import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
// The master key must be a 32-byte buffer
const MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY 
  ? Buffer.from(process.env.ENCRYPTION_MASTER_KEY, 'hex')
  : Buffer.alloc(32); // Fallback for development (will warn)

// Warn if encryption key is not configured
if (!process.env.ENCRYPTION_MASTER_KEY) {
  console.warn('[SECURITY] ENCRYPTION_MASTER_KEY not set. Using insecure default. Generate with: openssl rand -hex 32');
}

/**
 * Encrypts a plaintext string (like an FTP password).
 * @param text - The plaintext password.
 * @returns A composite string containing the IV, Auth Tag, and Ciphertext.
 */
export function encryptPassword(text: string): string | null {
  if (!text) return null;

  // 1. Generate a random 16-byte Initialization Vector (IV) for this specific encryption
  const iv = crypto.randomBytes(16);

  // 2. Create the cipher instance
  const cipher = crypto.createCipheriv(ALGORITHM, MASTER_KEY, iv);

  // 3. Encrypt the text
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // 4. Get the Authentication Tag (ensures the encrypted data isn't tampered with)
  const authTag = cipher.getAuthTag();

  // 5. Return all three parts glued together so they can be stored in a single database column
  // Format: iv:authTag:encryptedText
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts the composite hash back into a plaintext string.
 * @param hash - The composite string stored in the database.
 * @returns The original plaintext password.
 */
export function decryptPassword(hash: string): string | null {
  if (!hash) return null;

  try {
    // 1. Split the stored string back into its three parts
    const parts = hash.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted string format');

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];

    // 2. Create the decipher instance
    const decipher = crypto.createDecipheriv(ALGORITHM, MASTER_KEY, iv);
    decipher.setAuthTag(authTag);

    // 3. Decrypt the text
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('[SECURITY] Decryption failed. Data may have been tampered with or key is wrong.', error);
    throw new Error('Decryption failed');
  }
}
