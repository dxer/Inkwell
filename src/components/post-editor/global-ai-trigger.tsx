import { Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface GlobalAiTriggerProps {
  generating: boolean
  /** Disabled when the editor body is empty. */
  disabled: boolean
  onClick: () => void
}

/**
 * The "One-Click AI Generate & Optimize" trigger at the top of the SEO &
 * Settings sidebar. A bare gradient button — no surrounding frame, no hint
 * text. The "body empty" warning surfaces as a toast on click instead.
 */
export function GlobalAiTrigger({ generating, disabled, onClick }: GlobalAiTriggerProps) {
  return (
    <Button
      type="button"
      size="sm"
      onClick={onClick}
      disabled={disabled || generating}
      className="w-full text-xs font-semibold h-9 bg-gradient-to-r from-violet-600 via-primary to-orange-500 hover:opacity-90 border-0 text-white shadow-sm flex items-center justify-center gap-1.5 active:translate-y-[1px] transition-transform"
    >
      {generating ? (
        <>
          <Loader2 size={14} className="animate-spin" />
          AI 深度生成中…
        </>
      ) : (
        <>
          <Sparkles size={14} />
          一键 AI 生成与优化
        </>
      )}
    </Button>
  )
}
