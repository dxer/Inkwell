import { useRef, useState } from 'react'
import { ImageIcon, Sparkles, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CollapsibleCard } from './collapsible-card'

interface MediaCoverCardProps {
  coverImage: string | null
  aiCoverPrompt: string
  generatingCover: boolean
  onCoverChange: (url: string | null) => void
  onPromptChange: (v: string) => void
  onGenerateCover: () => void
}

/** Upload a file via the existing multipart /api/upload route (reused by editor.tsx). */
async function uploadCoverFile(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: fd })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `上传失败 (HTTP ${res.status})`)
  }
  const data = (await res.json()) as { url: string }
  return data.url
}

export function MediaCoverCard({
  coverImage,
  aiCoverPrompt,
  generatingCover,
  onCoverChange,
  onPromptChange,
  onGenerateCover,
}: MediaCoverCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleUploadClick = () => fileInputRef.current?.click()

  const runUpload = async (file: File) => {
    setUploading(true)
    try {
      const url = await uploadCoverFile(file)
      onCoverChange(url)
      toast.success('封面已上传')
    } catch (err: any) {
      toast.error('封面上传失败', { description: err?.message || '' })
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // reset so the same file can be picked again
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件')
      return
    }
    await runUpload(file)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('请拖入图片文件')
      return
    }
    await runUpload(file)
  }

  return (
    <CollapsibleCard title="Media & AI Cover" defaultOpen icon={ImageIcon}>
      <div className="flex flex-col gap-3">
        {coverImage ? (
          <div
            className="rounded-lg overflow-hidden border border-border aspect-[16/9] relative group cursor-pointer"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <img src={coverImage} alt="封面预览" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onCoverChange(null)}
              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs text-white font-medium transition-opacity cursor-pointer"
            >
              移除封面
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleUploadClick}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border border-dashed border-border rounded-lg flex flex-col items-center justify-center text-muted-foreground text-xs min-h-[120px] bg-secondary/20 dark:bg-background/50 hover:bg-secondary/40 hover:border-primary/40 transition-colors cursor-pointer gap-1.5"
          >
            <Upload size={18} />
            <span>点击或拖入图片上传</span>
            <span className="text-[9px] text-muted-foreground/70">PNG / JPG / WebP / SVG</span>
          </button>
        )}

        <div className="flex gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleUploadClick}
            disabled={uploading}
            className="h-8 text-xs flex-1"
          >
            {uploading ? <><Loader2 size={13} className="animate-spin" /> 上传中…</> : <><Upload size={13} /> Upload</>}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onGenerateCover}
            disabled={generatingCover}
            className="h-8 text-xs flex-1"
          >
            {generatingCover ? <><Loader2 size={13} className="animate-spin" /> 绘图中…</> : <><Sparkles size={13} /> AI 封面</>}
          </Button>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-foreground/80">AI 封面描述</span>
          <Input
            value={aiCoverPrompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="描述你想要的 AI 封面…（已自动填入启用的图片提示词，可修改）"
            className="h-8 text-xs bg-background dark:bg-muted/30 border-border/80 focus-visible:ring-1 focus-visible:ring-primary/50"
          />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </CollapsibleCard>
  )
}
