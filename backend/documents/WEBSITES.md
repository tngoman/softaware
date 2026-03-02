System Architecture Document: Soft Aware (Single-Page Site Generator)

Context for AI Developer: You are expanding the "Soft Aware" platform (a Node.js / SQLite backend). We are introducing a "Site Builder" feature for users who own a domain but lack a website. The system will collect user data via a React UI, compile a static single-page website (with our AI widget injected), and offer FTP publishing. It will also route contact form submissions through our central API.
Phase 1: The React Builder UI (Data Collection)

The Stack: React, Tailwind CSS
The Role: A wizard-style interface on the Soft Aware platform.

    The Flow: The user is guided through a series of inputs:

        Business Name & Tagline.

        Uploading a Logo and Hero Image (files sent to our VPS storage).

        "About Us" and "Services" text blocks.

        FTP Credentials (Server, Username, Password).

    Security Imperative: FTP passwords MUST be encrypted in the React frontend before transmission, or immediately encrypted upon reaching the Node.js API using crypto (AES-256). They must be stored in the database as encrypted hashes, never as plain text.

Phase 2: The Static Generator Engine (Node.js Backend)

The Stack: Node.js, ejs (Embedded JavaScript templating) or ReactDOMServer
The Role: Taking the JSON payload from the React Builder and compiling it into deployable web files.

    The Mechanism: 1. The API receives the user's text and image URLs.
    2. It injects this data into a pre-designed HTML/CSS template.
    3. Crucial Injection: It automatically inserts the Soft Aware AI <script src="https://api.softaware.co.za/widget.js" data-client-id="[USER_ID]" defer></script> right before the closing </body> tag.
    4. It outputs an index.html, a style.css, and an assets folder.

    The Output: These files are saved temporarily on the VPS, ready for deployment. Because it is pure HTML/CSS, the user's generated site will load instantly and have excellent SEO.

Phase 3: The FTP Deployment Pipeline

The Stack: Node.js, basic-ftp or ssh2-sftp-client
The Role: Pushing the generated static files to the client's domain.

    The Mechanism: 1. The backend decrypts the user's stored FTP credentials in memory.
    2. It opens a connection to the user's server (preferring SFTP, falling back to FTP).
    3. It uploads the index.html, style.css, and images to the public_html or www directory.
    4. It clears the decrypted credentials from server memory immediately after the upload stream closes.

Phase 4: The Contact Form Router (API Gateway)

The Stack: Express.js, nodemailer
The Role: Processing contact form submissions from the generated websites and emailing the site owners.

    The Setup: The generated index.html includes a standard HTML <form>. The action attribute points to our central endpoint: POST https://api.softaware.co.za/v1/leads/submit.

    The Payload: The form submits name, email, message, and a hidden client_id field.

    The Security (Anti-Spam): This is critical. Without protection, spammers will use our API to send millions of emails.

        The API must implement strict IP-based Rate Limiting (e.g., max 5 submissions per minute per IP).

        The generated form must include a hidden "Honeypot" field. If the API receives data in the honeypot field (which only a bot would fill out), the submission is silently dropped.

    The Execution: The Node.js endpoint looks up the client_id in the database, retrieves the site owner's actual email address, and uses nodemailer (via a service like SendGrid, AWS SES, or standard SMTP) to route the lead to their inbox.


Security Module: FTP Credential Encryption (Node.js)

Context for AI Developer: You are implementing the encryption layer for the "Soft Aware" Site Builder. When users provide their FTP passwords to deploy their generated static HTML sites, these passwords MUST be encrypted before being saved to the sqlite-vec database, and decrypted only in memory exactly when the FTP stream is initialized.

We are using Node.js native crypto with aes-256-gcm.
1. Environment Setup

The VPS must have a 32-byte (256-bit) master key stored in the .env file. This key NEVER goes into the codebase or the database.
Code snippet

# Generate this on the Linux server using: openssl rand -hex 32
ENCRYPTION_MASTER_KEY="your_32_byte_hex_string_here"

2. The Encryption Utility Module (cryptoUtils.js)

Create this utility file to handle the logic.
JavaScript

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
// The master key must be a 32-byte buffer
const MASTER_KEY = Buffer.from(process.env.ENCRYPTION_MASTER_KEY, 'hex');

/**
 * Encrypts a plaintext string (like an FTP password).
 * @param {string} text - The plaintext password.
 * @returns {string} - A composite string containing the IV, Auth Tag, and Ciphertext.
 */
export function encryptPassword(text) {
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
 * @param {string} hash - The composite string stored in the database.
 * @returns {string} - The original plaintext password.
 */
export function decryptPassword(hash) {
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
        console.error('Decryption failed. Data may have been tampered with or key is wrong.', error);
        throw new Error('Decryption failed');
    }
}

3. Database Implementation Rules

When the AI sets up the sqlite-vec tables, ensure the FTP password column is designed to hold this longer composite string.

    DO NOT log the plaintext password in console.log during the Express route handling.

    DO NOT send the plaintext password back to the React frontend once it has been saved. If a user needs to update their FTP password, they must enter a brand new one.

    The decryptPassword function should only be called inside the exact Node.js function that initializes the basic-ftp or ssh2-sftp-client upload stream, and the plaintext variable should be scoped as tightly as possible.