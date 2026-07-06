import { HeadContent, Scripts, createRootRoute, useRouterState } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme-provider'
import { getDb } from '../lib/db'
import { siteSettings } from '../lib/schema'
import appCss from '../styles.css?url'
import adminCss from '../admin.css?url'

const DEFAULT_SETTINGS = [
  { key: "site_title", value: "Inkwell" },
  { key: "site_subtitle", value: "基于 TanStack Start & Cloudflare 边缘架构" },
  { key: "site_description", value: "Inkwell 是一个基于全栈边缘、全类型安全架构的现代化 AI 智能博客系统。" },
  { key: "keywords", value: "TanStack Start, Cloudflare D1, R2, Workers AI, Drizzle ORM, Blog" },
  { key: "language", value: "zh-CN" },
  { key: "page_size", value: "10" },
  { key: "github_url", value: "https://github.com" },
  { key: "twitter_url", value: "https://x.com" },
  { key: "show_github", value: "true" },
  { key: "show_twitter", value: "true" },
  { key: "rss_url", value: "" },
  { key: "icp_text", value: "© 2026 AI-Native Blog. All Rights Reserved." },
  { key: "google_analytics_id", value: "" },
];

// Initialize database tables if they don't exist
async function initDatabase(db: any) {
	// D1-compatible SQL without IF NOT EXISTS for indexes
	const statements = [
		`CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, slug TEXT NOT NULL, parent_id TEXT, sort_order INTEGER DEFAULT 0, color TEXT DEFAULT '#C15F3C' NOT NULL)`,
		`CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, slug TEXT NOT NULL, description TEXT, cover_image TEXT, content_blocks TEXT NOT NULL, content_html TEXT NOT NULL, category_id TEXT, status TEXT DEFAULT 'draft', views INTEGER DEFAULT 0 NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER)`,
		`CREATE TABLE IF NOT EXISTS posts_to_tags (post_id TEXT, tag_id TEXT, PRIMARY KEY(post_id, tag_id))`,
		`CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at INTEGER)`,
		`CREATE TABLE IF NOT EXISTS tags (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, slug TEXT NOT NULL)`,
	]

	// Create indexes separately (ignore if already exists)
	try {
		await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_unique ON categories (slug)`)
	} catch (e) {
		// Index may already exist, ignore
	}
	try {
		await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS posts_slug_unique ON posts (slug)`)
	} catch (e) {
		// Index may already exist, ignore
	}
	try {
		await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS tags_slug_unique ON tags (slug)`)
	} catch (e) {
		// Index may already exist, ignore
	}

	for (const stmt of statements) {
		try {
			await db.execute(stmt)
		} catch (err) {
			console.error('Failed to execute:', stmt, err)
		}
	}
}

// Loads site settings from D1, auto-seeding defaults on first run.
// Wrapped in createServerFn so the DB access (and the `cloudflare:workers`
// import inside getDb) only ever runs on the server — the loader is
// isomorphic and would otherwise execute in the browser on client navigation.
export const getSiteSettingsFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    // Add timeout protection to prevent blocking SSR stream
    const timeoutMs = 15000; // 15 second timeout for DB operations
    let timedOut = false;

    const timeoutPromise = new Promise<{ settings: Record<string, string> }>((resolve) => {
      setTimeout(() => {
        timedOut = true;
        const settings: Record<string, string> = {};
        for (const s of DEFAULT_SETTINGS) {
          settings[s.key] = s.value;
        }
        resolve({ settings });
      }, timeoutMs);
    });

    try {
      const dbPromise = (async () => {
        const db = await getDb();

        // Try to select from site_settings to check if tables exist
        try {
			await db.select().from(siteSettings).limit(1);
		} catch (e) {
			// Table doesn't exist, initialize database
			console.log('Initializing database...');
			await initDatabase(db);
		}

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
      })();

      const result = await Promise.race([dbPromise, timeoutPromise]);

      if (timedOut) {
        console.warn("getSiteSettingsFn timed out, using default settings");
      }

      return result;
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
    };
  },
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const { settings } = Route.useLoaderData() as { settings: Record<string, string> };
  const lang = settings?.language || "zh-CN";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = pathname.startsWith('/admin');

  const content = (
    <>
      <div className="flex-1 flex flex-col">
        {children}
      </div>
      <Toaster richColors position="top-center" />
    </>
  );

  // Both surfaces use the same serif/sans pairing (DESIGN-claude.md).
  const fontsHref = "https://fonts.googleapis.com/css2?family=Libre+Bodoni:wght@400;500;600;700&family=Public+Sans:wght@300;400;500;600;700&display=swap";

  return (
    <html lang={lang} data-theme={isAdmin ? 'admin' : 'site'} suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Google Analytics 4 — injected on the public site only, never in admin */}
        {settings.google_analytics_id && !isAdmin && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${settings.google_analytics_id}`} />
            <script>{`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${settings.google_analytics_id}', { send_page_view: true });
            `}</script>
          </>
        )}
        {/* Favicon */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        {/* Fonts loaded async to avoid render-blocking; font-display: swap in the URL */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={fontsHref} />
        <link rel="stylesheet" href={isAdmin ? adminCss : appCss} />
      </head>
      <body className="antialiased min-h-screen flex flex-col bg-background text-foreground">
        {isAdmin ? content : <ThemeProvider>{content}</ThemeProvider>}
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
