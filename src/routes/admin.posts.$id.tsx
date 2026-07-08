import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getDb } from '../lib/db'
import { posts, categories, tags, postsToTags } from '../lib/schema'
import { eq } from 'drizzle-orm'
import { checkSlugUnique } from '../lib/ai'
import { generateId } from '../lib/id'
import { getAiForEditorFn } from '../lib/functions'
import { PostEditor } from '@/components/post-editor'
import type { PostSavePayload } from '@/components/post-editor'

// Server function to update a post
export const updatePostFn = createServerFn({ method: 'POST' })
  .validator((data: {
    id: string
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

    // Ensure slug uniqueness (exclude self)
    const uniqueSlug = await checkSlugUnique(data.slug, data.id);

    // Update post
    await db
      .update(posts)
      .set({
        title: data.title.trim() || "无标题文章",
        slug: uniqueSlug,
        description: data.description || "",
        keywords: data.keywords || "",
        coverImage: data.coverImage || null,
        contentBlocks: data.contentBlocks,
        contentHtml: data.contentHtml,
        categoryId: data.categoryId || null,
        status: data.status,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, data.id));

    // Update tags mappings: delete old relations first
    await db.delete(postsToTags).where(eq(postsToTags.postId, data.id));

    // Insert new relations dynamically
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
          postId: data.id,
          tagId: tagId,
        });
      }
    }

    return { success: true };
  });

export const getEditPostDataFn = createServerFn({ method: 'GET' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { id } = data;
    const db = await getDb();

    // Fetch target post
    const postResult = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
    const post = postResult[0];
    if (!post) {
      throw new Error("文章未找到");
    }

    // Fetch categories and tags
    const allCategories = await db.select().from(categories).orderBy(categories.sortOrder);
    const allTags = await db.select().from(tags);

    // Fetch active tag associations with their names
    const activeTagsList = await db
      .select({ tagName: tags.name })
      .from(postsToTags)
      .innerJoin(tags, eq(postsToTags.tagId, tags.id))
      .where(eq(postsToTags.postId, id));

    const activeTagNames = activeTagsList.map((t: any) => t.tagName).filter(Boolean) as string[];

    return {
      post,
      categories: allCategories,
      tags: allTags,
      activeTagNames,
    };
  });

export const Route = createFileRoute('/admin/posts/$id')({
  loader: async ({ params }) => {
    const [postData, ai] = await Promise.all([
      getEditPostDataFn({ data: { id: params.id } }),
      getAiForEditorFn(),
    ]);
    return { ...postData, ai };
  },
  component: AdminEditPost
})

function AdminEditPost() {
  const { post, categories: catList, tags: tagList, activeTagNames, ai } = Route.useLoaderData() as {
    post: any; categories: any[]; tags: any[]; activeTagNames: string[]; ai: any
  };

  const handleSave = async (payload: PostSavePayload) => {
    await updatePostFn({ data: { id: post.id, ...payload } });
    return { success: true };
  };

  return (
    <PostEditor
      mode="edit"
      postId={post.id}
      headerText="编辑文章"
      draftButtonLabel="存为草稿"
      publishButtonLabel="更新并发布"
      categories={catList}
      tags={tagList}
      initialValues={{
        title: post.title || '',
        slug: post.slug || '',
        description: post.description || '',
        keywords: post.keywords || '',
        categoryId: post.categoryId || null,
        tagNames: activeTagNames || [],
        coverImage: post.coverImage ?? null,
        contentBlocks: post.contentBlocks || '',
        contentHtml: post.contentHtml || '<p></p>',
      }}
      onSave={handleSave}
      defaultCoverPrompt={ai.defaultCoverPrompt}
    />
  )
}
