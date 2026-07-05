import { getDb } from "./db";
import { posts } from "./schema";
import { eq } from "drizzle-orm";
import { putAsset } from "./storage";

async function callWorkersAI(model: string, body: any): Promise<any> {
  let accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  let apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const workersModule = "cloudflare:" + "workers";

  if (process.env.NODE_ENV !== "development") {
    try {
      // @ts-ignore - cloudflare:workers only exists inside workerd
      const { env } = await import(/* @vite-ignore */ workersModule);
      if (env.AI) {
        return await env.AI.run(model, body);
      }
    } catch {}
  }

  // Fallback to reading env from config if available
  if (!accountId || !apiToken) {
    try {
      // @ts-ignore - cloudflare:workers only exists inside workerd
      const { env } = await import(/* @vite-ignore */ workersModule);
      if (env.CLOUDFLARE_ACCOUNT_ID) accountId = env.CLOUDFLARE_ACCOUNT_ID;
      if (env.CLOUDFLARE_API_TOKEN) apiToken = env.CLOUDFLARE_API_TOKEN;
    } catch {}
  }

  // Local development calling Cloudflare Workers AI REST API
  if (accountId && apiToken) {
    try {
      const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      
      if (response.ok) {
        if (model.includes("stable-diffusion") || model.includes("dreamshaper")) {
          return await response.arrayBuffer();
        }
        const data = await response.json();
        return data.result;
      }
    } catch (e) {
      console.warn("REST call to Workers AI failed", e);
    }
  }

  return null;
}

export async function generateTitles(content: string): Promise<string[]> {
  const plainText = content.replace(/<[^>]*>/g, "").trim().substring(0, 1000);
  const prompt = `Based on the following content, generate 3 catchy, professional titles. Output the titles as a JSON array of strings: ["title1", "title2", "title3"]. Output ONLY the JSON array. Do not include markdown formatting or explanations.\n\nContent:\n${plainText}`;
  
  const result = await callWorkersAI("@cf/meta/llama-3.1-8b-instruct", {
    messages: [
      { role: "system", content: "You are a professional editor. You must only output a valid JSON array of strings." },
      { role: "user", content: prompt }
    ]
  });

  if (result && result.response) {
    try {
      // Clean potential markdown blocks
      let text = result.response.trim();
      if (text.startsWith("```json")) {
        text = text.substring(7, text.length - 3).trim();
      } else if (text.startsWith("```")) {
        text = text.substring(3, text.length - 3).trim();
      }
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length >= 3) {
        return parsed.slice(0, 3);
      }
    } catch (e) {
      console.warn("Failed to parse AI titles", e);
    }
  }

  // Fallback Mock Titles
  return [
    "深入浅出：基于边缘计算的 Serverless 博客系统开发",
    "为什么说 TanStack Start + Cloudflare D1 是全栈的未来",
    "极致性能：如何实现前台页面零 JavaScript 捆绑与 SSR 渲染"
  ];
}

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
  const prompt = `Convert the following title into a clean URL slug (lowercase, English letters, numbers, and hyphens only). If the title is in another language like Chinese, translate it to English first. Output ONLY the slug string, do not include markdown or explanations.\n\nTitle: ${title}`;
  
  const result = await callWorkersAI("@cf/meta/llama-3.1-8b-instruct", {
    messages: [
      { role: "system", content: "You are a URL slug generator. You only output the raw translated slug string." },
      { role: "user", content: prompt }
    ]
  });

  let rawSlug = "";
  if (result && result.response) {
    rawSlug = result.response.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  }

  if (!rawSlug) {
    // Simple mock slugify
    rawSlug = title
      .toLowerCase()
      // simple translation map for common Chinese keywords
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

export async function generateSummary(content: string): Promise<string> {
  const plainText = content.replace(/<[^>]*>/g, "").trim().substring(0, 2000);
  const prompt = `Write a concise SEO meta description (under 150 characters) summarizing the following content. Output ONLY the summary text, nothing else.\n\nContent:\n${plainText}`;
  
  const result = await callWorkersAI("@cf/meta/llama-3.1-8b-instruct", {
    messages: [
      { role: "system", content: "You are an SEO specialist. You write compact, click-worthy summaries under 150 characters." },
      { role: "user", content: prompt }
    ]
  });

  if (result && result.response) {
    return result.response.trim().substring(0, 150);
  }

  // Fallback Mock Summary
  const mockText = plainText.length > 140 ? plainText.substring(0, 140) + "..." : plainText;
  return mockText || "这篇文章详细探讨了如何利用现代前端和边缘计算栈构建高性能博客系统。";
}

export async function generateCoverImage(prompt: string): Promise<string> {
  const model = "@cf/stabilityai/stable-diffusion-xl-base-1.0";
  const resultBuffer = await callWorkersAI(model, { prompt });
  
  const key = `cover-${Date.now()}.png`;
  
  if (resultBuffer) {
    // Save generated binary stream to storage
    return await putAsset(key, resultBuffer, "image/png");
  }

  // Fallback: Fetch a beautiful random mock image from Lorem Picsum and save it locally
  try {
    const response = await fetch("https://picsum.photos/1200/800");
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      return await putAsset(key, buffer, "image/jpeg");
    }
  } catch (e) {
    console.warn("Lorem Picsum fetch failed, generating a placeholder SVG.", e);
  }

  // Absolute fallback: static simple inline svg or empty block
  const dummySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400">
    <rect width="100%" height="100%" fill="#1e293b"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-size="24" font-family="sans-serif">
      AI Cover: ${prompt.substring(0, 40)}
    </text>
  </svg>`;
  const encoder = new TextEncoder();
  return await putAsset(key, encoder.encode(dummySvg).buffer, "image/svg+xml");
}
