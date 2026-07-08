import { Link } from '@tanstack/react-router'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EditorTopBarProps {
  headerText: string
  draftButtonLabel: string
  publishButtonLabel: string
  saving: boolean
  onSaveDraft: () => void
  onPublish: () => void
}

export function EditorTopBar({
  headerText,
  draftButtonLabel,
  publishButtonLabel,
  saving,
  onSaveDraft,
  onPublish,
}: EditorTopBarProps) {
  return (
    <div className="shrink-0 border-b border-border/80 px-6 py-4 bg-background/80 backdrop-blur-md flex items-center justify-between z-20 shadow-sm">
      <div className="min-w-0 flex items-center gap-3">
        <Button asChild variant="ghost" size="icon-sm" className="text-muted-foreground shrink-0" title="返回列表">
          <Link to="/admin/posts"><ArrowLeft size={16} /></Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-sm font-bold tracking-tight text-foreground/90 truncate">{headerText}</h1>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <Button type="button" variant="outline" size="sm" disabled={saving} onClick={onSaveDraft} className="text-xs h-8">
          {draftButtonLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={saving}
          onClick={onPublish}
          className="text-xs h-8 bg-gradient-to-r from-primary to-orange-500 hover:from-primary/90 hover:to-orange-500/90 text-white border-0 shadow-sm transition-all hover:shadow-md"
        >
          {saving ? <><Loader2 size={13} className="animate-spin" /> 保存中…</> : publishButtonLabel}
        </Button>
      </div>
    </div>
  )
}
