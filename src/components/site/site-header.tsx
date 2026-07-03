import { Link } from '@tanstack/react-router'
import { ThemeToggle } from './theme-toggle'
import { MobileNav } from './mobile-nav'

type NavItem = { name: string; slug: string; kind: 'category' | 'tag' }
type SocialLink = { label: string; href: string }

interface SiteHeaderProps {
  siteTitle: string
  navItems: NavItem[]
  social: SocialLink[]
}

/**
 * Public-site header. Sticky, translucent. Renders desktop nav inline at md+,
 * collapses into MobileNav below md. Hosts the ThemeToggle and MobileNav islands.
 */
export function SiteHeader({ siteTitle, navItems, social }: SiteHeaderProps) {
  const desktopNav = navItems.slice(0, 10)

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-4xl mx-auto px-5 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Title */}
        <Link
          to="/"
          className="text-xl sm:text-2xl font-bold tracking-tight hover:text-primary transition-colors"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          {siteTitle}
        </Link>

        {/* Desktop right cluster: nav + social + theme (hidden < md) */}
        <div className="hidden md:flex items-center gap-5">
          {desktopNav.length > 0 && (
            <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {desktopNav.map(item => (
                <Link
                  key={`${item.kind}-${item.slug}`}
                  to={item.kind === 'category' ? '/category/$slug' : '/tag/$slug'}
                  params={{ slug: item.slug }}
                  className="hover:text-primary transition-colors"
                >
                  {item.kind === 'tag' ? '#' : ''}
                  {item.name}
                </Link>
              ))}
            </nav>
          )}

          {social.length > 0 && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {social.map(s => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  {s.label}
                </a>
              ))}
            </div>
          )}

          <ThemeToggle />
        </div>

        {/* Mobile right cluster: theme + hamburger (< md) */}
        <div className="flex md:hidden items-center gap-1">
          <ThemeToggle />
          <MobileNav navItems={navItems} social={social} />
        </div>
      </div>
    </header>
  )
}
