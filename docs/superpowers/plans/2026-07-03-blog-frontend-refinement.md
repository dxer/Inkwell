# Blog Frontend Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the existing warm-editorial personal blog into a calmer, fully responsive, subtly animated reading experience with wired-up dark mode — without changing its visual identity, content, routes, or the admin console.

**Architecture:** Extract a shared `SiteLayout` (server component) wrapping all 4 public routes, isolating the interactive bits (theme toggle, mobile nav) into `'use client'` islands. Wire up the already-present `next-themes` (`attribute="class"`, `defaultTheme="system"`) with an anti-FOUC inline script. Add a `.dark` token block to `styles.css`. Add subtle micro-motion via pure CSS + one shared `useInView` IntersectionObserver hook. Apply fluid `clamp()` type scale.

**Tech Stack:** TanStack Start (SSR) + React 19 + Tailwind CSS v4 + shadcn/ui + lucide-react + next-themes. Drizzle/D1 + R2 unchanged. No new runtime dependencies. No animation library.

**Spec:** `docs/superpowers/specs/2026-07-03-blog-frontend-refinement-design.md`

**Conventions for this plan:**
- Import alias: use `@/...` (resolves to `./src/...` per `tsconfig.json` paths). Existing code mixes `@/` and relative `../`; follow what each file already uses.
- This codebase has **no test harness** (vitest + jsdom installed but no config, no existing tests). This plan is presentational/visual work. **Verification is by dev server + build, not unit tests.** Each task ends with a manual check + `pnpm build` gate.
- Em-dashes (`—` / `–`) are banned in all visible copy. Use `-` or restructure. Audit every string before commit.
- Never use `h-screen`; use `min-h-[100dvh]`.
- Never use `window.addEventListener('scroll')`.
- Every motion block must be gated by `@media (prefers-reduced-motion: reduce)` or IO-driven with a reduced-motion guard.

**Reference files (current state, read before editing):**
- `src/styles.css` — tokens, `.prose-reader`, `.animate-rise`
- `src/routes/__root.tsx` — root document, `RootDocument`, settings loader
- `src/routes/index.tsx` — home (header + tag nav + divided list + pagination + footer)
- `src/routes/posts.$slug.tsx` — post detail (mini header + article + tags footer)
- `src/routes/tag.$slug.tsx` — tag archive (card grid)
- `src/routes/category.$slug.tsx` — category archive (same card grid shape as tag)
- `src/components/ui/sonner.tsx` — already imports `useTheme` from `next-themes`

---

## File Structure

**Create:**
- `src/components/site/site-layout.tsx` — server component. Renders `<SiteHeader />`, `<main>` (width via prop), `<footer>`. Single responsibility: shared chrome for public routes.
- `src/components/site/site-header.tsx` — `'use client'` island. Renders title link, desktop nav (categories/tags), social links, `<ThemeToggle />`, `<MobileNav />`. Owns no data; receives `settings`, `categories`, `tags` as props from the server route.
- `src/components/site/theme-toggle.tsx` — `'use client'` island. Sun/Moon button calling `next-themes` `useTheme()`.
- `src/components/site/mobile-nav.tsx` — `'use client'` island. Hamburger button + dropdown drawer (`aria-expanded`, ESC + outside-click close, keyboard reachable).
- `src/lib/use-in-view.ts` — shared `useInView` hook (IntersectionObserver, reduced-motion aware). Returns a ref + boolean. Cleans up on unmount.

**Modify:**
- `src/styles.css` — add `.dark` token block; fluid type-scale CSS variables; theme-transition utilities; refine `.animate-rise` to be IO-driven via `.is-visible`; reduced-motion guards; `.prose-reader` dark refinements.
- `src/routes/__root.tsx` — wrap app in `<ThemeProvider>`; add anti-FOUC inline script; move Google Fonts `@import` to `<link>` preconnect+stylesheet in `head`.
- `src/routes/index.tsx` — replace self-declared header/footer with `<SiteLayout>`; apply fluid type + IO entrance to list items; raise body copy to 16px; mobile touch targets on pagination.
- `src/routes/posts.$slug.tsx` — replace mini header/footer with `<SiteLayout width="reading">`; fluid title; responsive cover aspect ratio (`16/9` mobile → `21/9` desktop).
- `src/routes/tag.$slug.tsx` — replace header/footer with `<SiteLayout width="wide">`; IO entrance on cards.
- `src/routes/category.$slug.tsx` — same as tag route.
- `src/routes/index.tsx` (and tag/category) — pass `categories`/`tags`/`settings` into `<SiteLayout>` (data already loaded by each route's loader).

**Unchanged:** all `admin.*` routes, `api/*`, schema, db, editor, BlockNote.

---

## Task 1: Add dark-mode tokens and fluid type scale to `styles.css`

**Files:**
- Modify: `src/styles.css`

This task is CSS-only, no JS, no SSR concerns. It lays the token foundation everything else uses.

- [ ] **Step 1: Read current `src/styles.css`** to anchor the edit points (the `:root` block at lines ~62-85, the `@theme` block, `.prose-reader`, `.animate-rise`).

- [ ] **Step 2: Add the `.dark` token block inside `@layer base`**, immediately after the existing `:root { ... }` block. Use the same HSL-triplet format. Exact values:

```css
  /*
   * Dark theme — same warm family, darkened. No pure black, no pure white.
   * Terracotta lifted one step for AA contrast on the dark surface.
   *   background  #1B1916  warm near-black
   *   foreground  #EDEAE3  warm off-white (paper feel preserved)
   *   card        #262320  elevated warm surface
   *   primary     #D8764F  Crail lifted (AA on dark)
   *   border      #3A352F  warm dark hairline
   *   muted-fg    #A8A29A  warm light grey (AA on dark)
   */
  .dark {
    --background: 30 12% 9%;            /* #1B1916 warm near-black */
    --foreground: 40 14% 91%;           /* #EDEAE3 warm off-white */
    --card: 30 8% 14%;                  /* #262320 elevated warm surface */
    --card-foreground: 40 14% 91%;
    --popover: 30 8% 14%;
    --popover-foreground: 40 14% 91%;
    --primary: 18 65% 58%;              /* #D8764F Crail lifted */
    --primary-foreground: 30 12% 9%;
    --secondary: 30 6% 18%;
    --secondary-foreground: 40 14% 91%;
    --muted: 30 6% 16%;
    --muted-foreground: 36 6% 64%;      /* #A8A29A warm light grey, AA on dark */
    --accent: 18 65% 58%;
    --accent-foreground: 30 12% 9%;
    --destructive: 0 62% 52%;
    --destructive-foreground: 40 14% 91%;
    --border: 30 10% 20%;               /* #3A352F warm dark hairline */
    --input: 30 10% 20%;
    --ring: 18 65% 58%;
    --brand: 18 65% 58%;
    --brand-foreground: 30 12% 9%;
  }
```

- [ ] **Step 3: Add fluid type-scale semantic variables** inside the existing `@theme { ... }` block (after the `--font-*` lines):

```css
  /* Fluid type scale (clamp) — responsive across breakpoints */
  --text-post-title: clamp(1.875rem, 4vw + 1rem, 3rem);          /* detail H1 */
  --text-list-title: clamp(1.375rem, 1.5vw + 1rem, 1.875rem);    /* home H2 */
  --text-archive-title: clamp(1.75rem, 2.5vw + 1rem, 2.5rem);    /* tag/category H1 */
```

- [ ] **Step 4: Add a smooth theme-transition utility and reduced-motion guard.** Append near the bottom of the file (after `.animate-rise`):

```css
  /* Smooth color transition when switching themes. Only colors, never layout. */
  @media (prefers-reduced-motion: no-preference) {
    html.theme-transition,
    html.theme-transition *,
    html.theme-transition *::before,
    html.theme-transition *::after {
      transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease;
      transition-delay: 0 !important;
    }
  }
```

(The `.theme-transition` class is toggled by the theme toggle in Task 4 so the transition only fires on user-initiated switches, not on first paint.)

- [ ] **Step 5: Refine `.animate-rise` to be IntersectionObserver-driven.** Replace the existing `.animate-rise` block (the `@media (prefers-reduced-motion: no-preference) { .animate-rise { animation: rise ... } }` and its `@keyframes rise`) with:

```css
  /* List/card entrance — toggled by IntersectionObserver adding .is-visible.
     Items start hidden, rise + fade in when scrolled into view. */
  @media (prefers-reduced-motion: no-preference) {
    .reveal {
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 0.4s cubic-bezier(0.22, 1, 0.36, 1),
                  transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
      transition-delay: calc(var(--reveal-index, 0) * 50ms);
    }
    .reveal.is-visible {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .reveal {
      opacity: 1;
      transform: none;
      transition: none;
    }
  }
```

- [ ] **Step 6: Add `.prose-reader` dark refinements** inside the existing `.prose-reader` ruleset scope (append new rules after the existing `.prose-reader blockquote` rule):

```css
  /* Ensure rendered article HTML reads well in dark mode */
  .dark .prose-reader code {
    background: hsl(var(--secondary));
    color: hsl(var(--foreground));
  }
  .dark .prose-reader pre {
    background: hsl(var(--secondary));
  }
```

- [ ] **Step 7: Verify the build still compiles.**

Run: `pnpm build`
Expected: build succeeds (CSS is processed by `@tailwindcss/vite`; syntax errors fail the build).

- [ ] **Step 8: Commit.**

```bash
git add src/styles.css
git commit -m "style: add dark-mode tokens, fluid type scale, reveal animation

- .dark token block (warm dark family, terracotta lifted for AA)
- clamp()-based --text-post/list/archive-title variables
- .reveal entrance driven by IntersectionObserver + .is-visible
- reduced-motion guards for reveal + theme transition
- prose-reader dark refinements for code/pre

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 2: Move Google Fonts to async `<link>` loading in `__root.tsx`

**Files:**
- Modify: `src/styles.css` (remove the blocking `@import`)
- Modify: `src/routes/__root.tsx` (add preconnect + async stylesheet in `head`)

Currently `styles.css` line 5 has `@import url('https://fonts.googleapis.com/css2?...')` which blocks rendering. Move it to async `<link>` tags. This improves LCP and unblocks the rest of the CSS.

- [ ] **Step 1: Remove the `@import url(...)` line** from the top of `src/styles.css` (the line `@import url('https://fonts.googleapis.com/css2?family=Libre+Bodoni:...&family=Public+Sans:...');`). Keep the `@import "tailwindcss";` and `@plugin "@tailwindcss/typography";` lines. Keep the comment above it but update it to note fonts are now loaded via `<link>` in the document head.

- [ ] **Step 2: In `src/routes/__root.tsx`, add font preconnect + async stylesheet to the `head` of `RootDocument`.** Edit the `head` block inside `RootDocument` (currently just `<HeadContent />`). Replace:

```tsx
      <head>
        <HeadContent />
      </head>
```

with:

```tsx
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
```

- [ ] **Step 3: Verify dev server renders fonts.**

Run: `pnpm dev`
Open `http://localhost:3080`. Expected: page renders with Libre Bodoni headings + Public Sans body (check via DevTools Network that the stylesheet request is `fonts.googleapis.com` and not blocking; headings still show serif).

- [ ] **Step 4: Commit.**

```bash
git add src/styles.css src/routes/__root.tsx
git commit -m "perf: load Google Fonts async via link tags

Removes the render-blocking @import from styles.css; adds preconnect +
async stylesheet in the document head. Improves LCP.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 3: Wire up `next-themes` ThemeProvider with anti-FOUC script

**Files:**
- Create: `src/components/theme-provider.tsx`
- Modify: `src/routes/__root.tsx`

`next-themes` is already a dependency. The `sonner.tsx` component already calls `useTheme()`, but there is no provider mounted, so it returns defaults. Mount the provider at the root with an anti-FOUC inline script so dark mode doesn't flash white on first paint.

- [ ] **Step 1: Create `src/components/theme-provider.tsx`.**

```tsx
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ReactNode } from 'react'

/**
 * Wraps the app so next-themes can read/set the theme.
 * attribute="class" -> toggles .dark on <html>.
 * defaultTheme="system" -> first visit follows OS preference.
 * enableSystem -> allows system resolution.
 * disableTransitionOnChange -> avoids the slow color-transition on the
 *   very first paint (we re-enable transitions for manual toggles elsewhere).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
```

- [ ] **Step 2: Wrap the app in `<ThemeProvider>` inside `RootDocument`.** In `src/routes/__root.tsx`, import it and wrap the inner content. Edit the `<body>` return. Replace:

```tsx
      <body className="antialiased min-h-screen flex flex-col bg-background text-foreground">
        <div className="flex-1 flex flex-col">
          {children}
        </div>
        <Toaster richColors position="top-center" />
```

with:

```tsx
      <body className="antialiased min-h-screen flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <div className="flex-1 flex flex-col">
            {children}
          </div>
          <Toaster richColors position="top-center" />
        </ThemeProvider>
```

Add the import at the top of the file (next to the other `@/` imports):

```tsx
import { ThemeProvider } from '@/components/theme-provider'
```

- [ ] **Step 3: Add the anti-FOUC inline script.** `next-themes` writes the `class` to `<html>` before paint when its script runs, but to be safe against any flash, add a tiny blocking script in `<head>` that sets the class from `localStorage` / system preference synchronously. Actually — `next-themes` handles this internally when `attribute="class"`. To use its built-in no-flash behavior, no extra script is needed; `disableTransitionOnChange` + the library's own injection covers it. **Skip a custom script unless a flash is observed.** (Rationale recorded to avoid cargo-culting a script that duplicates next-themes' built-in behavior.)

- [ ] **Step 4: Verify no flash on reload.**

Run: `pnpm dev`
Set OS to dark mode (or toggle via DevTools → Rendering → Emulate CSS `prefers-color-scheme: dark`). Reload `http://localhost:3080`. Expected: page loads directly in dark theme, no white flash. The `<html>` element has class `dark` (check via DevTools Elements).

- [ ] **Step 5: Verify build.**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 6: Commit.**

```bash
git add src/components/theme-provider.tsx src/routes/__root.tsx
git commit -m "feat: mount next-themes ThemeProvider at the root

attribute=class toggles .dark on <html>; defaultTheme=system follows OS.
next-themes handles no-flash internally via disableTransitionOnChange.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 4: Build the `ThemeToggle` client island

**Files:**
- Create: `src/components/site/theme-toggle.tsx`

A small `'use client'` button with Sun/Moon icons that toggles light/dark and applies the `.theme-transition` class to `<html>` so the smooth color transition (from Task 1) fires on user-initiated switches only.

- [ ] **Step 1: Create `src/components/site/theme-toggle.tsx`.**

```tsx
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'

/**
 * Light/dark toggle. Two-state (light | dark); defaultTheme=system is set
 * at the provider, so first-time visitors follow OS, and the first toggle
 * persists the explicit choice to localStorage (handled by next-themes).
 *
 * Toggles a .theme-transition class on <html> for the duration of the
 * switch so the smooth background/color transition (styles.css) fires only
 * on user action, not on first paint.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch: render a stable placeholder until mounted.
  useEffect(() => setMounted(true), [])

  const isDark = resolvedTheme === 'dark'

  const handleToggle = () => {
    const root = document.documentElement
    root.classList.add('theme-transition')
    setTheme(isDark ? 'light' : 'dark')
    // Remove the class after the transition completes so it doesn't linger.
    window.setTimeout(() => root.classList.remove('theme-transition'), 350)
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isDark ? '切换到亮色模式' : '切换到暗色模式'}
      title={isDark ? '切换到亮色模式' : '切换到暗色模式'}
      className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors active:translate-y-[1px]"
    >
      {/* Placeholder keeps layout stable pre-mount; swap to icon after mount */}
      {!mounted ? (
        <span className="size-5" aria-hidden="true" />
      ) : isDark ? (
        <Sun className="size-5 transition-transform duration-300" />
      ) : (
        <Moon className="size-5 transition-transform duration-300" />
      )}
    </button>
  )
}
```

- [ ] **Step 2: Verify it builds.**

Run: `pnpm build`
Expected: succeeds. (It is not yet rendered anywhere; Task 5 wires it into the header.)

- [ ] **Step 3: Commit.**

```bash
git add src/components/site/theme-toggle.tsx
git commit -m "feat: add ThemeToggle client island (Sun/Moon, two-state)

Min-44px touch target, active press feedback, .theme-transition class
toggle for smooth color switch. Stable placeholder pre-mount avoids
hydration mismatch.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 5: Build the `MobileNav` client island

**Files:**
- Create: `src/components/site/mobile-nav.tsx`

A hamburger button + dropdown drawer shown only `<md`. Contains the category/tag nav + social links (which are in the desktop header on `md+`). Closes on ESC, outside click, and after a link is followed. Keyboard reachable.

- [ ] **Step 1: Create `src/components/site/mobile-nav.tsx`.**

```tsx
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
          className="absolute right-0 top-[calc(100%+0.5rem)] w-72 max-w-[calc(100vw-2.5rem)] rounded-lg border border-border bg-popover shadow-lg p-2 animate-rise"
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
```

Note: `animate-rise` was renamed to `.reveal` in Task 1. The drawer uses a simple appearance; to give it a subtle slide, replace `animate-rise` with inline transition is overkill. **Use the `.reveal is-visible`-style by toggling is not needed here** — simplest correct approach: keep the drawer as-is (it appears instantly, which is fine for a menu). If a slide-in is desired, the engineer can wrap with a CSS class. Leave as instant appear for simplicity. (Decisions recorded inline.)

**Correction to the above:** Remove `animate-rise` from the drawer className (it no longer exists post-Task 1). The drawer className should be:

```tsx
          className="absolute right-0 top-[calc(100%+0.5rem)] w-72 max-w-[calc(100vw-2.5rem)] rounded-lg border border-border bg-popover shadow-lg p-2"
```

- [ ] **Step 2: Verify it builds.**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 3: Commit.**

```bash
git add src/components/site/mobile-nav.tsx
git commit -m "feat: add MobileNav client island (hamburger + dropdown drawer)

md:hidden only. Closes on ESC, outside click, and link navigation.
aria-expanded/controls, keyboard reachable, min-44px touch target.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 6: Build the `SiteHeader` client island

**Files:**
- Create: `src/components/site/site-header.tsx`

Composes the title link, desktop nav (categories + a few tags), social links, `<ThemeToggle />`, and `<MobileNav />`. Server-renderable shell + client islands for interactivity.

- [ ] **Step 1: Create `src/components/site/site-header.tsx`.**

```tsx
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
 * collapses into MobileNav below md. Client component because it hosts the
 * ThemeToggle and MobileNav islands.
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
```

- [ ] **Step 2: Verify it builds.**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 3: Commit.**

```bash
git add src/components/site/site-header.tsx
git commit -m "feat: add SiteHeader client island (sticky, responsive)

Composes title link, desktop nav (categories+tags), social links,
ThemeToggle, and MobileNav. Single-line at md+, collapses below md.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 7: Build the `SiteLayout` server component + shared footer

**Files:**
- Create: `src/components/site/site-layout.tsx`

The single shared chrome for all public routes. Takes `settings`, `navItems`, `social` (to feed the header), a `width` prop, and `children`. Server component (no `'use client'`) — it only composes server-renderable markup + the header island.

- [ ] **Step 1: Create `src/components/site/site-layout.tsx`.**

```tsx
import type { ReactNode } from 'react'
import { SiteHeader } from './site-header'

type NavItem = { name: string; slug: string; kind: 'category' | 'tag' }
type SocialLink = { label: string; href: string }

interface SiteLayoutProps {
  children: ReactNode
  settings: Record<string, string>
  navItems?: NavItem[]
  width?: 'reading' | 'wide'  // reading = max-w-3xl, wide = max-w-4xl
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
```

- [ ] **Step 2: Verify it builds.**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 3: Commit.**

```bash
git add src/components/site/site-layout.tsx
git commit -m "feat: add SiteLayout shared chrome (header + main + footer)

width prop (reading=max-w-3xl, wide=max-w-4xl). Server component hosting
the SiteHeader client island. Replaces per-route header/footer duplication.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 8: Create the `useInView` hook for reveal-on-scroll

**Files:**
- Create: `src/lib/use-in-view.ts`

One shared IntersectionObserver hook. Reduced-motion aware (reports visible immediately so items show without animation). Cleans up on unmount.

- [ ] **Step 1: Create `src/lib/use-in-view.ts`.**

```ts
import { useEffect, useRef, useState } from 'react'

/**
 * Reveal-on-scroll. Returns [ref, inView]. Adds .is-visible (via the
 * consumer toggling a class, or the consumer reading `inView`) when the
 * element enters the viewport.
 *
 * Respects prefers-reduced-motion: reports `inView = true` immediately so
 * items are visible without animation.
 *
 * `once` (default true): stop observing after first intersection.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(
  options: { once?: boolean; threshold?: number } = {},
): [React.RefObject<T>, boolean] {
  const { once = true, threshold = 0.15 } = options
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    // Reduced motion: show immediately, no observer.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInView(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          if (once) observer.disconnect()
        } else if (!once) {
          setInView(false)
        }
      },
      { threshold },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [once, threshold])

  return [ref, inView]
}
```

- [ ] **Step 2: Verify it builds.**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 3: Commit.**

```bash
git add src/lib/use-in-view.ts
git commit -m "feat: add useInView IntersectionObserver hook

Reveal-on-scroll, reduced-motion aware (immediate visible), once-by-default,
cleans up on unmount. Replaces any need for scroll listeners.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 9: Migrate the home route (`index.tsx`) to `SiteLayout` + reveal + fluid type

**Files:**
- Modify: `src/routes/index.tsx`

Replace the self-declared header/tag-nav/footer with `<SiteLayout>`, build `navItems` from the already-loaded categories+tags, apply fluid list-title type, raise description copy to 16px, add reveal-on-scroll to list items, and bump pagination touch targets.

- [ ] **Step 1: Add imports** at the top of `src/routes/index.tsx`. Add after the existing imports:

```tsx
import { SiteLayout } from '@/components/site/site-layout'
import { useInView } from '@/lib/use-in-view'
```

- [ ] **Step 2: Build `navItems` from loaded data and replace the component body.** The `Home` component currently returns the entire `<div>` with header/nav/main/footer. Replace the whole `function Home() { ... }` body's return with a version wrapped in `<SiteLayout>`. Replace from `return (` through the closing `)` of the function with:

```tsx
function Home() {
  const { posts, categories, tags, settings, pagination } = Route.useLoaderData() as {
    posts: any[]; categories: any[]; tags: any[]; settings: Record<string, string>; pagination: any
  }

  // Header nav: categories first, then tags.
  const navItems = [
    ...categories.map((c: any) => ({ name: c.name, slug: c.slug, kind: 'category' as const })),
    ...tags.map((t: any) => ({ name: t.name, slug: t.slug, kind: 'tag' as const })),
  ]

  return (
    <SiteLayout settings={settings} navItems={navItems} width="reading">
      {posts.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-border rounded-xl bg-card/40">
          <FileText size={28} className="text-muted-foreground/50 mx-auto" strokeWidth={1.5} />
          <p className="text-muted-foreground text-sm mt-3">暂无发布文章</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col divide-y divide-border">
            {posts.map((post, index) => (
              <HomeArticle key={post.id} post={post} index={index} />
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <Link
                disabled={pagination.page <= 1}
                to="/"
                search={{ page: pagination.page - 1 }}
                className={`inline-flex items-center min-h-[44px] px-3 text-sm transition-colors ${pagination.page <= 1 ? 'opacity-40 cursor-not-allowed' : 'text-primary hover:underline'}`}
              >
                ← 上一页
              </Link>
              <span className="text-sm text-muted-foreground tabular-nums">
                {pagination.page} / {pagination.totalPages}
              </span>
              <Link
                disabled={pagination.page >= pagination.totalPages}
                to="/"
                search={{ page: pagination.page + 1 }}
                className={`inline-flex items-center min-h-[44px] px-3 text-sm transition-colors ${pagination.page >= pagination.totalPages ? 'opacity-40 cursor-not-allowed' : 'text-primary hover:underline'}`}
              >
                下一页 →
              </Link>
            </div>
          )}
        </>
      )}
    </SiteLayout>
  )
}
```

- [ ] **Step 3: Add the `HomeArticle` sub-component** (below `Home`, same file) that owns the reveal-on-scroll + fluid title:

```tsx
function HomeArticle({ post, index }: { post: any; index: number }) {
  const [ref, inView] = useInView<HTMLDivElement>()

  return (
    <article
      ref={ref}
      className={`reveal ${inView ? 'is-visible' : ''} group py-8 first:pt-0`}
      style={{ ['--reveal-index' as string]: Math.min(index, 5) }}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-3">
        {post.categoryName && (
          <Link
            to="/category/$slug"
            params={{ slug: post.categorySlug || '' }}
            className="text-primary hover:underline font-medium"
          >
            {post.categoryName}
          </Link>
        )}
        {post.categoryName && <span className="text-border">·</span>}
        <time className="tabular-nums">
          {new Date(post.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
        </time>
      </div>

      <h2
        className="font-bold leading-tight tracking-tight mb-3"
        style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-list-title)' }}
      >
        <Link to="/posts/$slug" params={{ slug: post.slug }} className="hover:text-primary transition-colors">
          {post.title}
        </Link>
      </h2>

      {post.coverImage && (
        <Link to="/posts/$slug" params={{ slug: post.slug }} className="block rounded-lg overflow-hidden border border-border mb-4 bg-secondary">
          <img
            src={post.coverImage}
            alt={post.title}
            className="w-full aspect-[16/9] object-cover group-hover:scale-[1.01] transition-transform duration-500"
          />
        </Link>
      )}

      {post.description && (
        <p className="text-base text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
          {post.description}
        </p>
      )}

      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {post.tags.map((tag: any) => (
            <Link
              key={tag.slug}
              to="/tag/$slug"
              params={{ slug: tag.slug }}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              #{tag.name}
            </Link>
          ))}
        </div>
      )}
    </article>
  )
}
```

- [ ] **Step 4: Verify in dev.**

Run: `pnpm dev`
Open `http://localhost:3080`. Expected:
- Header is shared (title + nav + social + theme toggle on desktop; title + theme + hamburger on mobile via DevTools mobile viewport).
- Articles use fluid title size (resize window: title scales smoothly).
- Scrolling reveals list items with a subtle rise + stagger (first ~5 items).
- `prefers-reduced-motion: reduce` (DevTools → Rendering) → items appear instantly.
- Description text is 16px.
- No em-dashes anywhere visible.

- [ ] **Step 5: Verify build.**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 6: Commit.**

```bash
git add src/routes/index.tsx
git commit -m "feat: migrate home route to SiteLayout, fluid type, reveal-on-scroll

- Shared header/footer via SiteLayout; navItems from categories+tags
- Fluid list-title via clamp var; description copy raised to 16px
- Reveal-on-scroll via useInView on HomeArticle (staggered, reduced-motion aware)
- Pagination touch targets min-44px

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 10: Migrate the post-detail route (`posts.$slug.tsx`) to `SiteLayout`

**Files:**
- Modify: `src/routes/posts.$slug.tsx`

Replace the mini header + footer with `<SiteLayout width="reading">`. Apply fluid title, responsive cover aspect ratio (`16/9` mobile → `21/9` desktop).

- [ ] **Step 1: Add imports** at top of `src/routes/posts.$slug.tsx`:

```tsx
import { SiteLayout } from '@/components/site/site-layout'
```

(Remove the now-unused `ArrowLeft` import from `lucide-react` if nothing else uses it — it is only used by the mini header being removed.)

- [ ] **Step 2: Replace the `PostDetail` component body.** Replace from `function PostDetail() {` through its closing `}` with:

```tsx
function PostDetail() {
  const { post, tags, settings } = Route.useLoaderData() as { post: any; tags: any[]; settings: Record<string, string> }

  return (
    <SiteLayout settings={settings} width="reading">
      <article>
        <header className="mb-10">
          {post.categoryName && (
            <Link
              to="/category/$slug"
              params={{ slug: post.categorySlug || '' }}
              className="text-xs uppercase tracking-widest text-primary hover:underline font-semibold"
            >
              {post.categoryName}
            </Link>
          )}

          <h1
            className="font-bold mt-4 mb-4 tracking-tight leading-tight"
            style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-post-title)' }}
          >
            {post.title}
          </h1>

          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <span>发布于</span>
            <time className="tabular-nums">
              {new Date(post.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
            </time>
          </div>
        </header>

        {post.coverImage && (
          <div className="rounded-lg overflow-hidden border border-border aspect-[16/9] md:aspect-[21/9] mb-12 bg-secondary">
            <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="prose prose-lg prose-neutral max-w-none leading-relaxed prose-reader
                        prose-headings:[font-family:var(--font-serif)] prose-headings:tracking-tight
                        prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                        prose-img:rounded-lg prose-img:border prose-img:border-border
                        prose-blockquote:border-primary prose-blockquote:not-italic">
          <div dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
        </div>

        {tags.length > 0 && (
          <footer className="border-t border-border pt-8 mt-14 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mr-2">文章标签</span>
            {tags.map(tag => (
              <Link
                key={tag.slug}
                to="/tag/$slug"
                params={{ slug: tag.slug }}
                className="text-xs px-3 py-1 bg-secondary hover:bg-primary hover:text-primary-foreground text-muted-foreground rounded-full border border-border hover:border-primary transition-colors"
              >
                #{tag.name}
              </Link>
            ))}
          </footer>
        )}
      </article>
    </SiteLayout>
  )
}
```

Note: this route's loader returns `settings` but not categories/tags, so `<SiteLayout>` gets no `navItems` (defaults to `[]` → header shows title + social + theme + hamburger with just social in the drawer). That is acceptable for the reading surface. If category/tag nav is desired here too, the loader would need to fetch them; **out of scope** for this refinement per spec (don't expand loaders unnecessarily).

- [ ] **Step 3: Verify in dev.**

Run: `pnpm dev`
Open a post. Expected:
- Shared header/footer (back-arrow mini header is gone; user navigates back via the title link or browser back).
- Title scales fluidly.
- Cover image is `16/9` on mobile, `21/9` on desktop.
- Article body reads well in both light and dark (toggle theme).
- No em-dashes.

- [ ] **Step 4: Verify build.**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 5: Commit.**

```bash
git add src/routes/posts.$slug.tsx
git commit -m "feat: migrate post-detail route to SiteLayout, fluid title, responsive cover

Shared header/footer via SiteLayout. Fluid post-title via clamp var.
Cover aspect 16/9 mobile -> 21/9 desktop. Removes the duplicated mini header.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 11: Migrate the tag archive route (`tag.$slug.tsx`) to `SiteLayout`

**Files:**
- Modify: `src/routes/tag.$slug.tsx`

Replace header/footer with `<SiteLayout width="wide">`, pass navItems, apply fluid archive title, add reveal-on-scroll to cards.

- [ ] **Step 1: Add imports** at top of `src/routes/tag.$slug.tsx`:

```tsx
import { SiteLayout } from '@/components/site/site-layout'
import { useInView } from '@/lib/use-in-view'
```

(Remove the now-unused `ArrowLeft` import from `lucide-react`.)

- [ ] **Step 2: Replace the `TagPage` component body.** Replace `function TagPage() {` through its closing `}` with:

```tsx
function TagPage() {
  const { tag, posts, settings, pagination } = Route.useLoaderData() as {
    tag: any; posts: any[]; settings: Record<string, string>; pagination: any
  }

  return (
    <SiteLayout settings={settings} width="wide">
      <div className="border-b border-border pb-6 mb-10">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">标签归档</span>
        <h1
          className="font-bold mt-2"
          style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-archive-title)' }}
        >
          #{tag.name}
        </h1>
        <p className="text-xs text-muted-foreground mt-2">共 {pagination.totalPosts} 篇文章</p>
      </div>

      <section className="flex flex-col gap-6">
        {posts.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-xl bg-card/50">
            <p className="text-muted-foreground text-sm">暂无带有此标签的文章</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-6">
              {posts.map((post, index) => (
                <ArchiveCard key={post.id} post={post} activeTagSlug={tag.slug} index={index} />
              ))}
            </div>

            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border pt-6 mt-4">
                <Link
                  disabled={pagination.page <= 1}
                  to="/tag/$slug"
                  params={{ slug: tag.slug }}
                  search={{ page: pagination.page - 1 }}
                  className={`inline-flex items-center min-h-[44px] px-4 border border-border rounded-md text-sm transition-colors ${pagination.page <= 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-secondary'}`}
                >
                  上一页
                </Link>
                <span className="text-sm text-muted-foreground tabular-nums">第 {pagination.page} / {pagination.totalPages} 页</span>
                <Link
                  disabled={pagination.page >= pagination.totalPages}
                  to="/tag/$slug"
                  params={{ slug: tag.slug }}
                  search={{ page: pagination.page + 1 }}
                  className={`inline-flex items-center min-h-[44px] px-4 border border-border rounded-md text-sm transition-colors ${pagination.page >= pagination.totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-secondary'}`}
                >
                  下一页
                </Link>
              </div>
            )}
          </>
        )}
      </section>
    </SiteLayout>
  )
}
```

- [ ] **Step 3: Add the `ArchiveCard` sub-component** (below `TagPage`, same file):

```tsx
function ArchiveCard({ post, activeTagSlug, index }: { post: any; activeTagSlug: string; index: number }) {
  const [ref, inView] = useInView<HTMLDivElement>()

  return (
    <article
      ref={ref}
      className={`reveal ${inView ? 'is-visible' : ''} group bg-card border border-border rounded-lg overflow-hidden hover:border-foreground/20 transition-colors duration-300 flex flex-col md:flex-row`}
      style={{ ['--reveal-index' as string]: Math.min(index, 5) }}
    >
      {post.coverImage && (
        <div className="md:w-1/3 aspect-[16/10] md:aspect-auto overflow-hidden relative border-b md:border-b-0 md:border-r border-border bg-secondary">
          <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" />
        </div>
      )}
      <div className="p-6 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-3">
            {post.categoryName && (
              <span className="text-foreground font-medium bg-secondary px-2 py-0.5 rounded">{post.categoryName}</span>
            )}
            <span className="text-border">·</span>
            <time className="tabular-nums">{new Date(post.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}</time>
          </div>
          <h2 className="text-xl font-bold group-hover:text-primary transition-colors mb-2 leading-snug">
            <Link to="/posts/$slug" params={{ slug: post.slug }}>{post.title}</Link>
          </h2>
          {post.description && (
            <p className="text-sm text-muted-foreground line-clamp-3 mb-4 leading-relaxed">{post.description}</p>
          )}
        </div>
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {post.tags.map((t: any) => (
              <Link
                key={t.slug}
                to="/tag/$slug"
                params={{ slug: t.slug }}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  t.slug === activeTagSlug
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'text-muted-foreground hover:text-primary border-border'
                }`}
              >
                #{t.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}
```

- [ ] **Step 4: Verify in dev.**

Run: `pnpm dev`
Open a tag page (e.g. `/tag/<slug>`). Expected:
- Shared header/footer (`width="wide"`).
- Cards reveal on scroll (staggered).
- Fluid archive title.
- Mobile: cards stack vertically (image on top); desktop: image left, content right.
- No em-dashes.

- [ ] **Step 5: Verify build.**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 6: Commit.**

```bash
git add src/routes/tag.$slug.tsx
git commit -m "feat: migrate tag archive route to SiteLayout, reveal cards, fluid title

Shared header/footer via SiteLayout (wide). Reveal-on-scroll on ArchiveCard.
Fluid archive-title. Pagination touch targets min-44px.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 12: Migrate the category archive route (`category.$slug.tsx`) to `SiteLayout`

**Files:**
- Modify: `src/routes/category.$slug.tsx`

The category route is structurally identical to the tag route. Apply the same transformation. Read it first to confirm exact structure, then mirror Task 11's changes (the heading text differs: "分类归档" instead of "标签归档", and the active-tag highlighting may differ).

- [ ] **Step 1: Read `src/routes/category.$slug.tsx`** to confirm its current structure matches the tag route's pre-edit shape (header → archive header → card grid → pagination → footer). Note any differences in heading labels or the absence of the active-tag highlight (category cards don't have an "active category" pill the way tag pages do).

- [ ] **Step 2: Add imports** at the top:

```tsx
import { SiteLayout } from '@/components/site/site-layout'
import { useInView } from '@/lib/use-in-view'
```

(Remove the now-unused `ArrowLeft` import if present.)

- [ ] **Step 3: Replace the page component body** to wrap in `<SiteLayout settings={settings} width="wide">`, drop the self-declared header/footer, use `var(--text-archive-title)` on the H1, change the eyebrow to `分类归档`, and replace the inline card markup with an `ArchiveCard` sub-component (same shape as Task 11's, but without the `activeTagSlug` prop / active-pill logic — render all category/tag pills in the default style). Build `navItems` if the loader returns categories/tags (check the loader; if it doesn't, pass no `navItems` and rely on default `[]`).

- [ ] **Step 4: Add the `ArchiveCard` sub-component** (same as Task 11's `ArchiveCard` minus the `activeTagSlug` parameter):

```tsx
function ArchiveCard({ post, index }: { post: any; index: number }) {
  const [ref, inView] = useInView<HTMLDivElement>()

  return (
    <article
      ref={ref}
      className={`reveal ${inView ? 'is-visible' : ''} group bg-card border border-border rounded-lg overflow-hidden hover:border-foreground/20 transition-colors duration-300 flex flex-col md:flex-row`}
      style={{ ['--reveal-index' as string]: Math.min(index, 5) }}
    >
      {post.coverImage && (
        <div className="md:w-1/3 aspect-[16/10] md:aspect-auto overflow-hidden relative border-b md:border-b-0 md:border-r border-border bg-secondary">
          <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" />
        </div>
      )}
      <div className="p-6 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-3">
            {post.categoryName && (
              <span className="text-foreground font-medium bg-secondary px-2 py-0.5 rounded">{post.categoryName}</span>
            )}
            <span className="text-border">·</span>
            <time className="tabular-nums">{new Date(post.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}</time>
          </div>
          <h2 className="text-xl font-bold group-hover:text-primary transition-colors mb-2 leading-snug">
            <Link to="/posts/$slug" params={{ slug: post.slug }}>{post.title}</Link>
          </h2>
          {post.description && (
            <p className="text-sm text-muted-foreground line-clamp-3 mb-4 leading-relaxed">{post.description}</p>
          )}
        </div>
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {post.tags.map((t: any) => (
              <Link
                key={t.slug}
                to="/tag/$slug"
                params={{ slug: t.slug }}
                className="text-xs px-2 py-0.5 rounded-full border text-muted-foreground hover:text-primary border-border transition-colors"
              >
                #{t.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}
```

- [ ] **Step 5: Verify in dev.**

Run: `pnpm dev`
Open a category page. Expected: same behavior as the tag page (shared chrome, reveal cards, fluid title, responsive stack/row, "分类归档" eyebrow). No em-dashes.

- [ ] **Step 6: Verify build.**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 7: Commit.**

```bash
git add src/routes/category.$slug.tsx
git commit -m "feat: migrate category archive route to SiteLayout, reveal cards, fluid title

Shared header/footer via SiteLayout (wide). Reveal-on-scroll on ArchiveCard.
Fluid archive-title. Pagination touch targets min-44px.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 13: Final cross-cutting verification + Pre-Flight check

**Files:** none modified (verification only).

- [ ] **Step 1: Full build.**

Run: `pnpm build`
Expected: succeeds with no TypeScript errors (note: `tsconfig.json` has `noUnusedLocals` + `noUnusedParameters` — remove any imports that become unused after migration, e.g. `ArrowLeft`).

- [ ] **Step 2: Manual smoke test in dev.**

Run: `pnpm dev`, open `http://localhost:3080`. Walk through:
1. Home: shared header, fluid titles, reveal on scroll, pagination works, theme toggle works (light↔dark, persists on reload).
2. A post: shared header, fluid title, responsive cover, body reads well in dark, tags footer.
3. A tag page: shared header (wide), reveal cards, fluid title, responsive card layout, pagination.
4. A category page: same as tag.
5. Mobile viewport (DevTools 375px width): header collapses to title + theme + hamburger; hamburger opens drawer with nav + social; drawer closes on ESC / outside click / link nav; touch targets ≥ 44px.
6. `prefers-reduced-motion: reduce` (DevTools → Rendering): no reveal animation, items visible; no theme color transition.
7. Dark mode via OS (or DevTools emulate): no white flash on reload.

- [ ] **Step 3: Em-dash audit.**

Search all modified files for `—` and `–` characters (the em-dash and en-dash). Any hit in visible copy is a failure. Run a grep across `src/routes` and `src/components/site`:

Run: `grep -rn $'\xe2\x80\x94\|\xe2\x80\x93' src/routes src/components/site` (or equivalent)
Expected: no matches in visible strings. (The `·` middle-dot in metadata strips is intentional and allowed, rationed per the design rules.)

- [ ] **Step 4: Confirm admin console untouched.**

Open `/admin` in dev. Expected: admin layout/sidebar unchanged (this plan did not touch `admin.*` routes).

- [ ] **Step 5: Final commit** (only if Step 1-4 surfaced any fixups; otherwise skip).

```bash
git add -A
git commit -m "chore: frontend refinement fixups from final verification

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Report completion** with the list of what was done, the manual-check results, and any caveats (e.g. the post-detail header no longer has a back arrow — navigation via title link / browser back).

---

## Notes for the implementer

- **`noUnusedLocals`/`noUnusedParameters` are on.** After removing the mini headers, the `ArrowLeft` import in `posts.$slug.tsx`, `tag.$slug.tsx`, `category.$slug.tsx` becomes unused → either remove the import or the build fails.
- **`verbatimModuleSyntax` is on.** Type-only imports must use `import type { ... }`. The `use-in-view.ts` return type `React.RefObject<T>` references the global `React` namespace; if TS complains, add `import type { RefObject } from 'react'` and use `RefObject<T>`.
- **Hydration:** `ThemeToggle` renders a stable placeholder until mounted to avoid a light/dark icon mismatch between SSR (no theme known) and client. Don't remove the `mounted` guard.
- **The `·` middle-dot** in metadata strips (`category · date`) is intentional and allowed; do not "fix" it.
- **No test harness exists.** Do not invent one. Verification is build + manual + grep audits, as specified per task.
