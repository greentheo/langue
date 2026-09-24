import "server-only";

/**
 * Password hashing with scrypt from node:crypto.
 *
 * Deliberately dependency-free. argon2 and bcrypt both ship native bindings
 * that have to compile in the deploy image; scrypt is memory-hard, in the
 * standard library, and recommended by OWASP for password storage. One less
 * thing to break a Railway build.
 */

import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Promisified scrypt.
 *
 * Hand-wrapped rather than `promisify(scrypt)`: the util types resolve to the
 * 3-argument overload, which drops the options parameter we need to raise N
 * and maxmem above their defaults.
 */
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

/** OWASP's minimum scrypt parameters: N=2^17, r=8, p=1. */
const COST = 2 ** 17;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

// scrypt needs roughly 128 * N * r bytes; the default 32MB cap is too low for N=2^17.
const MAX_MEMORY = 256 * 1024 * 1024;

/** Hash a password into a self-describing string safe to store in Postgres. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scryptAsync(password.normalize("NFKC"), salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELIZATION,
    maxmem: MAX_MEMORY,
  });

  return [
    "scrypt",
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

/**
 * Verify a password against a stored hash.
 *
 * Returns false on any malformed hash rather than throwing, so a corrupt row
 * fails the login instead of 500ing the route.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, costRaw, blockRaw, parallelRaw, saltRaw, hashRaw] = parts;
  const cost = Number(costRaw);
  const blockSize = Number(blockRaw);
  const parallelization = Number(parallelRaw);

  if (!Number.isInteger(cost) || !Number.isInteger(blockSize) || !Number.isInteger(parallelization)) {
    return false;
  }

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltRaw, "base64");
    expected = Buffer.from(hashRaw, "base64");
  } catch {
    return false;
  }

  if (salt.length === 0 || expected.length === 0) return false;

  let derived: Buffer;
  try {
    derived = await scryptAsync(password.normalize("NFKC"), salt, expected.length, {
      N: cost,
      r: blockSize,
      p: parallelization,
      maxmem: MAX_MEMORY,
    });
  } catch {
    return false;
  }

  // Lengths already match by construction, but timingSafeEqual throws if not.
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
