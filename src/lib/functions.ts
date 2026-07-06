import { createServerFn } from '@tanstack/react-start'
import { getAuthCredentials, verifySession } from './auth'
import { generateTitles, generateSlug, generateSummary, generateCoverImage } from './ai'
import { putAsset } from './storage'
import { generateId } from './id'

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

// AI Server Functions (shared between admin.posts.new.tsx and admin.posts.$id.tsx)
export const aiGenerateTitlesFn = createServerFn({ method: 'POST' })
  .validator((data: { content: string }) => data)
  .handler(async ({ data }) => {
    return await generateTitles(data.content);
  });

export const aiGenerateSlugFn = createServerFn({ method: 'POST' })
  .validator((data: { title: string; postId?: string }) => data)
  .handler(async ({ data }) => {
    return await generateSlug(data.title, data.postId);
  });

export const aiGenerateSummaryFn = createServerFn({ method: 'POST' })
  .validator((data: { content: string }) => data)
  .handler(async ({ data }) => {
    return await generateSummary(data.content);
  });

export const aiGenerateCoverFn = createServerFn({ method: 'POST' })
  .validator((data: { prompt: string }) => data)
  .handler(async ({ data }) => {
    return await generateCoverImage(data.prompt);
  });

export const uploadAssetFn = createServerFn({ method: 'POST' })
  .validator((data: { name: string; type: string; base64: string }) => data)
  .handler(async ({ data }) => {
    const buffer = Buffer.from(data.base64, 'base64');
    const extension = data.name.split('.').pop() || 'png';
    const cleanExtension = extension.replace(/[^a-zA-Z0-9]/g, '');
    const key = `${generateId()}.${cleanExtension || 'png'}`;
    const url = await putAsset(key, buffer, data.type);
    return { url };
  });
