/**
 * Password-based AES-256-GCM encryption/decryption using Web Crypto API.
 * Used for shareable config export/import.
 */

async function deriveKey(password: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encrypt(plaintext: string, password: string): Promise<string> {
  const saltArr = crypto.getRandomValues(new Uint8Array(16));
  const ivArr = crypto.getRandomValues(new Uint8Array(12));
  const salt = saltArr.buffer as ArrayBuffer;
  const iv = ivArr.buffer as ArrayBuffer;
  const key = await deriveKey(password, salt);
  const enc = new TextEncoder();
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext)
  );
  // Pack: salt (16) + iv (12) + ciphertext → base64
  const packed = new Uint8Array(16 + 12 + cipherBuffer.byteLength);
  packed.set(saltArr, 0);
  packed.set(ivArr, 16);
  packed.set(new Uint8Array(cipherBuffer), 28);
  return btoa(String.fromCharCode(...packed));
}

export async function decrypt(encoded: string, password: string): Promise<string> {
  const packed = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const salt = packed.slice(0, 16).buffer as ArrayBuffer;
  const iv = packed.slice(16, 28).buffer as ArrayBuffer;
  const ciphertext = packed.slice(28).buffer as ArrayBuffer;
  const key = await deriveKey(password, salt);
  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plainBuffer);
}
