#!/usr/bin/env node
// Generate a salted PBKDF2-HMAC-SHA256 hash for the admin password.
//
// Usage:
//   node tools/gen-admin-hash.mjs <password>
//
// Then store the output as the ADMIN_PASSWORD_HASH secret (NOT in vars):
//   wrangler secret put ADMIN_PASSWORD_HASH
//
// Format matches src/lib/auth.ts: pbkdf2$sha256$<iter>$<base64-salt>$<base64-hash>

import { pbkdf2Sync, randomBytes } from "node:crypto";

const ITERATIONS = 200_000;
const KEYLEN = 32; // 256-bit

const password = process.argv[2];
if (!password) {
  console.error("Usage: node tools/gen-admin-hash.mjs <password>");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, "sha256");

const encoded = `pbkdf2$sha256$${ITERATIONS}$${salt.toString("base64")}$${hash.toString("base64")}`;
console.log(encoded);
