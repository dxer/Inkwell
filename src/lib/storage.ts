import * as path from "path";

export async function putAsset(key: string, fileData: ArrayBuffer, mimeType: string): Promise<string> {
  // 1. Try Cloudflare R2 object storage first
  const workersModule = "cloudflare:" + "workers";

  // Add timeout protection to prevent blocking SSR stream
  const timeoutMs = 15000; // 15 second timeout for R2 operations
  let timedOut = false;

  const timeoutPromise = new Promise<string>((resolve) => {
    setTimeout(() => {
      timedOut = true;
      // Fall back to data URL on timeout
      const base64 = Buffer.from(fileData).toString("base64");
      resolve(`data:${mimeType};base64,${base64}`);
    }, timeoutMs);
  });

  const r2Promise = (async () => {
    try {
      // @ts-ignore - cloudflare:workers only exists inside workerd
      const { env } = await import(/* @vite-ignore */ workersModule);
      if (env && env.MY_R2_BUCKET) {
        await env.MY_R2_BUCKET.put(key, fileData, {
          httpMetadata: { contentType: mimeType }
        });
        // Verify the object was actually persisted (miniflare in-memory R2 may
        // accept writes but lose them across request boundaries).
        const check = await env.MY_R2_BUCKET.get(key);
        if (check) {
          return `/api/assets/${key}`;
        }
      }
    } catch (e) {
      // R2 binding not available — fall through
    }
    // Fallback: return data URL directly (works everywhere, no storage needed)
    const base64 = Buffer.from(fileData).toString("base64");
    return `data:${mimeType};base64,${base64}`;
  })();

  const result = await Promise.race([r2Promise, timeoutPromise]);
  return result;
}

export async function getAsset(key: string): Promise<{ data: Uint8Array; mimeType: string } | null> {
  // 1. Try Cloudflare R2 first (works in both local workerd dev and production)
  const workersModule = "cloudflare:" + "workers";

  // Add timeout protection to prevent blocking SSR stream
  const timeoutMs = 10000; // 10 second timeout for R2 operations
  let timedOut = false;

  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => {
      timedOut = true;
      console.warn(`getAsset(${key}) timed out, falling through to filesystem`);
      resolve(null);
    }, timeoutMs);
  });

  const r2Promise = (async () => {
    try {
      // @ts-ignore - cloudflare:workers only exists inside workerd
      const { env } = await import(/* @vite-ignore */ workersModule);
      if (env?.MY_R2_BUCKET) {
        const object = await env.MY_R2_BUCKET.get(key);
        if (object) {
          const arrayBuffer = await object.arrayBuffer();
          const mimeType = object.httpMetadata?.contentType || "application/octet-stream";
          return { data: new Uint8Array(arrayBuffer), mimeType };
        }
      }
      return null;
    } catch (e) {
      // R2 binding not available — fall through
      return null;
    }
  })();

  // Race R2 fetch against timeout
  const r2Result = await Promise.race([r2Promise, timeoutPromise]);

  if (r2Result !== null) {
    return r2Result;
  }

  // 2. Fallback: read from local filesystem (Node environments without R2)
  try {
    const fs = await import("fs/promises");
    const filePath = path.join(process.cwd(), "public", "mock-uploads", key);
    const data = await fs.readFile(filePath);
    const ext = path.extname(key).toLowerCase();
    let mimeType = "application/octet-stream";
    if (ext === ".png") mimeType = "image/png";
    else if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
    else if (ext === ".svg") mimeType = "image/svg+xml";
    else if (ext === ".webp") mimeType = "image/webp";
    else if (ext === ".gif") mimeType = "image/gif";
    return { data: new Uint8Array(data), mimeType };
  } catch (e) {
    return null;
  }
}
