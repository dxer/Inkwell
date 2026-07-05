import { Link } from '@tanstack/react-router'
import { ThemeToggle } from './theme-toggle'
import { MobileNav } from './mobile-nav'
import { ChevronDown } from 'lucide-react'

type NavItem = { name: string; slug: string; kind: 'category' | 'tag' }
type SocialLink = { label: string; href: string }

interface SiteHeaderProps {
  siteTitle: string
  navItems: NavItem[]
  social: SocialLink[]
  width?: 'reading' | 'wide'
}

/**
 * Public-site header. Sticky, translucent. Renders desktop nav inline at md+,
 * collapses into MobileNav below md. Hosts the ThemeToggle and MobileNav islands.
 */
export function SiteHeader({ siteTitle, navItems, social, width }: SiteHeaderProps) {
  const categories = navItems.filter(item => item.kind === 'category')
  const maxWidth = width === 'wide' ? 'max-w-5xl' : 'max-w-3xl'

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-40">
      <div className={`${maxWidth} mx-auto px-5 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4`}>
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
          {categories.length > 0 && (
            <nav className="flex items-center text-xs text-muted-foreground">
              {/* Dropdown Menu Container */}
              <div className="relative group py-2">
                <button type="button" className="flex items-center gap-1 hover:text-primary transition-colors font-semibold cursor-pointer">
                  <span>Archives</span>
                  <ChevronDown size={11} className="group-hover:rotate-180 transition-transform duration-300 text-muted-foreground/60 group-hover:text-primary" />
                </button>
                
                {/* Floating Dropdown Card */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-44 rounded-lg border border-border/80 bg-background/95 backdrop-blur-md shadow-lg p-1.5 opacity-0 scale-95 translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200 z-50">
                  <div className="flex flex-col gap-0.5">
                    {/* Show All Categories Link */}
                    <Link
                      to="/"
                      className="px-3 py-1.5 rounded hover:bg-secondary hover:text-primary transition-colors text-left font-semibold block"
                    >
                      All Archives
                    </Link>
                    <div className="border-t border-border/40 my-1" />
                    {categories.map(c => (
                      <Link
                        key={c.slug}
                        to="/category/$slug"
                        params={{ slug: c.slug }}
                        className="px-3 py-1.5 rounded hover:bg-secondary hover:text-primary transition-colors text-left block truncate font-medium"
                      >
                        {c.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
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
          <MobileNav navItems={categories} social={social} />
        </div>
      </div>
    </header>
  )
}
