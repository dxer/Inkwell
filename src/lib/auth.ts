// Admin authentication: credential resolution + HMAC-signed session cookies.
//
// Passwords are verified against a salted PBKDF2 hash stored in
// ADMIN_PASSWORD_HASH (preferred) or, for backward compatibility, plaintext
// ADMIN_PASSWORD. There is NO insecure default password — if neither is
// configured, login is refused.

const ENCODER = new TextEncoder();

export async function getAuthCredentials() {
  let username = process.env.ADMIN_USERNAME;
  let password = process.env.ADMIN_PASSWORD;
  let passwordHash = process.env.ADMIN_PASSWORD_HASH;
  let secret = process.env.SESSION_SECRET;

  try {
    // @ts-ignore — cloudflare:workers only exists inside workerd (dev & prod)
    const { env } = await import("cloudflare:workers");
    if (env?.ADMIN_USERNAME) username = env.ADMIN_USERNAME;
    if (env?.ADMIN_PASSWORD) password = env.ADMIN_PASSWORD;
    if (env?.ADMIN_PASSWORD_HASH) passwordHash = env.ADMIN_PASSWORD_HASH;
    if (env?.SESSION_SECRET) secret = env.SESSION_SECRET;
  } catch {}

  return {
    // username is not secret; a sane default is fine.
    username: username || "admin",
    // password / passwordHash default to undefined so that, if neither is
    // configured, login is refused instead of falling back to a known default.
    password: password || undefined,
    passwordHash: passwordHash || undefined,
    secret: secret || "INSECURE_DEV_FALLBACK_change_me_in_production_1234567890",
  };
}

// ---------------------------------------------------------------------------
// Password verification (salted PBKDF2-HMAC-SHA256, Web Crypto compatible)
// ---------------------------------------------------------------------------

// Stored hash format: pbkdf2$sha256$<iterations>$<base64-salt>$<base64-hash>

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Constant-time comparison to avoid timing side-channels.
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Verify a plaintext password against a stored PBKDF2 hash string. */
export async function verifyPasswordHash(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 5 || parts[0] !== "pbkdf2" || parts[1] !== "sha256") return false;
  const iterations = Number(parts[2]);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  let salt: Uint8Array<ArrayBuffer>;
  let expected: Uint8Array<ArrayBuffer>;
  try {
    salt = b64ToBytes(parts[3]);
    expected = b64ToBytes(parts[4]);
  } catch {
    return false;
  }

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    ENCODER.encode(plain),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    expected.length * 8,
  );
  return timingSafeEqual(new Uint8Array(bits), expected);
}

/**
 * Validate submitted admin credentials.
 * Priority: ADMIN_PASSWORD_HASH (salted) > ADMIN_PASSWORD (plaintext, warns).
 * If neither is configured, login is refused.
 */
export async function verifyAdminCredentials(
  providedUser: string,
  providedPass: string,
): Promise<boolean> {
  const creds = await getAuthCredentials();
  if (!creds.username || !providedUser || providedUser !== creds.username) return false;

  if (creds.passwordHash) {
    return verifyPasswordHash(providedPass, creds.passwordHash);
  }
  if (creds.password) {
    console.warn(
      "[auth] ADMIN_PASSWORD is plaintext — configure ADMIN_PASSWORD_HASH (see tools/gen-admin-hash.mjs) instead.",
    );
    const a = ENCODER.encode(providedPass);
    const b = ENCODER.encode(creds.password);
    return timingSafeEqual(a, b);
  }
  // No credential configured at all.
  return false;
}

// ---------------------------------------------------------------------------
// Session (HMAC-signed cookie)
// ---------------------------------------------------------------------------

async function getCryptoKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    ENCODER.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signSession(payload: any, secret: string): Promise<string> {
  const data = JSON.stringify(payload);
  const key = await getCryptoKey(secret);
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, ENCODER.encode(data));
  const signatureHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Base64 encode the string payload safely (supports unicode)
  const base64Payload = btoa(unescape(encodeURIComponent(data)));
  return `${base64Payload}.${signatureHex}`;
}

export async function verifySession(token: string, secret: string): Promise<any | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [base64Payload, signatureHex] = parts;
    const data = decodeURIComponent(escape(atob(base64Payload)));
    const key = await getCryptoKey(secret);

    // Parse signature hex back to Uint8Array
    const signatureBytes = new Uint8Array(
      signatureHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
    );

    const isValid = await crypto.subtle.verify("HMAC", key, signatureBytes, ENCODER.encode(data));
    if (!isValid) return null;

    const parsed = JSON.parse(data);
    // Check if session has expired (e.g. 7 days expiration)
    if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
      return null;
    }

    return parsed;
  } catch (e) {
    return null;
  }
}

// Cookie Helper Functions
export function getCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const [key, val] = pair.trim().split("=");
    if (key === name) return val;
  }
  return null;
}

export async function getAdminSessionFromRequest(request: Request): Promise<any | null> {
  const cookieHeader = request.headers.get("cookie");
  const sessionToken = getCookieValue(cookieHeader, "inkwell_session");
  if (!sessionToken) return null;

  const { secret } = await getAuthCredentials();
  return await verifySession(sessionToken, secret);
}

export function destroySessionCookieString(): string {
  return `inkwell_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
