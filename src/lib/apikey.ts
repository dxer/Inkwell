// API Key 工具：生成、哈希与基于请求的校验。
// 设计：明文密钥只在创建时返回一次给用户；数据库中仅存储其 SHA-256 摘要，
// 校验时把请求中的密钥同样哈希后与存储值比对，避免明文落库。

import { generateId } from "./id";
import { getDb } from "./db";
import { apiKeys } from "./schema";
import { eq } from "drizzle-orm";

const KEY_PREFIX = "ink_";

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashApiKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

// 生成一个新的 API Key：明文 + 展示前缀 + 存储哈希
export async function generateApiKey(): Promise<{
  key: string;
  prefix: string;
  hash: string;
}> {
  const random = generateId();
  const key = `${KEY_PREFIX}${random}`;
  const prefix = key.slice(0, KEY_PREFIX.length + 4); // e.g. "ink_8f3a"
  const hash = await hashApiKey(key);
  return { key, prefix, hash };
}

// 从 Authorization: Bearer <key> 请求头中提取密钥原文
export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

// 校验请求携带的 API Key 是否有效（与 sync 接口共用）。
// 返回匹配到的密钥记录；无效或缺失时返回 null。
export async function authenticateApiKey(
  request: Request
): Promise<{ id: string; name: string; prefix: string } | null> {
  const bearer = extractBearerToken(request);
  if (!bearer) return null;

  const providedHash = await hashApiKey(bearer);
  const db = await getDb();
  const matched = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, providedHash))
    .limit(1);

  if (matched.length === 0) return null;
  return { id: matched[0].id, name: matched[0].name, prefix: matched[0].prefix };
}
