import crypto from "node:crypto";

const ALGORITHM = "aes-256-cbc";
const ITERATIONS = 100000;
const KEY_LENGTH = 32;

/**
 * Hash a password using PBKDF2
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, "sha256");
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

/**
 * Verify a password against a hash
 */
export function verifyPassword(password: string, hash: string): boolean {
  const [saltHex, hashHex] = hash.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const computed = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, "sha256");
  return computed.toString("hex") === hashHex;
}

/**
 * Encrypt sensitive data (API keys, etc.)
 */
export function encrypt(plaintext: string, masterPassword: string): string {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(masterPassword, "salt", KEY_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt sensitive data
 */
export function decrypt(ciphertext: string, masterPassword: string): string {
  const [ivHex, encrypted] = ciphertext.split(":");
  if (!ivHex || !encrypted) throw new Error("Invalid ciphertext format");
  const iv = Buffer.from(ivHex, "hex");
  const key = crypto.scryptSync(masterPassword, "salt", KEY_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
