import { createServerFn } from '@tanstack/react-start'
import { getAuthCredentials, verifySession } from './auth'
import { generateTitles, generateSlug, generateSummary, generateCoverImage, generateKeywords, generateAllMeta } from './ai'
import type { ResolvedModel } from './ai'
import { putAsset } from './storage'
import { generateId } from './id'
import { getDb } from './db'
import { apiKeys, aiModels, aiPrompts, posts, categories, tags } from './schema'
import { desc, eq, and, count, sql } from 'drizzle-orm'
import { generateApiKey } from './apikey'
import { encryptSecret, decryptSecret, maskSecret } from './crypto'

// Auth check server function (shared between admin.tsx and admin.login.tsx)
export const checkAuthFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const { getCookie } = await import('@tanstack/react-start/server');
    const sessionToken = getCookie('inkwell_session');
    if (!sessionToken) return { authenticated: false, username: null };
    
    const creds = await getAuthCredentials();
    const session = await verifySession(sessionToken, creds.secret);
    if (!session) return { authenticated: false, username: null };
    
    return { authenticated: true, username: session.username };
  });

// ---------------------------------------------------------------------------
// AI model / prompt resolution helpers
// ---------------------------------------------------------------------------

/** Resolve a model row into a ResolvedModel (decrypting its API key). */
async function resolveModel(modelId?: string, kind: 'text' | 'image' = 'text'): Promise<ResolvedModel> {
  const db = await getDb();
  let row: any = null;
  if (modelId) {
    row = (await db.select().from(aiModels).where(eq(aiModels.id, modelId)).limit(1))[0];
  }
  if (!row) {
    // Fall back to the enabled (default) model for this kind.
    row = (await db.select().from(aiModels)
      .where(kind === 'text' ? eq(aiModels.isDefaultText, true) : eq(aiModels.isDefaultImage, true))
      .limit(1))[0];
  }
  if (!row) {
    // Last resort: any model whose capabilities include the requested kind.
    const all = await db.select().from(aiModels);
    row = all.find((m: any) => (m.capabilities || '').includes(kind)) || null;
  }
  if (!row) {
    // No model configured at all — use built-in Cloudflare defaults.
    return kind === 'image'
      ? { provider: 'cloudflare', modelId: '@cf/stabilityai/stable-diffusion-xl-base-1.0' }
      : { provider: 'cloudflare', modelId: '@cf/meta/llama-3.1-8b-instruct' };
  }
  const apiKey = row.apiKey ? await decryptSecret(row.apiKey) : null;
  return { provider: row.provider, modelId: row.modelId, baseUrl: row.baseUrl, apiKey };
}

async function resolveSystemPrompt(promptId?: string, kind: 'text' | 'image' = 'text'): Promise<string | undefined> {
  const db = await getDb();
  let row: any = null;
  if (promptId) {
    row = (await db.select().from(aiPrompts).where(eq(aiPrompts.id, promptId)).limit(1))[0];
  }
  if (!row) {
    // Fall back to the prompt enabled (isDefault) for this kind.
    row = (await db.select().from(aiPrompts)
      .where(and(eq(aiPrompts.kind, kind), eq(aiPrompts.isDefault, true)))
      .limit(1))[0];
  }
  return row?.content || undefined;
}

// AI Server Functions (shared between admin.posts.new.tsx and admin.posts.$id.tsx)
export const aiGenerateTitlesFn = createServerFn({ method: 'POST' })
  .validator((data: { content: string; modelId?: string; promptId?: string }) => data)
  .handler(async ({ data }) => {
    const model = await resolveModel(data.modelId, 'text');
    const systemPrompt = await resolveSystemPrompt(data.promptId, 'text');
    return await generateTitles(data.content, model, systemPrompt);
  });

export const aiGenerateSlugFn = createServerFn({ method: 'POST' })
  .validator((data: { title: string; postId?: string }) => data)
  .handler(async ({ data }) => {
    return await generateSlug(data.title, data.postId);
  });

export const aiGenerateSummaryFn = createServerFn({ method: 'POST' })
  .validator((data: { content: string; modelId?: string; promptId?: string }) => data)
  .handler(async ({ data }) => {
    const model = await resolveModel(data.modelId, 'text');
    const systemPrompt = await resolveSystemPrompt(data.promptId, 'text');
    return await generateSummary(data.content, model, systemPrompt);
  });

export const aiGenerateKeywordsFn = createServerFn({ method: 'POST' })
  .validator((data: { content: string; modelId?: string; promptId?: string }) => data)
  .handler(async ({ data }) => {
    const model = await resolveModel(data.modelId, 'text');
    const systemPrompt = await resolveSystemPrompt(data.promptId, 'text');
    return await generateKeywords(data.content, model, systemPrompt);
  });

export const aiGenerateAllMetaFn = createServerFn({ method: 'POST' })
  .validator((data: { content: string; postId?: string; modelId?: string; promptId?: string }) => data)
  .handler(async ({ data }) => {
    const model = await resolveModel(data.modelId, 'text');
    const systemPrompt = await resolveSystemPrompt(data.promptId, 'text');
    return await generateAllMeta(data.content, data.postId, model, systemPrompt);
  });

export const aiGenerateCoverFn = createServerFn({ method: 'POST' })
  .validator((data: { prompt: string; modelId?: string }) => data)
  .handler(async ({ data }) => {
    const model = await resolveModel(data.modelId, 'image');
    return await generateCoverImage(data.prompt, model);
  });

// ---------------------------------------------------------------------------
// AI Models CRUD (admin only)
// ---------------------------------------------------------------------------

export const listAiModelsFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    await requireAdmin();
    const db = await getDb();
    const rows = await db.select().from(aiModels).orderBy(desc(aiModels.createdAt));
    return {
      models: await Promise.all(rows.map(async (m: any) => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        modelId: m.modelId,
        baseUrl: m.baseUrl || '',
        capabilities: m.capabilities || 'text',
        isDefaultText: !!m.isDefaultText,
        isDefaultImage: !!m.isDefaultImage,
        keyMasked: m.apiKey ? maskSecret(await decryptSecret(m.apiKey)) : '',
        hasKey: !!m.apiKey,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      }))),
    };
  });

export const createAiModelFn = createServerFn({ method: 'POST' })
  .validator((data: {
    name: string;
    provider: 'cloudflare' | 'openai' | 'openai-compatible';
    modelId: string;
    baseUrl?: string;
    apiKey?: string;
    capabilities: string;
    isDefaultText?: boolean;
    isDefaultImage?: boolean;
  }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const db = await getDb();
    const id = generateId();

    if (data.isDefaultText) {
      await db.update(aiModels).set({ isDefaultText: false });
    }
    if (data.isDefaultImage) {
      await db.update(aiModels).set({ isDefaultImage: false });
    }

    await db.insert(aiModels).values({
      id,
      name: (data.name || '').trim() || '未命名模型',
      provider: data.provider,
      modelId: (data.modelId || '').trim(),
      baseUrl: data.baseUrl ? data.baseUrl.trim() : null,
      apiKey: data.apiKey ? await encryptSecret(data.apiKey) : null,
      capabilities: data.capabilities || 'text',
      isDefaultText: !!data.isDefaultText,
      isDefaultImage: !!data.isDefaultImage,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { id };
  });

export const updateAiModelFn = createServerFn({ method: 'POST' })
  .validator((data: {
    id: string;
    name: string;
    provider: 'cloudflare' | 'openai' | 'openai-compatible';
    modelId: string;
    baseUrl?: string;
    apiKey?: string;
    capabilities: string;
    isDefaultText?: boolean;
    isDefaultImage?: boolean;
  }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const db = await getDb();

    if (data.isDefaultText) {
      await db.update(aiModels).set({ isDefaultText: false });
    }
    if (data.isDefaultImage) {
      await db.update(aiModels).set({ isDefaultImage: false });
    }

    const patch: any = {
      name: (data.name || '').trim() || '未命名模型',
      provider: data.provider,
      modelId: (data.modelId || '').trim(),
      baseUrl: data.baseUrl ? data.baseUrl.trim() : null,
      capabilities: data.capabilities || 'text',
      isDefaultText: !!data.isDefaultText,
      isDefaultImage: !!data.isDefaultImage,
      updatedAt: new Date(),
    };
    // Only overwrite the key when a new (non-empty) one is supplied.
    if (data.apiKey && data.apiKey.trim()) {
      patch.apiKey = await encryptSecret(data.apiKey.trim());
    }
    await db.update(aiModels).set(patch).where(eq(aiModels.id, data.id));
    return { success: true };
  });

export const deleteAiModelFn = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const db = await getDb();
    await db.delete(aiModels).where(eq(aiModels.id, data.id));
    return { success: true };
  });

// ---------------------------------------------------------------------------
// AI Prompts CRUD (admin only)
// ---------------------------------------------------------------------------

export const listAiPromptsFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    await requireAdmin();
    const db = await getDb();
    const rows = await db.select().from(aiPrompts).orderBy(desc(aiPrompts.createdAt));
    return {
      prompts: rows.map((p: any) => ({
        id: p.id,
        name: p.name,
        kind: p.kind,
        content: p.content,
        modelId: p.modelId || null,
        isDefault: !!p.isDefault,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    };
  });

export const createAiPromptFn = createServerFn({ method: 'POST' })
  .validator((data: { name: string; kind: 'text' | 'image'; content: string; modelId?: string | null; isDefault?: boolean }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const db = await getDb();
    const id = generateId();

    // Enabling a prompt clears the flag on all others of the same kind.
    if (data.isDefault) {
      await db.update(aiPrompts).set({ isDefault: false }).where(eq(aiPrompts.kind, data.kind));
    }

    await db.insert(aiPrompts).values({
      id,
      name: (data.name || '').trim() || '未命名提示词',
      kind: data.kind,
      content: data.content || '',
      modelId: data.modelId || null,
      isDefault: !!data.isDefault,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { id };
  });

export const updateAiPromptFn = createServerFn({ method: 'POST' })
  .validator((data: { id: string; name: string; kind: 'text' | 'image'; content: string; modelId?: string | null; isDefault?: boolean }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const db = await getDb();

    if (data.isDefault) {
      await db.update(aiPrompts).set({ isDefault: false }).where(eq(aiPrompts.kind, data.kind));
    }

    await db.update(aiPrompts).set({
      name: (data.name || '').trim() || '未命名提示词',
      kind: data.kind,
      content: data.content || '',
      modelId: data.modelId || null,
      isDefault: !!data.isDefault,
      updatedAt: new Date(),
    }).where(eq(aiPrompts.id, data.id));
    return { success: true };
  });

export const deleteAiPromptFn = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const db = await getDb();
    await db.delete(aiPrompts).where(eq(aiPrompts.id, data.id));
    return { success: true };
  });

// ---------------------------------------------------------------------------
// Editor AI defaults: returns the enabled (default) image prompt content so the
// editor can prefill the cover description. Text model/prompt resolution happens
// server-side at generation time, so the editor needs nothing else.
// ---------------------------------------------------------------------------

export const getAiForEditorFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    await requireAdmin();
    const db = await getDb();
    const row = (await db.select().from(aiPrompts)
      .where(and(eq(aiPrompts.kind, 'image'), eq(aiPrompts.isDefault, true)))
      .limit(1))[0];
    return { defaultCoverPrompt: row?.content || '' };
  });

export const uploadAssetFn = createServerFn({ method: 'POST' })
  .validator((data: { name: string; type: string; base64: string }) => data)
  .handler(async ({ data }) => {
    const buffer = Buffer.from(data.base64, 'base64');
    const extension = data.name.split('.').pop() || 'png';
    const cleanExtension = extension.replace(/[^a-zA-Z0-9]/g, '');
    const key = `${generateId()}.${cleanExtension || 'png'}`;
    const url = await putAsset(key, buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), data.type);
    return { url };
  });

// ---------- API Key 管理（后台，需管理员登录） ----------

export async function requireAdmin() {
  const { getCookie } = await import('@tanstack/react-start/server');
  const sessionToken = getCookie('inkwell_session');
  if (!sessionToken) throw new Error('未授权，请先登录');
  const creds = await getAuthCredentials();
  const session = await verifySession(sessionToken, creds.secret);
  if (!session) throw new Error('未授权，请先登录');
}

// 列出所有 API Key（不返回明文与哈希）
export const listApiKeysFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    await requireAdmin();
    const db = await getDb();
    const rows = await db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
    return {
      keys: rows.map((k: any) => ({
        id: k.id,
        name: k.name,
        prefix: k.keyPrefix,
        createdAt: k.createdAt,
        lastUsedAt: k.lastUsedAt,
      })),
    };
  });

// 创建 API Key，明文仅在此处返回一次
export const createApiKeyFn = createServerFn({ method: 'POST' })
  .validator((data: { name: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const db = await getDb();
    const { key, prefix, hash } = await generateApiKey();
    const id = generateId();
    await db.insert(apiKeys).values({
      id,
      name: (data.name || '').trim() || '未命名密钥',
      keyPrefix: prefix,
      keyHash: hash,
      createdAt: new Date(),
    });
    return { id, key, prefix };
  });

// 删除 API Key
export const deleteApiKeyFn = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const db = await getDb();
    await db.delete(apiKeys).where(eq(apiKeys.id, data.id));
    return { success: true };
  });

// ---------------------------------------------------------------------------
// Admin dashboard stats
// ---------------------------------------------------------------------------

export const getAdminStatsFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const db = await getDb();

    const totalPostsRes = await db.select({ val: count() }).from(posts);
    const totalPosts = totalPostsRes[0]?.val || 0;

    const draftsRes = await db.select({ val: count() }).from(posts).where(eq(posts.status, 'draft'));
    const drafts = draftsRes[0]?.val || 0;

    const publishedRes = await db.select({ val: count() }).from(posts).where(eq(posts.status, 'published'));
    const published = publishedRes[0]?.val || 0;

    const totalViewsRes = await db.select({ val: sql<number>`sum(${posts.views})` }).from(posts);
    const totalViews = Number(totalViewsRes[0]?.val) || 0;

    const totalCategoriesRes = await db.select({ val: count() }).from(categories);
    const totalCategories = totalCategoriesRes[0]?.val || 0;

    const totalTagsRes = await db.select({ val: count() }).from(tags);
    const totalTags = totalTagsRes[0]?.val || 0;

    const recentDrafts = await db
      .select({
        id: posts.id,
        title: posts.title,
        updatedAt: posts.updatedAt,
        createdAt: posts.createdAt,
      })
      .from(posts)
      .where(eq(posts.status, 'draft'))
      .orderBy(desc(posts.updatedAt), desc(posts.createdAt))
      .limit(5);

    const popularPosts = await db
      .select({
        id: posts.id,
        title: posts.title,
        views: posts.views,
        createdAt: posts.createdAt,
      })
      .from(posts)
      .where(eq(posts.status, 'published'))
      .orderBy(desc(posts.views))
      .limit(5);

    return {
      stats: {
        totalPosts,
        drafts,
        published,
        totalViews,
        totalCategories,
        totalTags,
      },
      recentDrafts,
      popularPosts,
    };
  });
