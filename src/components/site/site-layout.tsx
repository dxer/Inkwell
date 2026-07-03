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

  const social: SocialLink[] = [
    settings.github_url && { label: 'GitHub', href: settings.github_url },
    settings.twitter_url && { label: 'Twitter', href: settings.twitter_url },
    settings.rss_url && { label: 'RSS', href: settings.rss_url },
  ].filter(Boolean) as SocialLink[]

  const maxWidth = width === 'wide' ? 'max-w-4xl' : 'max-w-3xl'

  return (
    <div className="flex-1 flex flex-col min-h-[100dvh]">
      <SiteHeader siteTitle={siteTitle} navItems={navItems} social={social} />

      <main className={`flex-1 w-full ${maxWidth} mx-auto px-5 sm:px-6 lg:px-8 py-12`}>
        {children}
      </main>

      <footer className="border-t border-border mt-auto py-8 text-center text-xs text-muted-foreground">
        <div className={`${maxWidth} mx-auto px-5 sm:px-6 lg:px-8`}>
          <p>{icpText}</p>
        </div>
      </footer>
    </div>
  )
}
