import type { ReactNode } from 'react'
import { SiteHeader } from './site-header'

type NavItem = { name: string; slug: string; kind: 'category' | 'tag' }
type SocialLink = { label: string; href: string }

interface SiteLayoutProps {
  children: ReactNode
  settings: Record<string, string>
  navItems?: NavItem[]
  width?: 'reading' | 'wide' // reading = max-w-3xl, wide = max-w-4xl
}

/**
 * Shared chrome for all public routes: sticky header + main + footer.
 * Server component (no client interactivity of its own); the header is a
 * client island. Eliminates the per-route header/footer duplication.
 */
export function SiteLayout({
  children,
  settings,
  navItems = [],
  width = 'reading',
}: SiteLayoutProps) {
  const siteTitle = settings.site_title || '智能无服务器博客'
  const icpText = settings.icp_text || '© 2026 AI-Native Blog. All Rights Reserved.'

  const showGithub = settings.show_github !== "false" && !!settings.github_url
  const showTwitter = settings.show_twitter !== "false" && !!settings.twitter_url

  const social: SocialLink[] = [
    showGithub && { label: 'GitHub', href: settings.github_url },
    showTwitter && { label: 'Twitter', href: settings.twitter_url },
    settings.rss_url && { label: 'RSS', href: settings.rss_url },
  ].filter(Boolean) as SocialLink[]

  const maxWidth = width === 'wide' ? 'max-w-5xl' : 'max-w-3xl'

  return (
    <div className="flex-1 flex flex-col min-h-[100dvh]">
      <SiteHeader siteTitle={siteTitle} navItems={navItems} social={social} width={width} />

      <main className={`flex-1 w-full ${maxWidth} mx-auto px-5 sm:px-6 lg:px-8 py-12`}>
        {children}
      </main>

      <footer className="border-t border-border mt-auto py-12 text-center text-xs text-muted-foreground">
        <div className={`${maxWidth} mx-auto px-5 sm:px-6 lg:px-8`}>
          <p>{icpText}</p>
        </div>
      </footer>
    </div>
  )
}
