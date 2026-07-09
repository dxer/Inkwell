const ENCODER = new TextEncoder();

export async function getAuthCredentials() {
  let username = process.env.ADMIN_USERNAME;
  let password = process.env.ADMIN_PASSWORD;
  let secret = process.env.SESSION_SECRET;

  try {
    // @ts-ignore — cloudflare:workers only exists inside workerd (dev & prod)
    const { env } = await import("cloudflare:workers");
    if (env?.ADMIN_USERNAME) username = env.ADMIN_USERNAME;
    if (env?.ADMIN_PASSWORD) password = env.ADMIN_PASSWORD;
    if (env?.SESSION_SECRET) secret = env.SESSION_SECRET;
  } catch {}

  return {
    username: username || "admin",
    password: password || "admin123",
    secret: secret || "INSECURE_DEV_FALLBACK_change_me_in_production_1234567890",
  };
}

async function getCryptoKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    ENCODER.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signSession(payload: any, secret: string): Promise<string> {
  const data = JSON.stringify(payload);
  const key = await getCryptoKey(secret);
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, ENCODER.encode(data));
  const signatureHex = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
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
      signatureHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
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
