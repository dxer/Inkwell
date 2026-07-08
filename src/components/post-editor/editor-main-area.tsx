import React, { Suspense } from 'react'
import { Check } from 'lucide-react'

// Lazy-load the Markdown editor (it touches document at module load)
const Editor = React.lazy(() => import('../editor'))

interface EditorMainAreaProps {
  title: string
  onTitleChange: (v: string) => void
  initialMarkdown: string
  onEditorChange: (data: { markdown: string; html: string }) => void
  aiTitles: string[]
  onPickTitle: (t: string) => void
}

export function EditorMainArea({
  title,
  onTitleChange,
  initialMarkdown,
  onEditorChange,
  aiTitles,
  onPickTitle,
}: EditorMainAreaProps) {
  return (
    <div className="flex-1 p-6 md:p-8 overflow-y-auto flex flex-col gap-6 bg-background">
      <div className="flex flex-col gap-4">
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="w-full bg-transparent py-3 text-2xl md:text-3xl font-extrabold focus:outline-none placeholder:text-muted-foreground/50 transition-all"
          placeholder="Enter your blog post title..."
        />

        {/* Title candidates (when AI suggested some) */}
        {aiTitles.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-1">
            <span className="text-[9px] text-muted-foreground">✨ AI 推荐标题，点击采纳：</span>
            {aiTitles.map((t, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onPickTitle(t)}
                className="w-full text-left p-2 hover:bg-secondary/80 dark:hover:bg-background border border-border rounded text-[11px] leading-relaxed transition-colors cursor-pointer flex items-start gap-2"
              >
                <Check size={11} className="text-primary mt-0.5 shrink-0" />
                <span>{t}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Dynamic Rich Text Editor */}
      <div className="flex flex-col gap-2 flex-1 min-h-0">
        <div className="rounded-lg border border-border bg-card overflow-hidden flex-1 flex flex-col">
          <Suspense fallback={<div className="h-64 flex items-center justify-center text-sm text-muted-foreground">正在加载编辑器…</div>}>
            <Editor initialContent={initialMarkdown} onChange={onEditorChange} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
