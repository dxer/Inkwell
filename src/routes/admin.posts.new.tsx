import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getDb } from '../lib/db'
import { posts, categories, tags, postsToTags } from '../lib/schema'
import { eq } from 'drizzle-orm'
import { generateId } from '../lib/id'
import { checkSlugUnique } from '../lib/ai'
import { getAiForEditorFn } from '../lib/functions'
import { PostEditor } from '@/components/post-editor'
import type { PostSavePayload } from '@/components/post-editor'

// Server function to save a new post
export const saveNewPostFn = createServerFn({ method: 'POST' })
  .validator((data: {
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
      keywords: data.keywords || "",
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
            .replace(/[^a-zA-Z0-9一-龥]+/g, "-")
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
    const [postData, ai] = await Promise.all([getNewPostDataFn(), getAiForEditorFn()]);
    return { ...postData, ai };
  },
  component: AdminNewPost
})

function AdminNewPost() {
  const { categories: catList, tags: tagList, ai } = Route.useLoaderData() as {
    categories: any[]; tags: any[]; ai: any
  };

  const handleSave = async (payload: PostSavePayload) => {
    return await saveNewPostFn({ data: payload });
  };

  return (
    <PostEditor
      mode="create"
      headerText="撰写新文章"
      draftButtonLabel="保存草稿"
      publishButtonLabel="立即发布"
      categories={catList}
      tags={tagList}
      initialValues={{
        title: '',
        slug: '',
        description: '',
        keywords: '',
        categoryId: null,
        tagNames: [],
        coverImage: null,
        contentBlocks: '',
        contentHtml: '<p></p>',
      }}
      onSave={handleSave}
      defaultCoverPrompt={ai.defaultCoverPrompt}
    />
  )
}
