import { FolderTree, Tags, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CollapsibleCard } from './collapsible-card'
import { cn } from '@/lib/utils'

const NONE = '__none__'

interface CategoriesTagsCardProps {
  categories: { id: string; name: string }[]
  tags: { id: string; name: string }[]
  categoryId: string | null
  selectedTagNames: string[]
  newTagName: string
  onCategoryChange: (v: string | null) => void
  onNewTagNameChange: (v: string) => void
  onAddTag: () => void
  onRemoveTag: (name: string) => void
  onToggleTag: (name: string) => void
}

export function CategoriesTagsCard({
  categories,
  tags,
  categoryId,
  selectedTagNames,
  newTagName,
  onCategoryChange,
  onNewTagNameChange,
  onAddTag,
  onRemoveTag,
  onToggleTag,
}: CategoriesTagsCardProps) {
  return (
    <CollapsibleCard title="Categories & Tags" defaultOpen={false} icon={FolderTree}>
      <div className="flex flex-col gap-4">
        {/* Category */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">分类目录</span>
          <Select value={categoryId ?? NONE} onValueChange={(v) => onCategoryChange(v === NONE ? null : v)}>
            <SelectTrigger className="w-full h-8 text-xs bg-background dark:bg-background/60 border-border/80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>(未分类)</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tags */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Tags size={11} /> 文章标签
          </span>
          <div className="flex gap-1.5">
            <Input
              value={newTagName}
              onChange={(e) => onNewTagNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  onAddTag()
                }
              }}
              placeholder="输入标签按回车…"
              className="h-8 text-xs bg-background dark:bg-muted/30 border-border/80 focus-visible:ring-1 focus-visible:ring-primary/50"
            />
            <Button type="button" size="sm" className="h-8 text-xs px-2.5 shrink-0" onClick={onAddTag}>
              添加
            </Button>
          </div>

          {selectedTagNames.length > 0 && (
            <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-border bg-secondary/10 dark:bg-background/50 max-h-32 overflow-y-auto">
              {selectedTagNames.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-primary text-primary-foreground font-medium"
                >
                  #{name}
                  <button
                    type="button"
                    onClick={() => onRemoveTag(name)}
                    className="hover:bg-primary-foreground/20 rounded-full p-0.5 transition-colors cursor-pointer"
                    aria-label={`移除 ${name}`}
                  >
                    <X size={10} strokeWidth={3} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {tags.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">推荐已有标签</span>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1.5 border border-border/40 rounded-lg bg-secondary/10 dark:bg-background/40">
                {tags.map((t) => {
                  const active = selectedTagNames.includes(t.name)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onToggleTag(t.name)}
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] border transition-colors cursor-pointer',
                        active
                          ? 'bg-primary text-primary-foreground border-primary font-medium'
                          : 'bg-background text-muted-foreground border-border hover:text-foreground hover:border-foreground/30',
                      )}
                    >
                      #{t.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </CollapsibleCard>
  )
}
