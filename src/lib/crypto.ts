// AES-256-GCM encryption for sensitive secrets (per-AI-model API keys).
// The 32-byte key is derived via SHA-256 from AI_ENC_KEY (env), falling back
// to the session secret so data is always encrypted at rest.

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

async function getSecretString(): Promise<string> {
  let s = process.env.AI_ENC_KEY;
  try {
    // @ts-ignore - cloudflare:workers only exists inside workerd (dev & prod)
    const { env } = await import("cloudflare:workers");
    if (env?.AI_ENC_KEY) s = env.AI_ENC_KEY;
  } catch {}
  if (!s) {
    // Fallback: derive the key from the session secret rather than storing plaintext.
    const { getAuthCredentials } = await import("./auth");
    const creds = await getAuthCredentials();
    s = creds.secret;
  }
  return s;
}

async function getCryptoKey(): Promise<CryptoKey> {
  const secret = await getSecretString();
  const hash = await crypto.subtle.digest("SHA-256", ENCODER.encode(secret));
  return await crypto.subtle.importKey(
    "raw",
    hash,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Encrypt a plaintext secret. Returns `iv:authTag+ciphertext` base64 string. */
export async function encryptSecret(plain: string): Promise<string> {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plainBytes = ENCODER.encode(plain);
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new Uint8Array(plainBytes),
  );
  return `${bytesToB64(iv)}:${bytesToB64(new Uint8Array(cipherBuffer))}`;
}

/** Decrypt a value produced by encryptSecret. Returns the original plaintext. */
export async function decryptSecret(cipher: string): Promise<string> {
  const [ivB64, dataB64] = cipher.split(":");
  if (!ivB64 || !dataB64) return "";
  const iv = b64ToBytes(ivB64);
  const data = b64ToBytes(dataB64);
  const key = await getCryptoKey();
  const plainBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, new Uint8Array(data));
  return DECODER.decode(plainBuffer);
}

/** Mask a secret for safe display in the admin UI (e.g. `sk-…a1B9`). */
export function maskSecret(secret: string | null | undefined): string {
  if (!secret) return "";
  if (secret.length <= 8) return "••••";
  return `${secret.slice(0, 4)}…${secret.slice(-4)}`;
}
