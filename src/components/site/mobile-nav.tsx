import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Menu, X } from 'lucide-react'

type NavItem = { name: string; slug: string; kind: 'category' | 'tag' }
type SocialLink = { label: string; href: string }

interface MobileNavProps {
  /** Top navigation items (categories first, then a few tags). */
  navItems: NavItem[]
  /** Social profile links (github/twitter/rss). */
  social: SocialLink[]
}

/**
 * <md hamburger + dropdown drawer. Renders nothing on md+ (hidden via CSS).
 * Closes on ESC, outside click, and link navigation.
 */
export function MobileNav({ navItems, social }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div ref={containerRef} className="relative md:hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label={open ? '关闭菜单' : '打开菜单'}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors active:translate-y-[1px]"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {/* Drawer */}
      {open && (
        <div
          id="mobile-nav-panel"
          className="absolute right-0 top-[calc(100%+0.5rem)] w-72 max-w-[calc(100vw-2.5rem)] rounded-lg border border-border bg-popover shadow-lg p-2"
        >
          <nav className="flex flex-col">
            {navItems.map(item => (
              <Link
                key={`${item.kind}-${item.slug}`}
                to={item.kind === 'category' ? '/category/$slug' : '/tag/$slug'}
                params={{ slug: item.slug }}
                onClick={() => setOpen(false)}
                className="px-3 py-2.5 rounded-md text-sm text-foreground hover:bg-secondary hover:text-primary transition-colors"
              >
                {item.kind === 'tag' ? '#' : ''}
                {item.name}
              </Link>
            ))}
          </nav>

          {social.length > 0 && (
            <>
              <div className="my-1 h-px bg-border" />
              <div className="flex flex-col">
                {social.map(s => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setOpen(false)}
                    className="px-3 py-2.5 rounded-md text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
