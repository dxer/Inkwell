import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { Bot, Plus, Pencil, Trash2, Loader2, KeyRound, Image as ImageIcon, Type } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  listAiModelsFn, createAiModelFn, updateAiModelFn, deleteAiModelFn,
  listAiPromptsFn, createAiPromptFn, updateAiPromptFn, deleteAiPromptFn,
} from '@/lib/functions'

interface AiModelItem {
  id: string
  name: string
  provider: 'cloudflare' | 'openai' | 'openai-compatible'
  modelId: string
  baseUrl: string
  capabilities: string
  isDefaultText: boolean
  isDefaultImage: boolean
  keyMasked: string
  hasKey: boolean
  createdAt: any
  updatedAt: any
}

interface AiPromptItem {
  id: string
  name: string
  kind: 'text' | 'image'
  content: string
  modelId: string | null
  isDefault: boolean
  createdAt: any
  updatedAt: any
}

export const Route = createFileRoute('/admin/ai')({
  loader: async () => {
    const [m, p] = await Promise.all([listAiModelsFn(), listAiPromptsFn()])
    return { models: m.models as AiModelItem[], prompts: p.prompts as AiPromptItem[] }
  },
  component: AdminAi,
})

const PROVIDER_LABELS: Record<AiModelItem['provider'], string> = {
  cloudflare: 'Cloudflare Workers AI',
  openai: 'OpenAI',
  'openai-compatible': 'OpenAI 兼容（自定义）',
}

function AdminAi() {
  const loaderData = Route.useLoaderData()
  const [models, setModels] = useState<AiModelItem[]>(loaderData.models)
  const [prompts, setPrompts] = useState<AiPromptItem[]>(loaderData.prompts)

  return (
    <div className="p-6 md:p-8 lg:p-10 pb-16 w-full overflow-y-auto flex-1 min-h-0">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bot size={22} className="text-primary" /> AI 中心
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            管理 AI 模型与提示词模板，编辑文章时选用
          </p>
        </div>
      </div>

      <TabsUi
        models={models}
        prompts={prompts}
        setModels={setModels}
        setPrompts={setPrompts}
      />
    </div>
  )
}

function TabsUi({
  models, prompts, setModels, setPrompts,
}: {
  models: AiModelItem[]
  prompts: AiPromptItem[]
  setModels: React.Dispatch<React.SetStateAction<AiModelItem[]>>
  setPrompts: React.Dispatch<React.SetStateAction<AiPromptItem[]>>
}) {
  const [tab, setTab] = useState<'models' | 'prompts'>('models')

  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex w-fit rounded-lg bg-muted p-[3px]">
        <button
          onClick={() => setTab('models')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === 'models' ? 'bg-background text-foreground shadow-sm' : 'text-foreground/60 hover:text-foreground'}`}
        >
          模型管理
        </button>
        <button
          onClick={() => setTab('prompts')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === 'prompts' ? 'bg-background text-foreground shadow-sm' : 'text-foreground/60 hover:text-foreground'}`}
        >
          提示词管理
        </button>
      </div>

      {tab === 'models' ? (
        <ModelsTab models={models} setModels={setModels} />
      ) : (
        <PromptsTab prompts={prompts} setPrompts={setPrompts} models={models} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Models tab
// ---------------------------------------------------------------------------

const PAGE_SIZE = 10

function PaginationBar({ page, pageSize, total, onPageChange }: {
  page: number
  pageSize: number
  total: number
  onPageChange: (p: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null
  const safePage = Math.min(Math.max(1, page), totalPages)
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-border/40">
      <span className="text-xs text-muted-foreground tabular-nums">
        共 {total} 条 · 第 {safePage} / {totalPages} 页
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-8 text-xs" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)}>
          ← 上一页
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs" disabled={safePage >= totalPages} onClick={() => onPageChange(safePage + 1)}>
          下一页 →
        </Button>
      </div>
    </div>
  )
}

function ModelsTab({ models, setModels }: { models: AiModelItem[]; setModels: React.Dispatch<React.SetStateAction<AiModelItem[]>> }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AiModelItem | null>(null)
  const [saving, setSaving] = useState(false)

  // form state
  const [name, setName] = useState('')
  const [provider, setProvider] = useState<AiModelItem['provider']>('cloudflare')
  const [modelId, setModelId] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [capText, setCapText] = useState(true)
  const [capImage, setCapImage] = useState(false)
  const [isDefaultText, setIsDefaultText] = useState(false)
  const [isDefaultImage, setIsDefaultImage] = useState(false)
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(models.length / PAGE_SIZE))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const pagedModels = models.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const openCreate = () => {
    setEditing(null)
    setName(''); setProvider('cloudflare'); setModelId(''); setBaseUrl('')
    setApiKey(''); setCapText(true); setCapImage(false)
    setIsDefaultText(false); setIsDefaultImage(false)
    setDialogOpen(true)
  }

  const openEdit = (m: AiModelItem) => {
    setEditing(m)
    setName(m.name); setProvider(m.provider); setModelId(m.modelId); setBaseUrl(m.baseUrl || '')
    setApiKey(''); setCapText(m.capabilities.includes('text')); setCapImage(m.capabilities.includes('image'))
    setIsDefaultText(m.isDefaultText); setIsDefaultImage(m.isDefaultImage)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!name.trim() || !modelId.trim()) {
      toast.error('请填写模型名称与模型 ID')
      return
    }
    const capabilities = [
      capText ? 'text' : '',
      capImage ? 'image' : '',
    ].filter(Boolean).join(',') || 'text'

    setSaving(true)
    try {
      if (editing) {
        await updateAiModelFn({
          data: {
            id: editing.id, name, provider, modelId, baseUrl,
            apiKey, capabilities, isDefaultText, isDefaultImage,
          },
        })
        const updated = await listAiModelsFn()
        setModels(updated.models as AiModelItem[])
        toast.success('模型已更新')
      } else {
        await createAiModelFn({
          data: { name, provider, modelId, baseUrl, apiKey, capabilities, isDefaultText, isDefaultImage },
        })
        const updated = await listAiModelsFn()
        setModels(updated.models as AiModelItem[])
        toast.success('模型已添加')
      }
      setDialogOpen(false)
    } catch (e: any) {
      toast.error('保存失败', { description: e?.message })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (m: AiModelItem) => {
    if (!window.confirm(`确认删除模型「${m.name}」？`)) return
    try {
      await deleteAiModelFn({ data: { id: m.id } })
      setModels((prev) => prev.filter((x) => x.id !== m.id))
      toast.success('已删除')
    } catch (e: any) {
      toast.error('删除失败', { description: e?.message })
    }
  }

  const toggleModelDefault = async (m: AiModelItem, which: 'text' | 'image', val: boolean) => {
    try {
      await updateAiModelFn({
        data: {
          id: m.id, name: m.name, provider: m.provider, modelId: m.modelId,
          baseUrl: m.baseUrl, apiKey: '', capabilities: m.capabilities,
          isDefaultText: which === 'text' ? val : m.isDefaultText,
          isDefaultImage: which === 'image' ? val : m.isDefaultImage,
        },
      })
      const updated = await listAiModelsFn()
      setModels(updated.models as AiModelItem[])
      toast.success(val ? '已启用' : '已关闭')
    } catch (e: any) {
      toast.error('操作失败', { description: e?.message })
    }
  }

  return (
    <Card className="py-0">
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <h3 className="text-sm font-semibold">模型列表（{models.length}）</h3>
          <Button size="sm" className="h-8 text-xs" onClick={openCreate}>
            <Plus size={14} /> 新增模型
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>服务商</TableHead>
              <TableHead>模型 ID</TableHead>
              <TableHead>能力</TableHead>
              <TableHead>启用</TableHead>
              <TableHead>API Key</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  还没有模型，点击「新增模型」添加。
                </TableCell>
              </TableRow>
            )}
            {pagedModels.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-[11px]">{PROVIDER_LABELS[m.provider]}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{m.modelId}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {m.capabilities.includes('text') && (
                      <Badge variant="outline" className="text-[10px] gap-0.5"><Type size={10} /> 文本</Badge>
                    )}
                    {m.capabilities.includes('image') && (
                      <Badge variant="outline" className="text-[10px] gap-0.5"><ImageIcon size={10} /> 图片</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <Switch size="sm" checked={m.isDefaultText} onCheckedChange={(v) => toggleModelDefault(m, 'text', v)} />
                      <span className="text-[10px] text-muted-foreground">文本</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <Switch size="sm" checked={m.isDefaultImage} onCheckedChange={(v) => toggleModelDefault(m, 'image', v)} />
                      <span className="text-[10px] text-muted-foreground">图片</span>
                    </label>
                  </div>
                </TableCell>
                <TableCell className="text-xs font-mono">
                  {m.hasKey ? (m.keyMasked || '••••') : <span className="text-muted-foreground flex items-center gap-1"><KeyRound size={11} /> 无</span>}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(m)}>
                      <Pencil size={13} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(m)}>
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationBar page={safePage} pageSize={PAGE_SIZE} total={models.length} onPageChange={setPage} />
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? '编辑模型' : '新增模型'}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>模型名称</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：DeepSeek Chat" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>服务商</Label>
                <Select value={provider} onValueChange={(v) => setProvider(v as AiModelItem['provider'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cloudflare">Cloudflare Workers AI</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="openai-compatible">OpenAI 兼容（自定义端点）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>模型 ID</Label>
                <Input value={modelId} onChange={(e) => setModelId(e.target.value)} placeholder="@cf/... 或 gpt-4o-mini" className="font-mono text-xs" />
              </div>
            </div>

            {provider !== 'cloudflare' && (
              <div className="flex flex-col gap-2">
                <Label>API 基地址 (base_url)</Label>
                <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" className="font-mono text-xs" />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label>API Key {editing && <span className="text-muted-foreground font-normal">（留空则不修改）</span>}</Label>
              <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={provider === 'cloudflare' ? '留空则使用 Cloudflare 绑定' : 'sk-...'} className="font-mono text-xs" />
              <p className="text-[11px] text-muted-foreground">密钥以 AES-256-GCM 加密存储，不会以明文落库。</p>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border border-border/60 p-3">
              <span className="text-[11px] font-semibold text-foreground/70">能力</span>
              <div className="flex items-center justify-between">
                <span className="text-xs flex items-center gap-1.5"><Type size={13} /> 文本生成（标题/摘要/关键词等）</span>
                <Switch checked={capText} onCheckedChange={setCapText} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs flex items-center gap-1.5"><ImageIcon size={13} /> 图片生成（AI 封面）</span>
                <Switch checked={capImage} onCheckedChange={setCapImage} />
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border border-border/60 p-3">
              <span className="text-[11px] font-semibold text-foreground/70">启用（编辑文章时使用）</span>
              <div className="flex items-center justify-between">
                <span className="text-xs">启用为文本生成模型</span>
                <Switch checked={isDefaultText} onCheckedChange={setIsDefaultText} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">启用为图片生成模型</span>
                <Switch checked={isDefaultImage} onCheckedChange={setIsDefaultImage} />
              </div>
              <p className="text-[11px] text-muted-foreground">同一类型仅一个模型会被启用。</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 size={13} className="animate-spin" />} 保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Prompts tab
// ---------------------------------------------------------------------------

function PromptsTab({
  prompts, setPrompts, models,
}: {
  prompts: AiPromptItem[]
  setPrompts: React.Dispatch<React.SetStateAction<AiPromptItem[]>>
  models: AiModelItem[]
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AiPromptItem | null>(null)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [kind, setKind] = useState<'text' | 'image'>('text')
  const [content, setContent] = useState('')
  const [modelId, setModelId] = useState<string>('none')
  const [isDefault, setIsDefault] = useState(false)
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(prompts.length / PAGE_SIZE))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const pagedPrompts = prompts.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const openCreate = () => {
    setEditing(null)
    setName(''); setKind('text'); setContent(''); setModelId('none'); setIsDefault(false)
    setDialogOpen(true)
  }

  const openEdit = (p: AiPromptItem) => {
    setEditing(p)
    setName(p.name); setKind(p.kind); setContent(p.content); setModelId(p.modelId || 'none'); setIsDefault(p.isDefault)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!name.trim() || !content.trim()) {
      toast.error('请填写提示词名称与内容')
      return
    }
    const payload = { name, kind, content, modelId: modelId === 'none' ? null : modelId, isDefault }
    setSaving(true)
    try {
      if (editing) {
        await updateAiPromptFn({ data: { id: editing.id, ...payload } })
        const updated = await listAiPromptsFn()
        setPrompts(updated.prompts as AiPromptItem[])
        toast.success('提示词已更新')
      } else {
        await createAiPromptFn({ data: payload })
        const updated = await listAiPromptsFn()
        setPrompts(updated.prompts as AiPromptItem[])
        toast.success('提示词已添加')
      }
      setDialogOpen(false)
    } catch (e: any) {
      toast.error('保存失败', { description: e?.message })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (p: AiPromptItem) => {
    if (!window.confirm(`确认删除提示词「${p.name}」？`)) return
    try {
      await deleteAiPromptFn({ data: { id: p.id } })
      setPrompts((prev) => prev.filter((x) => x.id !== p.id))
      toast.success('已删除')
    } catch (e: any) {
      toast.error('删除失败', { description: e?.message })
    }
  }

  const togglePromptDefault = async (p: AiPromptItem, val: boolean) => {
    try {
      await updateAiPromptFn({
        data: { id: p.id, name: p.name, kind: p.kind, content: p.content, modelId: p.modelId, isDefault: val },
      })
      const updated = await listAiPromptsFn()
      setPrompts(updated.prompts as AiPromptItem[])
      toast.success(val ? '已启用' : '已关闭')
    } catch (e: any) {
      toast.error('操作失败', { description: e?.message })
    }
  }

  return (
    <Card className="py-0">
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <h3 className="text-sm font-semibold">提示词列表（{prompts.length}）</h3>
          <Button size="sm" className="h-8 text-xs" onClick={openCreate}>
            <Plus size={14} /> 新增提示词
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>内容预览</TableHead>
              <TableHead>启用</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prompts.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  还没有提示词，点击「新增提示词」添加。
                </TableCell>
              </TableRow>
            )}
            {pagedPrompts.map((p) => {
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] gap-0.5">
                      {p.kind === 'text' ? <><Type size={10} /> 文章元数据</> : <><ImageIcon size={10} /> 图片生成</>}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[240px] truncate text-muted-foreground text-xs">{p.content}</TableCell>
                  <TableCell>
                    <Switch checked={p.isDefault} onCheckedChange={(v) => togglePromptDefault(p, v)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                        <Pencil size={13} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(p)}>
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <PaginationBar page={safePage} pageSize={PAGE_SIZE} total={prompts.length} onPageChange={setPage} />
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? '编辑提示词' : '新增提示词'}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>提示词名称</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：技术博客 SEO 优化" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>类型</Label>
                <Select value={kind} onValueChange={(v) => setKind(v as 'text' | 'image')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">文章元数据</SelectItem>
                    <SelectItem value="image">图片生成</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>提示词内容</Label>
              <Textarea
                rows={6}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={kind === 'text'
                  ? '你是一个专业的博客编辑与 SEO 专家，请为文章生成标题、slug、描述与关键词…'
                  : '请生成一张符合文章主题的高质量封面图，风格…'}
                className="resize-none text-xs leading-relaxed"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>绑定模型（可选）</Label>
              <Select value={modelId} onValueChange={setModelId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">使用默认模型</SelectItem>
                  {models
                    .filter((m) => kind === 'text' ? m.capabilities.includes('text') : m.capabilities.includes('image'))
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">选用该提示词时优先使用此模型，否则用对应默认模型。</p>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div className="flex flex-col">
                <span className="text-xs font-medium">启用此提示词</span>
                <span className="text-[11px] text-muted-foreground">
                  启用后，编辑文章时该类型（{kind === 'text' ? '文章元数据' : '图片生成'}）自动使用本提示词。同类型仅一个会被启用。
                </span>
              </div>
              <Switch checked={isDefault} onCheckedChange={setIsDefault} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 size={13} className="animate-spin" />} 保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
