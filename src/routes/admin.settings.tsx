import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getDb } from '../lib/db'
import { siteSettings } from '../lib/schema'
import { eq } from 'drizzle-orm'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import React, { useState } from 'react'

export const updateSettingsFn = createServerFn({ method: 'POST' })
  .validator((data: Record<string, string>) => data)
  .handler(async ({ data }) => {
    const db = await getDb();
    
    for (const [key, value] of Object.entries(data)) {
      const existing = await db
        .select()
        .from(siteSettings)
        .where(eq(siteSettings.key, key))
        .limit(1);
        
      if (existing.length > 0) {
        await db
          .update(siteSettings)
          .set({ value, updatedAt: new Date() })
          .where(eq(siteSettings.key, key));
      } else {
        await db
          .insert(siteSettings)
          .values({ key, value, updatedAt: new Date() });
      }
    }
    
    return { success: true };
  });

export const getSettingsFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const db = await getDb();
    const settingsList = await db.select().from(siteSettings);
    const settings: Record<string, string> = {};
    for (const s of settingsList) {
      settings[s.key] = s.value;
    }
    return { settings };
  });

export const Route = createFileRoute('/admin/settings')({
  loader: async () => {
    return await getSettingsFn();
  },
  component: AdminSettings
})

function AdminSettings() {
  const { settings } = Route.useLoaderData();
  const navigate = useNavigate();
  
  // State variables for form fields
  const [siteTitle, setSiteTitle] = useState(settings.site_title || "");
  const [siteSubtitle, setSiteSubtitle] = useState(settings.site_subtitle || "");
  const [siteDescription, setSiteDescription] = useState(settings.site_description || "");
  const [keywords, setKeywords] = useState(settings.keywords || "");
  const [language, setLanguage] = useState(settings.language || "zh-CN");
  const [pageSize, setPageSize] = useState(settings.page_size || "10");
  const [githubUrl, setGithubUrl] = useState(settings.github_url || "");
  const [twitterUrl, setTwitterUrl] = useState(settings.twitter_url || "");
  const [showGithub, setShowGithub] = useState(settings.show_github !== "false");
  const [showTwitter, setShowTwitter] = useState(settings.show_twitter !== "false");
  const [showCoverImage, setShowCoverImage] = useState(settings.show_cover_image !== "false");
  const [showViews, setShowViews] = useState(settings.show_views !== "false");
  const [rssUrl, setRssUrl] = useState(settings.rss_url || "");
  const [icpText, setIcpText] = useState(settings.icp_text || "");
  const [googleAnalyticsId, setGoogleAnalyticsId] = useState(settings.google_analytics_id || "");

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      site_title: siteTitle,
      site_subtitle: siteSubtitle,
      site_description: siteDescription,
      keywords,
      language,
      page_size: pageSize,
      github_url: githubUrl,
      twitter_url: twitterUrl,
      show_github: showGithub ? "true" : "false",
      show_twitter: showTwitter ? "true" : "false",
      show_cover_image: showCoverImage ? "true" : "false",
      show_views: showViews ? "true" : "false",
      rss_url: rssUrl,
      icp_text: icpText,
      google_analytics_id: googleAnalyticsId,
    };

    try {
      await updateSettingsFn({ data: payload });
      toast.success("设置已保存");
      navigate({ to: "." });
    } catch (err: any) {
      toast.error("保存失败", { description: err.message || "未知错误" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 md:p-8 lg:p-10 pb-16 w-full overflow-y-auto flex-1 min-h-0">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">站点设置</h1>
          <p className="text-sm text-muted-foreground mt-0.5">配置博客全局元数据、社交链接及备案信息</p>
        </div>
        <Button type="submit" disabled={saving} size="sm" className="h-8 text-xs font-semibold min-w-[100px] shadow-sm">
          {saving ? (<><Loader2 size={13} className="animate-spin mr-1" /> 保存中…</>) : "保存设置"}
        </Button>
      </div>

      {/* Basic Info */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40">
          <h3 className="text-sm font-semibold">基本信息</h3>
        </div>
        <div className="p-5 flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="site_title">站点名称</Label>
              <Input id="site_title" value={siteTitle} onChange={(e) => setSiteTitle(e.target.value)} placeholder="例如：技术小黑屋" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="site_subtitle">站点副标题</Label>
              <Input id="site_subtitle" value={siteSubtitle} onChange={(e) => setSiteSubtitle(e.target.value)} placeholder="一句简短的描述" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="site_description">SEO 站点描述</Label>
            <Textarea id="site_description" rows={3} value={siteDescription} onChange={(e) => setSiteDescription(e.target.value)} placeholder="用于搜索引擎摘要" className="resize-none" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="keywords">SEO 关键字</Label>
            <Input id="keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="以逗号分隔，例如：React, Serverless, Cloudflare" />
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40">
          <h3 className="text-sm font-semibold">国际化与偏好</h3>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>语言设置</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh-CN">简体中文 (zh-CN)</SelectItem>
                <SelectItem value="en">English (en)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="page_size">每页文章数</Label>
            <Input id="page_size" type="number" min={1} max={100} value={pageSize} onChange={(e) => setPageSize(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>前台列表封面图</Label>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground select-none h-9">
              <input
                type="checkbox"
                id="show_cover_image"
                checked={showCoverImage}
                onChange={(e) => setShowCoverImage(e.target.checked)}
                className="rounded border-input text-primary focus:ring-primary/40 focus:ring-offset-0 cursor-pointer"
              />
              <label htmlFor="show_cover_image" className="cursor-pointer">在首页 / 分类 / 标签列表展示封面图</label>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>前台文章访问量</Label>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground select-none h-9">
              <input
                type="checkbox"
                id="show_views"
                checked={showViews}
                onChange={(e) => setShowViews(e.target.checked)}
                className="rounded border-input text-primary focus:ring-primary/40 focus:ring-offset-0 cursor-pointer"
              />
              <label htmlFor="show_views" className="cursor-pointer">在文章页面显示阅读次数</label>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40">
          <h3 className="text-sm font-semibold">分析与统计</h3>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="google_analytics_id">Google Analytics 4 测量 ID</Label>
            <Input
              id="google_analytics_id"
              value={googleAnalyticsId}
              onChange={(e) => setGoogleAnalyticsId(e.target.value)}
              placeholder="例如：G-XXXXXXXXXX"
            />
            <p className="text-[11px] text-muted-foreground">留空则不注入 GA4 脚本。配置后会在全站全局自动插入跟踪代码。</p>
          </div>
        </div>
      </div>

      {/* Social & Copyright */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40">
          <h3 className="text-sm font-semibold">社交与版权</h3>
        </div>
        <div className="p-5 flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="github_url">GitHub 地址</Label>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground select-none">
                  <input
                    type="checkbox"
                    id="show_github"
                    checked={showGithub}
                    onChange={(e) => setShowGithub(e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary/40 focus:ring-offset-0 cursor-pointer"
                  />
                  <label htmlFor="show_github" className="cursor-pointer">显示在顶栏</label>
                </div>
              </div>
              <Input
                id="github_url"
                type="url"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/..."
                disabled={!showGithub}
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="twitter_url">Twitter/X 地址</Label>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground select-none">
                  <input
                    type="checkbox"
                    id="show_twitter"
                    checked={showTwitter}
                    onChange={(e) => setShowTwitter(e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary/40 focus:ring-offset-0 cursor-pointer"
                  />
                  <label htmlFor="show_twitter" className="cursor-pointer">显示在顶栏</label>
                </div>
              </div>
              <Input
                id="twitter_url"
                type="url"
                value={twitterUrl}
                onChange={(e) => setTwitterUrl(e.target.value)}
                placeholder="https://x.com/..."
                disabled={!showTwitter}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="rss_url">RSS 订阅源</Label>
              <Input id="rss_url" value={rssUrl} onChange={(e) => setRssUrl(e.target.value)} placeholder="/feed.xml" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="icp_text">页脚版权 / 备案号声明</Label>
            <Input id="icp_text" value={icpText} onChange={(e) => setIcpText(e.target.value)} placeholder="例如：© 2026 技术小黑屋. 粤ICP备xxxxxx号." />
          </div>
        </div>
      </div>
    </form>
    </div>
  )
}
