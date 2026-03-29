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

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromBase64(b64: string): ArrayBuffer {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer as ArrayBuffer;
}

export async function encryptConfig(
  plaintext: string,
  password: string
): Promise<{ salt: string; iv: string; ciphertext: string }> {
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
  return {
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(cipherBuffer),
  };
}

export async function decryptConfig(
  saltB64: string,
  ivB64: string,
  ciphertextB64: string,
  password: string
): Promise<string> {
  const salt = fromBase64(saltB64);
  const iv = fromBase64(ivB64);
  const ciphertext = fromBase64(ciphertextB64);
  const key = await deriveKey(password, salt);
  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plainBuffer);
}
