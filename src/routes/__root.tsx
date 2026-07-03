import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { Toaster } from '@/components/ui/sonner'
import { getDb } from '../lib/db'
import { siteSettings } from '../lib/schema'
import appCss from '../styles.css?url'

const DEFAULT_SETTINGS = [
  { key: "site_title", value: "智能无服务器博客" },
  { key: "site_subtitle", value: "基于 TanStack Start & Cloudflare 边缘架构" },
  { key: "site_description", value: "这是一个基于全栈边缘、全类型安全架构的现代化 AI 智能博客系统。" },
  { key: "keywords", value: "TanStack Start, Cloudflare D1, R2, Workers AI, Drizzle ORM, Blog" },
  { key: "language", value: "zh-CN" },
  { key: "page_size", value: "10" },
  { key: "github_url", value: "https://github.com" },
  { key: "twitter_url", value: "https://x.com" },
  { key: "rss_url", value: "" },
  { key: "icp_text", value: "© 2026 AI-Native Blog. All Rights Reserved." },
];

// Loads site settings from D1, auto-seeding defaults on first run.
// Wrapped in createServerFn so the DB access (and the `cloudflare:workers`
// import inside getDb) only ever runs on the server — the loader is
// isomorphic and would otherwise execute in the browser on client navigation.
export const getSiteSettingsFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    try {
      const db = await getDb();
      let settingsList = await db.select().from(siteSettings);

      // Auto seed if empty. Use ON CONFLICT DO NOTHING so concurrent loader
      // invocations (Strict Mode / parallel requests) don't race on the PK
      // and throw UNIQUE constraint errors.
      if (settingsList.length === 0) {
        for (const setting of DEFAULT_SETTINGS) {
          await db.insert(siteSettings).values({
            key: setting.key,
            value: setting.value,
            updatedAt: new Date(),
          }).onConflictDoNothing();
        }
        settingsList = await db.select().from(siteSettings);
      }

      const settings: Record<string, string> = {};
      for (const s of settingsList) {
        settings[s.key] = s.value;
      }
      return { settings };
    } catch (e) {
      console.error("Failed to load settings in root loader", e);
      // Fallback settings in case DB is not available yet
      const settings: Record<string, string> = {};
      for (const s of DEFAULT_SETTINGS) {
        settings[s.key] = s.value;
      }
      return { settings };
    }
  });

export const Route = createRootRoute({
  loader: async () => {
    return await getSiteSettingsFn();
  },
  head: ({ loaderData }) => {
    const settings = loaderData?.settings || {};
    const title = settings.site_title || '智能无服务器博客';
    const description = settings.site_description || '基于 TanStack Start & Cloudflare 边缘架构';
    const keywords = settings.keywords || 'blog, serverless, AI';

    return {
      meta: [
        {
          charSet: 'utf-8',
        },
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1',
        },
        {
          name: 'description',
          content: description,
        },
        {
          name: 'keywords',
          content: keywords,
        },
        {
          title: title,
        },
      ],
      links: [
        {
          rel: 'stylesheet',
          href: appCss,
        },
      ],
    };
  },
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const { settings } = Route.useLoaderData() as { settings: Record<string, string> };
  const lang = settings?.language || "zh-CN";

  return (
    <html lang={lang}>
      <head>
        <HeadContent />
        {/* Fonts loaded async to avoid render-blocking; font-display: swap in the URL */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Libre+Bodoni:wght@400;500;600;700&family=Public+Sans:wght@300;400;500;600;700&display=swap"
        />
      </head>
      <body className="antialiased min-h-screen flex flex-col bg-background text-foreground">
        <div className="flex-1 flex flex-col">
          {children}
        </div>
        <Toaster richColors position="top-center" />
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
