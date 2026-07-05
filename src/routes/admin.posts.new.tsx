import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getDb } from '../lib/db'
import { posts, categories, tags, postsToTags } from '../lib/schema'
import { eq } from 'drizzle-orm'
import { generateId } from '../lib/id'
import { checkSlugUnique } from '../lib/ai'
import { aiGenerateTitlesFn, aiGenerateSlugFn, aiGenerateSummaryFn, aiGenerateCoverFn } from '../lib/functions'
import { toast } from 'sonner'
import { Sparkles, Wand2, ImageIcon, Loader2, ArrowLeft } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import React, { useState, Suspense } from 'react'

// Lazy-load BlockNote editor to prevent SSR compilation errors (since BlockNote requires document/window)
const Editor = React.lazy(() => import('../components/editor'));

export const saveNewPostFn = createServerFn({ method: 'POST' })
  .validator((data: {
    title: string
    slug: string
    description: string
    coverImage: string | null
    contentBlocks: string
    contentHtml: string
    categoryId: string | null
    status: 'draft' | 'published'
    tags: string[]
  }) => data)
  .handler(async ({ data }) => {
    const db = await getDb();
    const id = generateId();
    
    // Ensure slug uniqueness
    const uniqueSlug = await checkSlugUnique(data.slug, id);
    
    // Insert post metadata and content
    await db.insert(posts).values({
      id,
      title: data.title.trim() || "无标题文章",
      slug: uniqueSlug,
      description: data.description || "",
      coverImage: data.coverImage || null,
      contentBlocks: data.contentBlocks,
      contentHtml: data.contentHtml,
      categoryId: data.categoryId || null,
      status: data.status,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    // Link tags dynamically
    if (data.tags.length > 0) {
      for (const tagName of data.tags) {
        const cleanName = tagName.trim();
        if (!cleanName) continue;
        
        // Find existing tag or create a new one
        let tagRecord = await db.select().from(tags).where(eq(tags.name, cleanName)).limit(1);
        let tagId;
        
        if (tagRecord.length > 0) {
          tagId = tagRecord[0].id;
        } else {
          tagId = generateId();
          // Generate a clean tag slug (allowing alphanumeric and Chinese)
          const cleanTagSlug = cleanName
            .toLowerCase()
            .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, "-")
            .replace(/(^-|-$)/g, "");
          
          await db.insert(tags).values({
            id: tagId,
            name: cleanName,
            slug: cleanTagSlug || `tag-${tagId}`,
          });
        }
        
        await db.insert(postsToTags).values({
          postId: id,
          tagId: tagId,
        });
      }
    }
    
    return { success: true, id };
  });

export const getNewPostDataFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const db = await getDb();
    const allCategories = await db.select().from(categories).orderBy(categories.sortOrder);
    const allTags = await db.select().from(tags);
    return { categories: allCategories, tags: allTags };
  });

export const Route = createFileRoute('/admin/posts/new')({
  loader: async () => {
    return await getNewPostDataFn();
  },
  component: AdminNewPost
})

function AdminNewPost() {
  const { categories: catList, tags: tagList } = Route.useLoaderData() as { categories: any[]; tags: any[] };
  const navigate = useNavigate();

  // Form states
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("__none__");
  const [newTagName, setNewTagName] = useState("");
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);
  const [coverImage, setCoverImage] = useState<string | null>(null);

  const handleAddCustomTag = () => {
    const val = newTagName.trim();
    if (!val) return;
    if (selectedTagNames.includes(val)) {
      toast.error("标签已选择");
      return;
    }
    setSelectedTagNames(prev => [...prev, val]);
    setNewTagName("");
  };

  const handleRemoveTag = (name: string) => {
    setSelectedTagNames(prev => prev.filter(n => n !== name));
  };

  const handleTagToggle = (name: string) => {
    setSelectedTagNames(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  // Editor values
  const [contentBlocks, setContentBlocks] = useState("[]");
  const [contentHtml, setContentHtml] = useState("<p></p>");
  const [plainText, setPlainText] = useState("");

  // AI states
  const [aiCoverPrompt, setAiCoverPrompt] = useState("");
  const [aiGeneratingCover, setAiGeneratingCover] = useState(false);
  const [aiGeneratingSlug, setAiGeneratingSlug] = useState(false);
  const [aiGeneratingTitles, setAiGeneratingTitles] = useState(false);
  const [aiGeneratingSummary, setAiGeneratingSummary] = useState(false);
  const [aiGeneratingAll, setAiGeneratingAll] = useState(false);
  const [aiTitles, setAiTitles] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);

  const handleEditorChange = (data: { json: string; html: string }) => {
    setContentBlocks(data.json);
    setContentHtml(data.html);
    setPlainText(data.html.replace(/<[^>]*>/g, " "));
  };

  // Handled by local handlers above

  // AI Actions
  const handleAIAllInOne = async () => {
    if (!plainText.trim()) {
      toast.error("请先在编辑器中输入内容");
      return;
    }
    setAiGeneratingAll(true);
    const toastId = toast.loading("AI 正在解析正文并生成全套元数据...");
    try {
      // 1. Concurrent requests for titles and summary
      const [titles, summary] = await Promise.all([
        aiGenerateTitlesFn({ data: { content: plainText } }),
        aiGenerateSummaryFn({ data: { content: plainText } })
      ]);

      // Fill summary
      setDescription(summary);
      
      // Cache suggested titles
      setAiTitles(titles);
      
      // 2. Generate slug based on first title (without postId in new mode)
      const firstTitle = titles[0] || "新文章";
      const generatedSlug = await aiGenerateSlugFn({ data: { title: firstTitle } });
      
      setSlug(generatedSlug);

      toast.success("AI 全套元数据已生成！点击下方候选可采纳新标题。", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("全套生成部分失败，请重试", { id: toastId });
    } finally {
      setAiGeneratingAll(false);
    }
  };

  const handleAITitles = async () => {
    if (!plainText.trim()) {
      toast.error("请先在编辑器中输入内容，AI 才能提取主题");
      return;
    }
    setAiGeneratingTitles(true);
    setAiTitles([]);
    try {
      const titles = await aiGenerateTitlesFn({ data: { content: plainText } });
      setAiTitles(titles);
    } catch {
      toast.error("生成标题失败，请稍后重试");
    } finally {
      setAiGeneratingTitles(false);
    }
  };

  const handleAISlug = async () => {
    if (!title.trim()) {
      toast.error("请先填写文章标题");
      return;
    }
    setAiGeneratingSlug(true);
    try {
      const generated = await aiGenerateSlugFn({ data: { title } });
      setSlug(generated);
      toast.success("Slug 已生成");
    } catch {
      toast.error("生成 Slug 失败");
    } finally {
      setAiGeneratingSlug(false);
    }
  };

  const handleAISummary = async () => {
    if (!plainText.trim()) {
      toast.error("请先在编辑器中写入内容");
      return;
    }
    setAiGeneratingSummary(true);
    try {
      const generated = await aiGenerateSummaryFn({ data: { content: plainText } });
      setDescription(generated);
      toast.success("摘要已生成");
    } catch {
      toast.error("生成摘要失败");
    } finally {
      setAiGeneratingSummary(false);
    }
  };

  const handleAICover = async () => {
    if (!aiCoverPrompt.trim()) {
      toast.error("请输入封面图描述词");
      return;
    }
    setAiGeneratingCover(true);
    try {
      const imageUrl = await aiGenerateCoverFn({ data: { prompt: aiCoverPrompt } });
      setCoverImage(imageUrl);
      toast.success("封面图已生成");
    } catch {
      toast.error("AI 生成图片失败");
    } finally {
      setAiGeneratingCover(false);
    }
  };

  const handleSave = async (status: 'draft' | 'published') => {
    setSaving(true);
    try {
      let finalSlug = slug.trim();
      if (!finalSlug) {
        finalSlug = await aiGenerateSlugFn({ data: { title: title || "untitled" } });
      }

      const res = await saveNewPostFn({
        data: {
          title: title.trim() || "无标题文章",
          slug: finalSlug,
          description,
          coverImage,
          contentBlocks,
          contentHtml,
          categoryId: categoryId === "__none__" ? null : categoryId,
          status,
          tags: selectedTagNames,
        }
      });

      if (res.success) {
        toast.success(status === 'published' ? "文章已发布" : "草稿已保存");
        navigate({ to: "/admin/posts" });
      }
    } catch (err: any) {
      toast.error("保存失败", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background text-foreground">
      {/* 1. Global Fixed Control Bar */}
      <div className="shrink-0 border-b border-border/80 px-6 py-4 bg-background/80 backdrop-blur-md flex items-center justify-between z-20 shadow-sm">
        <div className="min-w-0 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon-sm" className="text-muted-foreground shrink-0" title="返回列表">
            <Link to="/admin/posts"><ArrowLeft size={16} /></Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight text-foreground/90 truncate">撰写新文章</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => handleSave('draft')} className="text-xs h-8">
            保存草稿
          </Button>
          <Button type="button" size="sm" disabled={saving} onClick={() => handleSave('published')} className="text-xs h-8 bg-gradient-to-r from-primary to-orange-500 hover:from-primary/90 hover:to-orange-500/90 text-white border-0 shadow-sm transition-all hover:shadow-md">
            {saving ? (<><Loader2 size={13} className="animate-spin" /> 保存中…</>) : "立即发布"}
          </Button>
        </div>
      </div>

      {/* 2. Scrollable Double Column Area */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Editor Main Form Area */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto flex flex-col gap-6">
          <div className="flex flex-col gap-5 relative group">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent py-3 text-2xl md:text-3xl font-extrabold focus:outline-none placeholder:text-muted-foreground/50 transition-all border-b border-border/80 focus:border-transparent peer"
              placeholder="在此输入文章标题…"
            />
            {/* Animated Gradient Focus Line */}
            <span className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary to-orange-500 scale-x-0 peer-focus:scale-x-100 transition-transform duration-300 origin-left" />

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-2">
              <span className="text-xs text-muted-foreground font-semibold w-16 shrink-0">URL 别名</span>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="flex-1 max-w-md h-8 font-mono text-xs bg-background dark:bg-muted/30 border-border/80 focus-visible:ring-1 focus-visible:ring-primary/50"
                placeholder="留空则由 AI 自动生成"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAISlug} disabled={aiGeneratingSlug}>
                {aiGeneratingSlug ? (<><Loader2 size={13} className="animate-spin" /> 生成中</>) : (<><Wand2 size={13} /> AI 生成</>)}
              </Button>
            </div>
          </div>

          {/* Dynamic Rich Text Editor */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground font-semibold">文章内容</Label>
            <div className="rounded-lg border border-border bg-card overflow-hidden min-h-[400px]">
              <Suspense fallback={<div className="h-64 flex items-center justify-center text-sm text-muted-foreground">正在加载编辑器…</div>}>
                <Editor onChange={handleEditorChange} />
              </Suspense>
            </div>
          </div>
        </div>

        {/* AI & Meta Sidebar Panel */}
        <div className="w-full lg:w-80 shrink-0 p-6 overflow-y-auto border-t lg:border-t-0 lg:border-l border-border bg-card/10 flex flex-col gap-5">
          {/* Cover Settings */}
          <div className="flex flex-col gap-3 p-4 rounded-xl border border-border/60 bg-secondary/30 dark:bg-secondary/15 hover:bg-secondary/50 dark:hover:bg-secondary/25 transition-all duration-300">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"><ImageIcon size={13} /> 文章封面</h3>

            {coverImage ? (
              <div className="rounded-lg overflow-hidden border border-border aspect-[16/9] relative group">
                <img src={coverImage} alt="封面预览" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setCoverImage(null)}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs text-white font-medium transition-opacity cursor-pointer"
                >
                  移除封面
                </button>
              </div>
            ) : (
              <div className="border border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground text-xs min-h-[100px] bg-secondary/20 dark:bg-background/50">
                <span className="flex items-center gap-1.5"><ImageIcon size={14} /> 暂无封面</span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Input
                value={aiCoverPrompt}
                onChange={(e) => setAiCoverPrompt(e.target.value)}
                placeholder="描述你想要的封面…"
                className="h-8 text-xs bg-background dark:bg-muted/30 border-border/80 focus-visible:ring-1 focus-visible:ring-primary/50"
              />
              <Button type="button" variant="secondary" size="sm" onClick={handleAICover} disabled={aiGeneratingCover} className="h-8 text-xs">
                {aiGeneratingCover ? (<><Loader2 size={13} className="animate-spin" /> AI 绘图中…</>) : (<><Sparkles size={13} /> AI 生成封面</>)}
              </Button>
            </div>
          </div>

          {/* Categories selection */}
          <div className="flex flex-col gap-3 p-4 rounded-xl border border-border/60 bg-secondary/30 dark:bg-secondary/15 hover:bg-secondary/50 dark:hover:bg-secondary/25 transition-all duration-300">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">分类目录</h3>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-full h-8 text-xs bg-background dark:bg-background/60 border-border/80"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">(未分类)</SelectItem>
                {catList.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags selection */}
          <div className="flex flex-col gap-3 p-4 rounded-xl border border-border/60 bg-secondary/30 dark:bg-secondary/15 hover:bg-secondary/50 dark:hover:bg-secondary/25 transition-all duration-300">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">文章标签</h3>
            
            <div className="flex gap-1.5">
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomTag();
                  }
                }}
                placeholder="输入标签按回车…"
                className="h-8 text-xs bg-background dark:bg-muted/30 border-border/80 focus-visible:ring-1 focus-visible:ring-primary/50"
              />
              <Button type="button" size="sm" className="h-8 text-xs px-2.5 shrink-0" onClick={handleAddCustomTag}>
                添加
              </Button>
            </div>

            {selectedTagNames.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-border bg-secondary/10 dark:bg-background/50 max-h-32 overflow-y-auto">
                {selectedTagNames.map(name => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-primary text-primary-foreground font-medium"
                  >
                    #{name}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(name)}
                      className="hover:bg-primary-foreground/20 rounded-full p-0.5 transition-colors cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                  </span>
                ))}
              </div>
            )}

            {tagList.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">推荐已有标签</span>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1.5 border border-border/40 rounded-lg bg-secondary/10 dark:bg-background/40">
                  {tagList.map(t => {
                    const active = selectedTagNames.includes(t.name);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleTagToggle(t.name)}
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] border transition-colors cursor-pointer",
                          active
                            ? "bg-primary text-primary-foreground border-primary font-medium"
                            : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
                        )}
                      >
                        #{t.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* AI Co-Pilot Panel */}
          <div className="flex flex-col gap-3 p-4 rounded-xl border border-border/60 bg-secondary/30 dark:bg-secondary/15 hover:bg-secondary/50 dark:hover:bg-secondary/25 transition-all duration-300">
            <h3 className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              <Sparkles size={13} className="text-primary animate-pulse" /> AI 助手
            </h3>

            {/* One-Click All-in-One Meta Generator */}
            <div className="flex flex-col gap-1.5 pb-3 border-b border-border/50">
              <Button
                type="button"
                size="sm"
                onClick={handleAIAllInOne}
                disabled={aiGeneratingAll}
                className="w-full text-xs font-semibold h-9 bg-gradient-to-r from-violet-600 via-primary to-orange-500 hover:opacity-90 border-0 text-white shadow-sm flex items-center justify-center gap-1.5 active:translate-y-[1px] transition-transform"
              >
                {aiGeneratingAll ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    AI 深度生成中…
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    一键 AI 生成（标题/别名/摘要）
                  </>
                )}
              </Button>
              <p className="text-[9px] text-muted-foreground leading-normal">
                根据正文一键推荐 3 个标题、生成拼音/英文别名并自动提炼 SEO 摘要。
              </p>
            </div>

            {/* AI Title generation */}
            <div className="flex flex-col gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleAITitles} disabled={aiGeneratingTitles} className="h-8 text-xs bg-background dark:bg-background/40">
                {aiGeneratingTitles ? (<><Loader2 size={13} className="animate-spin" /> 分析中…</>) : "仅推荐 3 个标题"}
              </Button>

              {aiTitles.length > 0 && (
                <div className="flex flex-col gap-1.5 mt-1">
                  <span className="text-[9px] text-muted-foreground">点击回填：</span>
                  {aiTitles.map((t, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setTitle(t)}
                      className="w-full text-left p-2 hover:bg-secondary/80 dark:hover:bg-background border border-border rounded text-[10px] leading-relaxed transition-colors cursor-pointer"
                    >
                      {idx + 1}. {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* AI Summary generation */}
            <div className="flex flex-col gap-2 pt-3 border-t border-border/50">
              <Label className="text-[9px] text-muted-foreground font-semibold">SEO 摘要</Label>
              <Textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="resize-none text-xs bg-background dark:bg-muted/30 border-border/80 focus-visible:ring-1 focus-visible:ring-primary/50"
                placeholder="文章摘要（用于 SEO）"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAISummary} disabled={aiGeneratingSummary} className="h-8 text-xs bg-background dark:bg-background/40">
                {aiGeneratingSummary ? (<><Loader2 size={13} className="animate-spin" /> 提炼中…</>) : (<><Wand2 size={13} /> AI 提炼摘要</>)}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
