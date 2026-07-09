import * as schema from "./schema";
// Static import: resolved by Vite/cloudflare-plugin at BUILD time, which correctly
// handles drizzle's `exports` map and pnpm's symlink layout. This avoids the
// workerd runtime module loader (unsafeModuleFallbackService), which fails on
// dynamic `await import("drizzle-orm/d1")` under pnpm.
import { drizzle } from "drizzle-orm/d1";

let dbInstance: any;

/**
 * Resolve the Drizzle database instance, always backed by Cloudflare D1.
 *
 * With `@cloudflare/vite-plugin`, the SSR layer runs inside the workerd
 * runtime in BOTH local dev and production, so `env.DB` is always available
 * (injected by miniflare locally, by the platform in production).
 *
 * `cloudflare:workers` is a virtual module injected by workerd, so it MUST be
 * imported dynamically at runtime. We split the specifier into a runtime
 * concatenation so Vite's static analyzer never tries to resolve it on the
 * client (where it doesn't exist).
 */
export async function getDb() {
  if (dbInstance) return dbInstance;

  // Add timeout protection to prevent blocking SSR stream
  const timeoutMs = 10000; // 10 second timeout for env resolution

  const timeoutPromise = new Promise<any>((_, reject) => {
    setTimeout(() => {
      reject(new Error("getDb: cloudflare:workers env resolution timed out"));
    }, timeoutMs);
  });

  try {
    const dbPromise = (async () => {
      const workersModule = "cloudflare:" + "workers";
      // @ts-ignore - cloudflare:workers only exists inside workerd
      const { env } = await import(/* @vite-ignore */ workersModule);

      if (!env || !env.DB) {
        throw new Error(
          "Cloudflare D1 binding 'DB' is not defined. " +
            "Ensure wrangler.jsonc has a d1_databases entry with binding 'DB'."
        );
      }

      dbInstance = drizzle(env.DB, { schema });
      return dbInstance;
    })();

    return await Promise.race([dbPromise, timeoutPromise]);
  } catch (e) {
    throw e;
  }
}
