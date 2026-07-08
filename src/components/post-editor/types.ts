// Shared types for the post-editor component tree.

export type EditorMode = 'create' | 'edit'

/** Fields that the "One-Click AI" can generate and that the user applies selectively. */
export type AiFieldKey = 'title' | 'slug' | 'description' | 'keywords'

export interface AiFieldState {
  /** AI-generated suggestion, not yet written into the form. null = none pending. */
  pending: string | null
  /** True once the user has manually edited the committed value since last apply. */
  dirty: boolean
}

export type AiFieldMap = Record<AiFieldKey, AiFieldState>

export interface PostInitialValues {
  title: string
  slug: string
  description: string
  keywords: string // comma-separated, matches the DB column
  categoryId: string | null // null = uncategorized
  tagNames: string[]
  coverImage: string | null
  contentBlocks: string // markdown source
  contentHtml: string // pre-rendered html for display
}

export interface PostSavePayload {
  title: string
  slug: string
  description: string
  keywords: string
  coverImage: string | null
  contentBlocks: string
  contentHtml: string
  categoryId: string | null
  status: 'draft' | 'published'
  tags: string[]
}

export interface PostEditorProps {
  mode: EditorMode
  initialValues: PostInitialValues
  categories: { id: string; name: string }[]
  tags: { id: string; name: string }[]
  /** Post id in edit mode so AI slug generation excludes self. undefined in create mode. */
  postId?: string
  headerText: string
  draftButtonLabel: string
  publishButtonLabel: string
  /** Save handler supplied by the route (which owns the server fn). */
  onSave: (payload: PostSavePayload) => Promise<{ success: boolean; id?: string }>

  // --- AI module wiring ---
  /** Enabled image prompt content (from AI Center) used to prefill the cover description. Empty when none enabled. */
  defaultCoverPrompt?: string
}

// NOTE: Model & prompt selection now lives entirely in the AI Center
// (one enabled text model, one enabled image model, one enabled text prompt,
// one enabled image prompt). The editor no longer chooses them — the backend
// resolves the enabled ones at generation time. Kept here for reference only.
export interface AiModelOption {
  id: string
  name: string
  capabilities: string
}

export interface AiPromptOption {
  id: string
  name: string
  kind: 'text' | 'image'
  content: string
}
