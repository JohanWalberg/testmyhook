import { randomInt, randomBytes } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** URL-safe, cryptographically random identifier (62^10 ≈ 8.4e17 combinations). */
export function newToken(length = 10): string {
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export function newSecret(): string {
  return 'whsec_' + randomBytes(18).toString('base64url');
}
