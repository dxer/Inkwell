import { GlobalAiTrigger } from './global-ai-trigger'
import { SeoCard } from './seo-card'
import { CategoriesTagsCard } from './categories-tags-card'
import { MediaCoverCard } from './media-cover-card'
import type { AiFieldKey, AiFieldMap } from './types'

export interface SeoSidebarProps {
  // global AI trigger
  aiGenerating: boolean
  bodyEmpty: boolean
  onGlobalAi: () => void

  // seo card
  fields: AiFieldMap
  flashing: Set<AiFieldKey>
  slug: string
  description: string
  keywords: string
  onTitleChange: (v: string) => void
  onSlugChange: (v: string) => void
  onDescriptionChange: (v: string) => void
  onKeywordsChange: (v: string) => void
  onApplySelected: () => void
  applyDisabled: boolean

  // categories & tags
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

  // media cover
  coverImage: string | null
  aiCoverPrompt: string
  generatingCover: boolean
  onCoverChange: (url: string | null) => void
  onPromptChange: (v: string) => void
  onGenerateCover: () => void
}

export function SeoSidebar(props: SeoSidebarProps) {
  return (
    <div className="w-full lg:w-80 shrink-0 p-4 lg:p-5 overflow-y-auto border-t lg:border-t-0 lg:border-l border-border bg-muted/30 dark:bg-muted/10 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-[11px] font-bold text-foreground/70 uppercase tracking-widest">SEO &amp; Settings</h2>
        <GlobalAiTrigger
          generating={props.aiGenerating}
          disabled={props.bodyEmpty}
          onClick={props.onGlobalAi}
        />
      </div>

      <SeoCard
        fields={props.fields}
        flashing={props.flashing}
        slug={props.slug}
        description={props.description}
        keywords={props.keywords}
        onTitleChange={props.onTitleChange}
        onSlugChange={props.onSlugChange}
        onDescriptionChange={props.onDescriptionChange}
        onKeywordsChange={props.onKeywordsChange}
        onApplySelected={props.onApplySelected}
        applyDisabled={props.applyDisabled}
      />

      <CategoriesTagsCard
        categories={props.categories}
        tags={props.tags}
        categoryId={props.categoryId}
        selectedTagNames={props.selectedTagNames}
        newTagName={props.newTagName}
        onCategoryChange={props.onCategoryChange}
        onNewTagNameChange={props.onNewTagNameChange}
        onAddTag={props.onAddTag}
        onRemoveTag={props.onRemoveTag}
        onToggleTag={props.onToggleTag}
      />

      <MediaCoverCard
        coverImage={props.coverImage}
        aiCoverPrompt={props.aiCoverPrompt}
        generatingCover={props.generatingCover}
        onCoverChange={props.onCoverChange}
        onPromptChange={props.onPromptChange}
        onGenerateCover={props.onGenerateCover}
      />
    </div>
  )
}
