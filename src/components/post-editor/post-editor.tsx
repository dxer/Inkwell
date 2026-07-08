import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  aiGenerateAllMetaFn,
  aiGenerateSlugFn,
  aiGenerateCoverFn,
} from '@/lib/functions'
import { EditorTopBar } from './editor-top-bar'
import { EditorMainArea } from './editor-main-area'
import { SeoSidebar } from './seo-sidebar'
import { useAiSuggestions } from './use-ai-suggestions'
import type { AiFieldKey, PostEditorProps } from './types'

export function PostEditor(props: PostEditorProps) {
  const { mode, initialValues, categories, tags, postId, headerText, draftButtonLabel, publishButtonLabel, onSave } = props
  const navigate = useNavigate()

  // --- committed form state (lazy-init from initialValues so re-renders don't reset) ---
  const [title, setTitle] = useState(() => initialValues.title)
  const [slug, setSlug] = useState(() => initialValues.slug)
  const [description, setDescription] = useState(() => initialValues.description)
  const [keywords, setKeywords] = useState(() => initialValues.keywords)
  const [categoryId, setCategoryId] = useState<string | null>(() => initialValues.categoryId)
  const [tagNames, setTagNames] = useState<string[]>(() => initialValues.tagNames)
  const [newTagName, setNewTagName] = useState('')
  const [coverImage, setCoverImage] = useState<string | null>(() => initialValues.coverImage)

  // --- editor state ---
  const [contentBlocks, setContentBlocks] = useState(() => initialValues.contentBlocks)
  const [contentHtml, setContentHtml] = useState(() => initialValues.contentHtml)
  const [plainText, setPlainText] = useState('')

  // --- AI state ---
  const ai = useAiSuggestions()
  const [aiTitles, setAiTitles] = useState<string[]>([])
  const [aiCoverPrompt, setAiCoverPrompt] = useState(() => props.defaultCoverPrompt ?? '')
  const [aiGeneratingAll, setAiGeneratingAll] = useState(false)
  const [aiGeneratingCover, setAiGeneratingCover] = useState(false)

  const [saving, setSaving] = useState(false)

  // plainText is derived from contentHtml, but we also gate the global AI button on it.
  const bodyEmpty = useMemo(() => !plainText.trim(), [plainText])

  const handleEditorChange = (data: { markdown: string; html: string }) => {
    setContentBlocks(data.markdown)
    setContentHtml(data.html)
    setPlainText(data.html.replace(/<[^>]*>/g, ' '))
  }

  // --- tag handlers ---
  const handleAddTag = () => {
    const val = newTagName.trim()
    if (!val) return
    if (tagNames.includes(val)) {
      toast.error('标签已选择')
      return
    }
    setTagNames((prev) => [...prev, val])
    setNewTagName('')
  }
  const handleRemoveTag = (name: string) => setTagNames((prev) => prev.filter((n) => n !== name))
  const handleToggleTag = (name: string) =>
    setTagNames((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]))

  // --- SEO field change wrappers (mark dirty so AI won't silently clobber) ---
  const onTitleChange = (v: string) => { setTitle(v); ai.markDirty('title') }
  const onSlugChange = (v: string) => { setSlug(v); ai.markDirty('slug') }
  const onDescriptionChange = (v: string) => { setDescription(v); ai.markDirty('description') }
  const onKeywordsChange = (v: string) => { setKeywords(v); ai.markDirty('keywords') }

  // --- Global AI: one LLM call produces titles + slug + description + keywords ---
  // A single round-trip instead of 4 concurrent calls cuts token usage and latency.
  const onGlobalAi = async () => {
    if (!plainText.trim()) {
      toast.error('请先在左侧输入正文内容')
      return
    }
     setAiGeneratingAll(true)
    const toastId = toast.loading('AI 正在解析正文并生成全套元数据...')
    try {
      const meta = await aiGenerateAllMetaFn({
        data: { content: plainText, postId },
      })

      setAiTitles(meta.titles)
      // Seed pending suggestions; dirty fields auto-uncheck inside the hook.
      // Use the LLM's first title suggestion as the pending title value.
      ai.seedSuggestions({
        title: meta.titles[0],
        slug: meta.slug,
        description: meta.description,
        keywords: meta.keywords,
      })

      toast.success('AI 建议已生成，勾选字段后点击「应用所选」', { id: toastId })
    } catch (err) {
      console.error(err)
      toast.error('生成失败，请重试', { id: toastId })
    } finally {
      setAiGeneratingAll(false)
    }
  }

  // --- Apply Selected: apply all pending values ---
  const onApplySelected = () => {
    const all: AiFieldKey[] = ['title', 'slug', 'description', 'keywords']
    const toApply = all.filter((k) => ai.fields[k].pending != null)
    if (toApply.length === 0) return
    if (ai.fields.title.pending) setTitle(ai.fields.title.pending)
    if (ai.fields.slug.pending) setSlug(ai.fields.slug.pending)
    if (ai.fields.description.pending) setDescription(ai.fields.description.pending)
    if (ai.fields.keywords.pending) setKeywords(ai.fields.keywords.pending)
    ai.clearApplied(toApply)
    ai.flash(toApply)
    toast.success(`已应用 ${toApply.length} 个字段`)
  }

  const applyDisabled = !(['title', 'slug', 'description', 'keywords'] as AiFieldKey[]).some(
    (k) => ai.fields[k].pending != null,
  )

  // --- AI Cover ---
  const onGenerateCover = async () => {
    if (!aiCoverPrompt.trim()) {
      toast.error('请输入封面图描述词')
      return
    }
    setAiGeneratingCover(true)
    try {
      const url = await aiGenerateCoverFn({ data: { prompt: aiCoverPrompt } })
      setCoverImage(url)
      toast.success('封面图已生成')
    } catch (e: any) {
      toast.error('AI 生成图片失败', { description: e?.message })
    } finally {
      setAiGeneratingCover(false)
    }
  }

  // --- Save (delegates to the route's onSave) ---
  const handleSave = async (status: 'draft' | 'published') => {
    setSaving(true)
    try {
      let finalSlug = slug.trim()
      if (!finalSlug) {
        finalSlug = await aiGenerateSlugFn({ data: { title: title || 'untitled', postId } })
      }
      const res = await onSave({
        title: title.trim() || '无标题文章',
        slug: finalSlug,
        description,
        keywords,
        coverImage,
        contentBlocks,
        contentHtml,
        categoryId,
        status,
        tags: tagNames,
      })
      if (res.success) {
        toast.success(status === 'published' ? (mode === 'edit' ? '文章已更新并发布' : '文章已发布') : '草稿已保存')
        navigate({ to: '/admin/posts' })
      }
    } catch (err: any) {
      toast.error(mode === 'edit' ? '更新失败' : '保存失败', { description: err?.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background text-foreground">
      <EditorTopBar
        headerText={headerText}
        draftButtonLabel={draftButtonLabel}
        publishButtonLabel={publishButtonLabel}
        saving={saving}
        onSaveDraft={() => handleSave('draft')}
        onPublish={() => handleSave('published')}
      />

      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        <EditorMainArea
          title={title}
          onTitleChange={onTitleChange}
          initialMarkdown={initialValues.contentBlocks}
          onEditorChange={handleEditorChange}
          aiTitles={aiTitles}
          onPickTitle={(t) => { setTitle(t); toast.success('已采纳该标题') }}
        />

        <SeoSidebar
          aiGenerating={aiGeneratingAll}
          bodyEmpty={bodyEmpty}
          onGlobalAi={onGlobalAi}
          fields={ai.fields}
          flashing={ai.flashing}
          slug={slug}
          description={description}
          keywords={keywords}
          onTitleChange={onTitleChange}
          onSlugChange={onSlugChange}
          onDescriptionChange={onDescriptionChange}
          onKeywordsChange={onKeywordsChange}
          onApplySelected={onApplySelected}
          applyDisabled={applyDisabled}
          categories={categories}
          tags={tags}
          categoryId={categoryId}
          selectedTagNames={tagNames}
          newTagName={newTagName}
          onCategoryChange={setCategoryId}
          onNewTagNameChange={setNewTagName}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
          onToggleTag={handleToggleTag}
          coverImage={coverImage}
          aiCoverPrompt={aiCoverPrompt}
          generatingCover={aiGeneratingCover}
          onCoverChange={setCoverImage}
          onPromptChange={setAiCoverPrompt}
          onGenerateCover={onGenerateCover}
        />
      </div>
    </div>
  )
}
