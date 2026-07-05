import * as path from "path";

export async function putAsset(key: string, fileData: ArrayBuffer, mimeType: string): Promise<string> {
  // 1. Try Cloudflare R2 object storage first
  const workersModule = "cloudflare:" + "workers";
  try {
    // @ts-ignore - cloudflare:workers only exists inside workerd
    const { env } = await import(/* @vite-ignore */ workersModule);
    if (env && env.MY_R2_BUCKET) {
      await env.MY_R2_BUCKET.put(key, fileData, {
        httpMetadata: { contentType: mimeType }
      });
      return `/api/assets/${key}`;
    }
  } catch (e) {
    // Skip R2 binding detection error
  }

  // 2. If running locally in development without R2, bypass disk entirely to prevent static routing caching 404s
  if (process.env.NODE_ENV === "development") {
    const base64 = Buffer.from(fileData).toString("base64");
    return `data:${mimeType};base64,${base64}`;
  }

  // 3. Fallback to Node fs local filesystem (only for production environments without R2)
  try {
    const fs = await import("fs/promises");
    const uploadDir = path.join(process.cwd(), "public", "mock-uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    
    const filePath = path.join(uploadDir, key);
    await fs.writeFile(filePath, Buffer.from(fileData));
    
    return `/mock-uploads/${key}`;
  } catch (e) {
    console.warn("Local disk write failed or not supported:", e);
    const base64 = Buffer.from(fileData).toString("base64");
    return `data:${mimeType};base64,${base64}`;
  }
}

export async function getAsset(key: string): Promise<{ data: Uint8Array; mimeType: string } | null> {
  if (process.env.NODE_ENV === "development") {
    const fs = await import("fs/promises");
    const filePath = path.join(process.cwd(), "public", "mock-uploads", key);
    try {
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
  } else {
    // Production: Cloudflare R2
    const workersModule = "cloudflare:" + "workers";
    try {
      // @ts-ignore - cloudflare:workers only exists inside workerd
      const { env } = await import(/* @vite-ignore */ workersModule);
      if (!env.MY_R2_BUCKET) {
        throw new Error("R2 bucket 'MY_R2_BUCKET' is not bound");
      }

      const object = await env.MY_R2_BUCKET.get(key);
      if (!object) return null;

      const arrayBuffer = await object.arrayBuffer();
      const mimeType = object.httpMetadata?.contentType || "application/octet-stream";

      return { data: new Uint8Array(arrayBuffer), mimeType };
    } catch (e) {
      // Fallback to disk if R2 call fails (helps in local testing with wrangler pages dev)
      try {
        const fs = await import("fs/promises");
        const filePath = path.join(process.cwd(), "public", "mock-uploads", key);
        const data = await fs.readFile(filePath);
        const ext = path.extname(key).toLowerCase();
        let mimeType = "application/octet-stream";
        if (ext === ".png") mimeType = "image/png";
        else if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
        else if (ext === ".webp") mimeType = "image/webp";
        return { data: new Uint8Array(data), mimeType };
      } catch {
        return null;
      }
    }
  }
}
