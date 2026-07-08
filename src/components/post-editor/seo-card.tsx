import { Check, Wand2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { CollapsibleCard } from './collapsible-card'
import { cn } from '@/lib/utils'
import type { AiFieldKey, AiFieldMap } from './types'

const DESC_MAX = 160

interface SeoCardProps {
  fields: AiFieldMap
  flashing: Set<AiFieldKey>

  // committed form values
  slug: string
  description: string
  keywords: string

  // change handlers (each marks the field dirty upstream)
  onTitleChange: (v: string) => void
  onSlugChange: (v: string) => void
  onDescriptionChange: (v: string) => void
  onKeywordsChange: (v: string) => void

  // apply
  onApplySelected: () => void
  applyDisabled: boolean
}

/** Small green pill shown when an AI suggestion is pending for a field. */
function ReadyBadge({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-600 dark:text-green-400 shrink-0">
      <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
      Ready for AI
    </span>
  )
}

/** The light-blue AI suggestion strip shown under an input when a value is pending. */
function AiStrip({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1.5 rounded-md bg-blue-500/10 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 text-[10px] leading-snug px-2 py-1 flex items-start gap-1">
      <span aria-hidden>✨</span>
      <span className="break-words">{children}</span>
    </div>
  )
}

function FieldRow({
  label,
  fieldKey,
  flashing,
  badge,
  input,
  strip,
}: {
  label: string
  fieldKey: AiFieldKey
  flashing: Set<AiFieldKey>
  badge?: React.ReactNode
  input?: React.ReactNode
  strip?: React.ReactNode
}) {
  const isFlashing = flashing.has(fieldKey)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold text-foreground/80">{label}</span>
        {badge && <div className="ml-auto">{badge}</div>}
      </div>
      {input !== undefined && (
        <div className={cn('rounded-md transition-colors duration-300', isFlashing && 'ring-2 ring-green-500/60 bg-green-500/5')}>
          {input}
        </div>
      )}
      {strip}
    </div>
  )
}

export function SeoCard({
  fields,
  flashing,
  slug,
  description,
  keywords,
  onTitleChange,
  onSlugChange,
  onDescriptionChange,
  onKeywordsChange,
  onApplySelected,
  applyDisabled,
}: SeoCardProps) {
  const descCount = description.length
  const descOver = descCount > DESC_MAX

  return (
    <CollapsibleCard title="URL & SEO" defaultOpen icon={Wand2}>
      <div className="flex flex-col gap-4">
        {/* Title — no input, the title lives in the core title input above. */}
        <FieldRow
          label="文章标题"
          fieldKey="title"
          flashing={flashing}
          badge={<ReadyBadge show={!!fields.title.pending} />}
          strip={
            fields.title.pending ? (
              <AiStrip>
                AI 推荐：{fields.title.pending}
                <button type="button" onClick={() => onTitleChange(fields.title.pending!)} className="underline ml-1 hover:opacity-80">应用</button>
              </AiStrip>
            ) : null
          }
        />

        {/* Slug */}
        <FieldRow
          label="Slug (URL)"
          fieldKey="slug"
          flashing={flashing}
          badge={<ReadyBadge show={!!fields.slug.pending} />}
          input={
            <Input
              value={slug}
              onChange={(e) => onSlugChange(e.target.value)}
              className="h-8 font-mono text-xs bg-background dark:bg-muted/30 border-border/80 focus-visible:ring-1 focus-visible:ring-primary/50"
              placeholder="留空则由 AI 自动生成"
            />
          }
          strip={
            fields.slug.pending ? (
              <AiStrip>
                AI suggests: <span className="font-mono">{fields.slug.pending}</span>
                <button type="button" onClick={() => onSlugChange(fields.slug.pending!)} className="underline ml-1 hover:opacity-80">应用</button>
              </AiStrip>
            ) : null
          }
        />

        {/* Description */}
        <FieldRow
          label="Description"
          fieldKey="description"
          flashing={flashing}
          badge={
            <span className={cn('text-[9px] font-medium tabular-nums', descOver ? 'text-red-500' : 'text-muted-foreground')}>
              {descCount} / {DESC_MAX}
            </span>
          }
          input={
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              className="resize-none text-xs bg-background dark:bg-muted/30 border-border/80 focus-visible:ring-1 focus-visible:ring-primary/50 min-h-[60px]"
              placeholder="文章描述（用于 SEO meta）"
            />
          }
          strip={
            fields.description.pending ? (
              <AiStrip>
                AI 摘要：{fields.description.pending.slice(0, 80)}{fields.description.pending.length > 80 ? '…' : ''}
              </AiStrip>
            ) : null
          }
        />

        {/* Keywords */}
        <FieldRow
          label="SEO Keywords"
          fieldKey="keywords"
          flashing={flashing}
          badge={<ReadyBadge show={!!fields.keywords.pending} />}
          input={
            <Input
              value={keywords}
              onChange={(e) => onKeywordsChange(e.target.value)}
              className="h-8 text-xs bg-background dark:bg-muted/30 border-border/80 focus-visible:ring-1 focus-visible:ring-primary/50"
              placeholder="多个关键词用英文逗号分隔"
            />
          }
          strip={
            fields.keywords.pending ? (
              <AiStrip>
                AI 检测到：{fields.keywords.pending}
                <button type="button" onClick={() => onKeywordsChange(fields.keywords.pending!)} className="underline ml-1 hover:opacity-80">应用</button>
              </AiStrip>
            ) : null
          }
        />

        {/* Apply Selected */}
        <Button
          type="button"
          size="sm"
          onClick={onApplySelected}
          disabled={applyDisabled}
          className="h-8 text-xs bg-primary/90 hover:bg-primary text-primary-foreground flex items-center justify-center gap-1.5"
        >
          <Check size={13} />
          应用 AI 建议
        </Button>
        <p className="text-[9px] text-muted-foreground leading-normal -mt-2">
          点击按钮应用所有 AI 生成的建议；单个字段可单独点击"应用"。
        </p>
      </div>
    </CollapsibleCard>
  )
}
