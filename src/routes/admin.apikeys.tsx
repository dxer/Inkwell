import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Loader2, Trash2, KeyRound, Copy, Check, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import React, { useRef, useState } from 'react'
import {
  listApiKeysFn,
  createApiKeyFn,
  deleteApiKeyFn,
} from '../lib/functions'

export const Route = createFileRoute('/admin/apikeys')({
  loader: async () => {
    return await listApiKeysFn();
  },
  component: AdminApiKeys
})

function AdminApiKeys() {
  const { keys: initialKeys } = Route.useLoaderData() as {
    keys: { id: string; name: string; prefix: string; createdAt: any; lastUsedAt: any | null }[];
  };

  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("请填写密钥名称");
      return;
    }
    setSaving(true);
    try {
      const res = await createApiKeyFn({ data: { name } });
      setKeys((prev) => [
        {
          id: res.id,
          name: name.trim(),
          prefix: res.prefix,
          createdAt: new Date(),
          lastUsedAt: null,
        },
        ...prev,
      ]);
      setNewKey(res.key);
      setCopied(false);
      setName("");
      toast.success("API 密钥已创建");
    } catch (err: any) {
      toast.error("创建失败", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteApiKeyFn({ data: { id } });
      setKeys((prev) => prev.filter((k) => k.id !== id));
      toast.success("密钥已删除");
    } catch (err: any) {
      toast.error("删除失败", { description: err.message });
    }
  };

  const keyInputRef = useRef<HTMLInputElement>(null);

  const copyKey = async () => {
    if (!newKey) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(newKey);
      } else if (keyInputRef.current) {
        // Fallback for non-secure contexts (e.g. http://LAN_IP:3080).
        // Use the on-screen <input> inside the dialog (within Radix's
        // focus-trapped region) instead of a detached <textarea> on
        // document.body, which the AlertDialog focus-trap would steal
        // focus from, breaking execCommand('copy').
        const el = keyInputRef.current;
        el.focus();
        el.select();
        el.setSelectionRange(0, newKey.length);
        document.execCommand("copy");
      } else {
        throw new Error("无法复制到剪贴板");
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("复制失败，请手动复制");
    }
  };

  return (
    <div className="p-6 md:p-8 lg:p-10 flex flex-col gap-5 w-full overflow-y-auto flex-1 min-h-0">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">API 密钥</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          用于外部博客系统（如 Hugo / Hexo）通过接口同步文章。密钥仅在创建时展示一次。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Create form */}
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40">
            <h3 className="text-sm font-semibold">新建密钥</h3>
          </div>
          <div className="p-5">
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="key-name">密钥名称</Label>
                <Input
                  id="key-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：Hugo 博客同步"
                />
                <p className="text-[11px] text-muted-foreground">
                  用于区分不同来源，便于后续管理。
                </p>
              </div>
              <Button type="submit" disabled={saving} className="w-full">
                {saving ? (<><Loader2 size={15} className="animate-spin" /> 创建中…</>) : (<><Plus size={15} /> 生成密钥</>)}
              </Button>
            </form>
          </div>
        </div>

        {/* Keys list */}
        <div className="lg:col-span-2 rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40">
            <h3 className="text-sm font-semibold">密钥列表</h3>
          </div>
          <div className="p-4">
            {keys.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <KeyRound size={28} className="text-muted-foreground/50" strokeWidth={1.5} />
                <p className="text-sm text-muted-foreground mt-3">暂无密钥，在左侧创建</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {keys.map((k) => (
                  <div
                    key={k.id}
                    className="flex items-center justify-between p-3.5 rounded-lg border border-border/60 transition-all duration-200 hover:bg-secondary/20 hover:border-border"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pl-1.5">
                      <KeyRound size={15} className="text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <span className="text-sm font-semibold truncate text-foreground/90 block">{k.name}</span>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {k.prefix}••••••••
                          {k.lastUsedAt ? ` · 最近使用 ${new Date(k.lastUsedAt).toLocaleString()}` : " · 从未使用"}
                        </span>
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0">
                          <Trash2 size={14} />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>删除密钥「{k.name}」？</AlertDialogTitle>
                          <AlertDialogDescription>
                            删除后使用该密钥的同步请求将立即失效。此操作不可撤销。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(k.id)}>确认删除</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Show new key once */}
      <AlertDialog open={!!newKey} onOpenChange={(open) => { if (!open) setNewKey(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>密钥已生成</AlertDialogTitle>
            <AlertDialogDescription>
              请立即复制并妥善保存，密钥仅展示这一次，关闭后无法再次查看。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 p-3">
            <input
              ref={keyInputRef}
              readOnly
              value={newKey ?? ""}
              className="flex-1 min-w-0 bg-transparent font-mono text-xs break-all text-foreground outline-none border-0 p-0 selection:bg-primary selection:text-primary-foreground"
            />
            <Button type="button" size="icon-sm" variant="outline" onClick={copyKey} title="复制">
              {copied ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setNewKey(null)}>我已保存</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
