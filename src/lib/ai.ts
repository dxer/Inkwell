import { getDb } from "./db";
import { posts } from "./schema";
import { eq } from "drizzle-orm";
import { putAsset } from "./storage";

/** A model resolved from the DB with its (already decrypted) API key. */
export interface ResolvedModel {
  provider: "cloudflare" | "openai" | "openai-compatible";
  modelId: string;
  baseUrl?: string | null;
  apiKey?: string | null; // plaintext, decrypted by the caller
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const DEFAULT_TEXT_MODEL: ResolvedModel = {
  provider: "cloudflare",
  modelId: "@cf/meta/llama-3.1-8b-instruct",
};

const DEFAULT_IMAGE_MODEL: ResolvedModel = {
  provider: "cloudflare",
  modelId: "@cf/stabilityai/stable-diffusion-xl-base-1.0",
};

// ---------------------------------------------------------------------------
// Low-level model callers (provider-aware)
// ---------------------------------------------------------------------------

/** Call a text model and return the assistant's reply text (or null on failure). */
async function callTextModel(
  model: ResolvedModel,
  messages: ChatMessage[],
  temperature = 0.7,
): Promise<string | null> {
  if (model.provider === "cloudflare") {
    let accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    let apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (process.env.NODE_ENV !== "development") {
      try {
        // @ts-ignore - cloudflare:workers only exists inside workerd
        const { env } = await import(/* @vite-ignore */ "cloudflare:workers");
        if (env.AI) {
          const result = await env.AI.run(model.modelId, { messages });
          return (result as any)?.response ?? null;
        }
      } catch {}
    }

    if (!accountId || !apiToken) {
      try {
        // @ts-ignore
        const { env } = await import(/* @vite-ignore */ "cloudflare:workers");
        if (env.CLOUDFLARE_ACCOUNT_ID) accountId = env.CLOUDFLARE_ACCOUNT_ID;
        if (env.CLOUDFLARE_API_TOKEN) apiToken = env.CLOUDFLARE_API_TOKEN;
      } catch {}
    }

    if (accountId && apiToken) {
      try {
        const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model.modelId}`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ messages }),
        });
        if (res.ok) {
          const data = await res.json();
          return data?.result?.response ?? null;
        }
      } catch (e) {
        console.warn("Cloudflare Workers AI (REST) text call failed", e);
      }
    }
    return null;
  }

  // OpenAI / OpenAI-compatible chat completions
  const base = model.baseUrl || (model.provider === "openai" ? "https://api.openai.com/v1" : "");
  if (!base) throw new Error("该模型缺少 API 基地址（base_url）");
  if (!model.apiKey) throw new Error("该模型缺少 API Key");

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${model.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model.modelId,
        messages,
        temperature,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`模型调用失败 (HTTP ${res.status}): ${errText.slice(0, 200)}`);
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? null;
  } catch (e) {
    console.warn("OpenAI-compatible text call failed", e);
    throw e;
  }
}

/** Call an image model and return the generated image bytes (or null on failure). */
async function callImageModel(model: ResolvedModel, prompt: string): Promise<ArrayBuffer | null> {
  if (model.provider === "cloudflare") {
    let accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    let apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (process.env.NODE_ENV !== "development") {
      try {
        // @ts-ignore
        const { env } = await import(/* @vite-ignore */ "cloudflare:workers");
        if (env.AI) {
          return (await env.AI.run(model.modelId, { prompt })) as ArrayBuffer;
        }
      } catch {}
    }

    if (!accountId || !apiToken) {
      try {
        // @ts-ignore
        const { env } = await import(/* @vite-ignore */ "cloudflare:workers");
        if (env.CLOUDFLARE_ACCOUNT_ID) accountId = env.CLOUDFLARE_ACCOUNT_ID;
        if (env.CLOUDFLARE_API_TOKEN) apiToken = env.CLOUDFLARE_API_TOKEN;
      } catch {}
    }

    if (accountId && apiToken) {
      try {
        const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model.modelId}`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ prompt }),
        });
        if (res.ok) return await res.arrayBuffer();
      } catch (e) {
        console.warn("Cloudflare Workers AI (REST) image call failed", e);
      }
    }
    return null;
  }

  // OpenAI / OpenAI-compatible images generations
  const base = model.baseUrl || (model.provider === "openai" ? "https://api.openai.com/v1" : "");
  if (!base) throw new Error("该模型缺少 API 基地址（base_url）");
  if (!model.apiKey) throw new Error("该模型缺少 API Key");

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${model.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model.modelId,
        prompt,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json",
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`图片生成失败 (HTTP ${res.status}): ${errText.slice(0, 200)}`);
    }
    const data = await res.json();
    const item = data?.data?.[0];
    if (item?.b64_json) {
      const binary = atob(item.b64_json);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes.buffer;
    }
    if (item?.url) {
      const imgRes = await fetch(item.url);
      if (imgRes.ok) return await imgRes.arrayBuffer();
    }
    return null;
  } catch (e) {
    console.warn("OpenAI-compatible image call failed", e);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Slug helpers (unchanged)
// ---------------------------------------------------------------------------

export async function checkSlugUnique(slug: string, postId?: string): Promise<string> {
  const db = await getDb();
  let baseSlug = slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  if (!baseSlug) baseSlug = "post";

  let uniqueSlug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await db.select().from(posts).where(eq(posts.slug, uniqueSlug));
    if (existing.length === 0 || (postId && existing[0].id === postId)) {
      break;
    }
    uniqueSlug = `${baseSlug}-${counter}`;
    counter++;
  }

  return uniqueSlug;
}

export async function generateSlug(title: string, postId?: string): Promise<string> {
  const model = DEFAULT_TEXT_MODEL;
  const prompt = `Convert the following title into a clean URL slug (lowercase, English letters, numbers, and hyphens only). If the title is in another language like Chinese, translate it to English first. Output ONLY the slug string, do not include markdown or explanations.\n\nTitle: ${title}`;

  let rawSlug = "";
  try {
    const result = await callTextModel(model, [
      { role: "system", content: "You are a URL slug generator. You only output the raw translated slug string." },
      { role: "user", content: prompt },
    ]);
    if (result) rawSlug = result.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  } catch {}

  if (!rawSlug) {
    rawSlug = title
      .toLowerCase()
      .replace(/博客/g, "blog")
      .replace(/教程/g, "tutorial")
      .replace(/文章/g, "article")
      .replace(/技术/g, "tech")
      .replace(/前端/g, "frontend")
      .replace(/后端/g, "backend")
      .replace(/智能/g, "ai")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  return await checkSlugUnique(rawSlug, postId);
}

// ---------------------------------------------------------------------------
// Text generators (now accept an optional model + system prompt)
// ---------------------------------------------------------------------------

export async function generateTitles(
  content: string,
  model?: ResolvedModel | null,
  systemPrompt?: string,
): Promise<string[]> {
  const m = model ?? DEFAULT_TEXT_MODEL;
  const plainText = content.replace(/<[^>]*>/g, "").trim().substring(0, 1000);
  const prompt = `Based on the following content, generate 3 catchy, professional titles. Output the titles as a JSON array of strings: ["title1", "title2", "title3"]. Output ONLY the JSON array. Do not include markdown formatting or explanations.\n\nContent:\n${plainText}`;

  try {
    const result = await callTextModel(m, [
      { role: "system", content: systemPrompt || "You are a professional editor. You must only output a valid JSON array of strings." },
      { role: "user", content: prompt },
    ]);

    if (result) {
      let text = result.trim();
      if (text.startsWith("```json")) text = text.substring(7, text.length - 3).trim();
      else if (text.startsWith("```")) text = text.substring(3, text.length - 3).trim();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length >= 3) {
        return parsed.slice(0, 3);
      }
    }
  } catch (e) {
    console.warn("Failed to parse AI titles", e);
  }

  return [
    "深入浅出：基于边缘计算的 Serverless 博客系统开发",
    "为什么说 TanStack Start + Cloudflare D1 是全栈的未来",
    "极致性能：如何实现前台页面零 JavaScript 捆绑与 SSR 渲染",
  ];
}

export async function generateSummary(
  content: string,
  model?: ResolvedModel | null,
  systemPrompt?: string,
): Promise<string> {
  const m = model ?? DEFAULT_TEXT_MODEL;
  const plainText = content.replace(/<[^>]*>/g, "").trim().substring(0, 2000);
  const prompt = `Write a concise SEO meta description (under 150 characters) summarizing the following content. Output ONLY the summary text, nothing else.\n\nContent:\n${plainText}`;

  try {
    const result = await callTextModel(m, [
      { role: "system", content: systemPrompt || "You are an SEO specialist. You write compact, click-worthy summaries under 150 characters." },
      { role: "user", content: prompt },
    ]);
    if (result) return result.trim().substring(0, 150);
  } catch {}

  const mockText = plainText.length > 140 ? plainText.substring(0, 140) + "..." : plainText;
  return mockText || "这篇文章详细探讨了如何利用现代前端和边缘计算栈构建高性能博客系统。";
}

export async function generateKeywords(
  content: string,
  model?: ResolvedModel | null,
  systemPrompt?: string,
): Promise<string> {
  const m = model ?? DEFAULT_TEXT_MODEL;
  const plainText = content.replace(/<[^>]*>/g, "").trim().substring(0, 2000);
  const prompt = `Extract 5 to 8 SEO keywords from the following content. Output ONLY a comma-separated list of keywords (no numbering, no bullet points, no explanation). Example: react, typescript, ssr\n\nContent:\n${plainText}`;

  try {
    const result = await callTextModel(m, [
      { role: "system", content: systemPrompt || "You are an SEO keyword extractor. You output ONLY a comma-separated list of keywords." },
      { role: "user", content: prompt },
    ]);

    if (result) {
      const cleaned = result
        .toLowerCase()
        .replace(/^\s*\d+[\.)]\s*/gm, "")
        .replace(/^\s*[-•*]\s*/gm, "")
        .split(/[,，、\n]+/)
        .map((s: string) => s.trim())
        .filter((s: string) => s && !/^(http|www\.)/i.test(s))
        .filter((v: string, i: number, arr: string[]) => arr.indexOf(v) === i)
        .slice(0, 8)
        .join(", ");
      if (cleaned) return cleaned;
    }
  } catch {}

  return "前端开发, React, SSR, 全栈, 边缘计算";
}

export async function generateAllMeta(
  content: string,
  postId?: string,
  model?: ResolvedModel | null,
  systemPrompt?: string,
): Promise<{ titles: string[]; slug: string; description: string; keywords: string }> {
  const m = model ?? DEFAULT_TEXT_MODEL;
  const plainText = content.replace(/<[^>]*>/g, "").trim().substring(0, 2500);
  const prompt = `You are a professional blog editor and SEO specialist. Read the following article content and produce ALL of the following in a SINGLE JSON object (output ONLY the JSON, no markdown, no explanation):

{
  "titles": ["3 catchy, professional titles for this article"],
  "slug": "a clean english URL slug (lowercase, hyphen-separated) best representing the article",
  "description": "a concise SEO meta description under 150 characters",
  "keywords": "5 to 8 comma-separated SEO keywords (no numbering, no bullets)"
}

Rules:
- Translate non-English titles into English only inside the "slug" field; keep titles in the article's original language.
- Output strictly valid JSON. No trailing commas, no code fences.

Content:
${plainText}`;

  let titles: string[] | null = null;
  let rawSlug = "";
  let description = "";
  let keywords = "";

  try {
    const result = await callTextModel(m, [
      { role: "system", content: systemPrompt || "You are a JSON-only API. You output a single valid JSON object and nothing else." },
      { role: "user", content: prompt },
    ]);

    if (result) {
      let text = result.trim();
      if (text.startsWith("```json")) text = text.substring(7, text.length - 3).trim();
      else if (text.startsWith("```")) text = text.substring(3, text.length - 3).trim();
      const firstBrace = text.indexOf("{");
      const lastBrace = text.lastIndexOf("}");
      if (firstBrace > 0 && lastBrace > firstBrace) text = text.substring(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed.titles)) {
        titles = parsed.titles
          .map((t: unknown) => (typeof t === "string" ? t.trim() : ""))
          .filter(Boolean)
          .slice(0, 3) as string[];
      }
      if (typeof parsed.slug === "string") {
        rawSlug = parsed.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/(^-|-$)/g, "");
      }
      if (typeof parsed.description === "string") description = parsed.description.trim().substring(0, 150);
      if (typeof parsed.keywords === "string") {
        keywords = parsed.keywords
          .toLowerCase()
          .replace(/^\s*\d+[\.)]\s*/gm, "")
          .replace(/^\s*[-•*]\s*/gm, "")
          .split(/[,，、\n]+/)
          .map((s: string) => s.trim())
          .filter((s: string) => s && !/^(http|www\.)/i.test(s))
          .filter((v: string, i: number, arr: string[]) => arr.indexOf(v) === i)
          .slice(0, 8)
          .join(", ");
      }
    }
  } catch (e) {
    console.warn("generateAllMeta: model call failed", e);
  }

  if (!titles || titles.length === 0) {
    titles = [
      "深入浅出：基于边缘计算的 Serverless 博客系统开发",
      "为什么说 TanStack Start + Cloudflare D1 是全栈的未来",
      "极致性能：如何实现前台页面零 JavaScript 捆绑与 SSR 渲染",
    ];
  }
  if (!description) {
    description = plainText.length > 140 ? plainText.substring(0, 140) + "..." : (plainText || "这篇文章详细探讨了如何利用现代前端和边缘计算栈构建高性能博客系统。");
  }
  if (!keywords) {
    keywords = "前端开发, React, SSR, 全栈, 边缘计算";
  }
  if (!rawSlug) {
    const fallbackTitle = titles[0] || "post";
    rawSlug = fallbackTitle
      .toLowerCase()
      .replace(/博客/g, "blog")
      .replace(/教程/g, "tutorial")
      .replace(/文章/g, "article")
      .replace(/技术/g, "tech")
      .replace(/前端/g, "frontend")
      .replace(/后端/g, "backend")
      .replace(/智能/g, "ai")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  const slug = await checkSlugUnique(rawSlug, postId);
  return { titles, slug, description, keywords };
}

export async function generateCoverImage(
  prompt: string,
  model?: ResolvedModel | null,
): Promise<string> {
  const m = model ?? DEFAULT_IMAGE_MODEL;
  let resultBuffer: ArrayBuffer | null = null;
  try {
    resultBuffer = await callImageModel(m, prompt);
  } catch (e) {
    // Re-throw so the UI can surface a meaningful error for configured models.
    const msg = (e as Error)?.message || "图片生成失败";
    throw new Error(msg);
  }

  const key = `cover-${Date.now()}.png`;

  if (resultBuffer) {
    return await putAsset(key, resultBuffer, "image/png");
  }

  // Fallback: Fetch a random mock image from Lorem Picsum and save it locally.
  try {
    const response = await fetch("https://picsum.photos/1200/800");
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      return await putAsset(key, buffer, "image/jpeg");
    }
  } catch (e) {
    console.warn("Lorem Picsum fetch failed, generating a placeholder SVG.", e);
  }

  const dummySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400">
    <rect width="100%" height="100%" fill="#1e293b"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-size="24" font-family="sans-serif">
      AI Cover: ${prompt.substring(0, 40)}
    </text>
  </svg>`;
  const encoder = new TextEncoder();
  return await putAsset(key, encoder.encode(dummySvg).buffer, "image/svg+xml");
}
