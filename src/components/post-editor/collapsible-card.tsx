import { useState } from 'react'
import { ChevronDown, type LucideIcon } from 'lucide-react'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface CollapsibleCardProps {
  title: string
  icon?: LucideIcon
  defaultOpen?: boolean
  className?: string
  /** Optional right-side badge/text shown in the header (next to the chevron). */
  headerExtra?: React.ReactNode
  children: React.ReactNode
}

/**
 * A lightweight collapsible wrapper built on the existing <Card>.
 *
 * Why not Radix Accordion: the sidebar wants two cards open simultaneously by
 * default (URL & SEO + Media), which fights Accordion's single-open mode and
 * would need type="multiple". A 15-line local toggle is simpler and composes
 * Card's CardAction slot for the chevron.
 */
export function CollapsibleCard({
  title,
  icon: Icon,
  defaultOpen = true,
  className,
  headerExtra,
  children,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Card className={cn('gap-0 py-0 bg-background/60 dark:bg-secondary/15 border-border/60', className)}>
      <CardHeader className="p-4 pb-0 grid grid-cols-[1fr_auto] items-center">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 text-left cursor-pointer min-w-0"
          aria-expanded={open}
        >
          {Icon && <Icon size={13} className="text-muted-foreground shrink-0" />}
          <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">
            {title}
          </CardTitle>
        </button>
        <CardAction className="flex items-center gap-2 row-span-1">
          {headerExtra}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer p-1"
            aria-label={open ? '收起' : '展开'}
          >
            <ChevronDown size={15} className={cn('transition-transform duration-200', open && 'rotate-180')} />
          </button>
        </CardAction>
      </CardHeader>
      {open && <CardContent className="p-4 pt-3">{children}</CardContent>}
    </Card>
  )
}
