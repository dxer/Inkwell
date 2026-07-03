# 个人博客前端优化设计

**日期：** 2026-07-03
**项目：** yblog（个人博客系统）
**范围：** 前端公开页面（不含后台 `/admin/*`）
**性质：** 定向演进（targeted evolution），保留现有视觉身份与内容结构

---

## 1. 目标与范围

### 目标
把现有的暖色编辑风个人博客，打磨成一个更克制、更适配多端、带细微动效的阅读体验，**不改变它的视觉身份和内容结构**。

### 在范围内
- 抽出共享 `SiteLayout`（含 header + 主题切换 + 移动端菜单 + footer），4 个公开页面（首页 / 文章详情 / 标签 / 分类）统一使用。
- 接入深色模式（自动跟随系统 + 手动切换），复用已存在的 `next-themes`。
- 优化字号节奏、间距韵律、响应式表现，覆盖四个公开页面。
- 用纯 CSS + 少量原生 JS 实现微动效（不引入动效库）：列表入场、hover 反馈、主题平滑过渡、链接交互反馈。
- 多端适配：可折叠的移动端导航、流式字号、适合触摸的点击区域。

### 明确不在范围内
- 后台管理控制台（`/admin/*`）保持不动。
- 数据模型、路由 / URL、内容、BlockNote 编辑器。
- 新增页面（如 About 关于页）。
- 引入动效库。

### 设计三档（来自 design-taste 技能，按「简约、克制、微动效」+ 编辑博客校准）
- `DESIGN_VARIANCE: 6`（克制的非对称，主体仍是居中阅读栏）
- `MOTION_INTENSITY: 4`（细微的 CSS 流动动效，尊重 reduced-motion）
- `VISUAL_DENSITY: 3`（疏朗，留白充足）

### 三项已确认决策
1. **视觉方向：** 保留现有暖色编辑风（奶白纸张 `#F4F3EE` + 赤陶 `#C15F3C` + Libre Bodoni 衬线标题 / Public Sans 无衬线正文）。
2. **深色模式：** 自动跟随系统 + 手动切换（复用 `next-themes`）。
3. **动效实现：** 纯 CSS + 少量原生 JS，不引入动效库。

---

## 2. 布局与组件结构

抽出共享布局，并把客户端交互隔离成小岛，保持 SSR 不受影响。

### 新增 / 改动的文件

```
src/
  components/
    site/
      site-layout.tsx      # 服务端组件：header 骨架 + children + footer
      site-header.tsx      # 客户端小岛：主题切换 + 移动端菜单（'use client'）
      theme-toggle.tsx     # 客户端小岛：太阳/月亮切换按钮
      mobile-nav.tsx       # 客户端小岛：<768px 折叠导航（下拉抽屉）
  routes/
    index.tsx              # 改：用 <SiteLayout> 包裹，删掉自带的 header/footer
    posts.$slug.tsx        # 改：同上
    tag.$slug.tsx          # 改：同上
    category.$slug.tsx     # 改：同上
  styles.css               # 改：补 .dark 深色 token、流式字号、微动效 keyframes
  router.tsx / __root.tsx  # 改：挂载 <ThemeProvider>（next-themes）
```

> 说明：TanStack Start 的文件路由里，客户端组件用 `'use client'` 指令即可。`SiteLayout` 本身保持服务端渲染（只输出静态骨架），交互（主题切换、菜单展开）隔离在 header 子组件里，避免污染 SSR。

### SiteLayout 职责（单一职责）
- 渲染 `<SiteHeader>`（站点标题、导航、主题切换、移动端菜单触发）。
- 渲染 `<main>` 容器（统一 `max-w` + `px` 内边距，子页面只填内容）。
- 渲染 `<footer>`（ICP / 版权，统一一处）。
- 接收 `children` 作为页面主体。

### 为什么是组件而不是路由布局（`_blog.tsx`）
组件方式不动路由树、不重新生成 `routeTree.gen.ts`，header/footer 只写一份，移动端菜单和主题切换加一次即全站生效。每个公开路由只做一件事：`return <SiteLayout>{页面内容}</SiteLayout>`。

### Layout 接口
```ts
SiteLayout({
  children: React.ReactNode,
  // 可选：宽度档位。文章详情/首页用 'reading'(max-w-3xl)，归档用 'wide'(max-w-4xl)
  width?: 'reading' | 'wide'   // 默认 'reading'
})
```

### 移动端适配策略
- `≥768px`：header 一行铺开（站点标题 + 导航 + 社交链接 + 主题切换）。
- `<768px`：社交链接和分类导航收进汉堡菜单，header 只留 [标题] + [菜单按钮] + [主题切换]。菜单点击展开为下拉抽屉，纯 CSS transition + `aria-expanded` 控制。

---

## 3. 配色与深色模式

保留现有亮色身份，新增一整套深色 token。强调色（赤陶 Crail）在两种模式下都保持品牌识别度，只微调明度/饱和度以在深底上保证 AA 对比度。

### 亮色（基本沿用现有，仅微调）
```
background       #F4F3EE  Pampas 暖奶白纸张（不变）
foreground       #1A1A1A  墨黑（不变）
card             #FFFFFF  纯白（不变）
primary / brand  #C15F3C  Crail 赤陶（不变）
border           #E3E0D8  暖色发丝线（不变）
muted-foreground #6B6760  暖石灰（不变）
```

### 深色（新增，同色系暗化，非冷灰翻转）
```
background       #1B1916  暖近黑（带一丝暖，非纯黑、非冷 zinc）
foreground       #EDEAE3  暖米白（非纯白，保留纸张感）
card             #262320  比背景略亮的暖面
primary / brand  #D8764F  Crail 提亮一档，在暗底保证 AA 对比度
border           #3A352F  暖色暗发丝线
muted-foreground #A8A29A  暖浅灰，暗底 AA 可读
```

### 要点
- 不用纯黑 `#000` / 纯白 `#fff`，全用带暖色调的近黑 / 近白，保留「纸张」质感，避免冷感断裂。
- 强调色锁定一致：亮色 `#C15F3C`，深色 `#D8764F`，同一赤陶色相，只是提亮以保对比度。
- shape 一致性锁：沿用现有 `--radius: 0.5rem`，不引入新的圆角档位。

### 实现方式
- **Token 策略：** 继续用 CSS 变量（现有 HSL triplet 写法），在 `@layer base` 里新增 `.dark { ... }` 块覆盖同一组变量。Tailwind v4 的 `dark:` 变体走 class 策略。
- **挂载方式：** 用 `next-themes` 的 `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>`，它会给 `<html>` 加 `.dark` class。在 `__root.tsx`（或 `router.tsx`）挂载 provider，并在 `<head>` 注入防闪烁（FOUC）的内联脚本（next-themes 内置支持，避免深色模式首屏白闪）。
- **手动切换：** header 放低调的太阳/月亮图标按钮（lucide `Sun` / `Moon`），两态切换（light / dark）。`defaultTheme="system"`，首次访问跟随系统；用户点击后，next-themes 把偏好持久化到 localStorage。

---

## 4. 字体与字号节奏

保留现有字体配对：标题 `Libre Bodoni`（衬线 display），正文/UI `Public Sans`（无衬线）。不换。

### 4.1 字体加载优化（顺带性能）
- 现在 `@import url(google fonts)` 阻塞渲染、首屏字体闪。
- 改为异步：`<link rel="preconnect">` + `<link rel="stylesheet" media="print" onload="...">` 异步化，或保留 `@import` 但加 `media` 技巧。
- 优先级：避免 LCP 退化。`font-display: swap`（已有）。

### 4.2 流式字号（clamp）
关键标题用 `clamp()` 流式缩放，移动端到大屏丝滑过渡：
```
文章标题（详情页 H1）    clamp(1.875rem, 4vw + 1rem, 3rem)
首页列表标题（H2）       clamp(1.375rem, 1.5vw + 1rem, 1.875rem)
归档页 H1               clamp(1.75rem, 2.5vw + 1rem, 2.5rem)
正文                     16px（从 15px 提到 16px，提升可读性）
```
在 `styles.css` 定义语义化 CSS 变量，组件引用变量名。

### 4.3 阅读栏宽度
- 首页 / 归档：`max-w-3xl`（~768px）。
- 文章详情：`.prose-reader` 已是 `max-width: 72ch`，正文行高 1.75，保留。
- 段落正文统一 `max-w-[65ch]`。

### 4.4 排版细节
- 标题 `letter-spacing: -0.01em`（已有）。
- 数字（日期、分页）`tabular-nums`（已有）。
- 行高：正文 1.75（已有），列表标题 `leading-tight`，归档标题 `leading-[1.15]`。
- 中英文间距自动处理本次不做，避免过度。

---

## 5. 响应式与移动端适配

「适配多种客户端」的核心。每个断点行为明确声明，不留「Tailwind 自动处理」的含糊。

### 断点（Tailwind v4 默认）
`sm 640` / `md 768` / `lg 1024` / `xl 1280`

### 容器与内边距
- 统一内容栏：`max-w-3xl`（列表/详情）、`max-w-4xl`（归档）。
- 横向内边距流式：`px-5 sm:px-6 lg:px-8`。
- **视口稳定：** 「占满高度」用 `min-h-[100dvh]`，不用 `h-screen`（避免 iOS Safari 地址栏跳动）。

### Header 行为
| 断点 | 表现 |
|---|---|
| `≥768px (md+)` | 一行铺开：[站点标题] [分类/标签导航] [社交链接] [主题切换]。高度 ≤ 64px。 |
| `<768px` | 折叠为：[站点标题] [菜单按钮] [主题切换]。社交链接 + 导航收进抽屉。 |

- 移动端菜单：点击汉堡按钮展开为下拉面板（从 header 下方滑入），含分类导航 + 社交链接。`aria-expanded` + `aria-controls`，点击外部或 ESC 收起，键盘可达。
- 抽屉用 CSS `transition`（transform + opacity），不用动效库。

### 列表（首页 / 归档）
- 首页：保持单列 divided list（移动端天然适配，已是最优形态）。
- 归档页卡片：`md+` 横向卡（图左文右），`<md` 自动堆叠为纵向卡（图上文下）——现有行为已正确，复用共享样式。
- 封面图：移动端 `aspect-[16/9]`，图片预留空间，**CLS < 0.1**。

### 文章详情
- 标题、正文、图片均在阅读栏内，移动端单列。
- 封面图：`aspect-[16/9] md:aspect-[21/9]`（移动端不做过窄扁条）。
- 代码块移动端横向滚动，字号不小于 13px。

### 触摸目标
- 所有可点击元素（链接、按钮、分页）最小命中区 `min-h-[44px]` / `min-w-[44px]`（iOS HIG 推荐），尤其分页按钮和主题切换。

### 表格 / 代码（prose 内）
- 移动端 `<pre>` 横向滚动，不撑破阅读栏。

---

## 6. 微动效

「微动效」的关键是克制、有动机。每段动效都要能一句话说清它传达了什么（层级 / 叙事 / 反馈 / 状态变化），否则砍掉。全部用纯 CSS + 少量原生 JS，不引入动效库。全部尊重 `prefers-reduced-motion`。

### 动效清单

**1. 列表入场（首页 / 归档）— 叙事**
- 文章项进入视口时，`opacity 0→1` + `translateY(8px→0)`，`cubic-bezier(0.22,1,0.36,1)` 0.4s。
- 用 `IntersectionObserver` 给进入视口的项加 `.is-visible` class（原生 JS，一个共享 hook）。
- 错落：CSS `--index` 变量 + `transition-delay: calc(var(--index) * 50ms)`，前 4-5 项轻微错开，不做无限瀑布。
- 复用现有 `.animate-rise` keyframe，改成 IO 驱动。
- *动机：引导视线自上而下扫读，强化「这是一篇篇文章」的层级。*

**2. 链接 / 标题 hover 反馈 — 反馈**
- 文章标题 hover：颜色过渡到赤陶（已有 `transition-colors`，保留）。
- 封面图 hover：`scale(1.01)` 慢放（已有 `duration-500`，保留）。
- 标签 `#tag` hover：颜色过渡（已有）。
- *动机：明确告诉用户「这里可点」。*

**3. 主题切换平滑过渡 — 状态变化**
- 给全局容器加 `transition: background-color 0.3s, color 0.3s`（只过渡颜色，不过渡布局）。
- 切换深浅色时整页背景与文字平滑过渡 0.3s，不闪。
- 主题切换按钮：太阳/月亮图标用 `rotate` + `opacity` 交叉淡入（0.25s）。
- *动机：让主题切换不突兀，是「状态在变化」。*

**4. 移动端菜单展开 — 反馈**
- 抽屉从 header 下方 `translateY(-8px) + opacity 0` → `0 + 1`，0.25s ease-out。
- *动机：呼应「这是你点击触发的」。*

**5. 按钮按下触感 — 反馈**
- 主题切换 / 分页按钮 `:active` 时 `translate-y-[1px]` 或 `scale-[0.98]`。
- *动机：物理按压感。*

### 明确不做（克制）
- 不做滚动视差、滚动劫持、sticky-stack。
- 不做无限循环 marquee / shimmer / 打字机。
- 不做 magnetic button / 3D tilt。
- 首屏不做大动效（首屏要稳、要快，LCP < 2.5s）。
- 不用 `window.addEventListener('scroll')`（用 IntersectionObserver + CSS scroll-driven）。

### 性能与无障碍
- 只动 `transform` 和 `opacity`（+ 颜色 transition），不动 `width/height/top/left`。
- `@media (prefers-reduced-motion: reduce)` 下，所有入场/hover 缩放降级为瞬时或仅保留颜色变化。
- IntersectionObserver 在组件卸载时 `disconnect()`。

---

## 技术约束与确认事项

- **栈：** TanStack Start (SSR) + Tailwind v4 + shadcn/ui + Drizzle/D1 + R2。不动栈。
- **不动：** 数据模型、路由 / URL、BlockNote 编辑器、后台管理 UI。
- **动效库：** 不引入。纯 CSS + 原生 JS（IntersectionObserver、`prefers-reduced-motion`）。
- **图标：** 继续用项目已有的 `lucide-react`（`Sun` / `Moon` 等），不引入新图标库。
- **深色模式库：** 复用已存在的 `next-themes`，无需新增依赖。

## 完成标准（Pre-Flight）

- 4 个公开页面统一使用 `SiteLayout`，header/footer 只剩一份。
- 深色模式可用：自动跟随系统 + header 手动切换，无首屏白闪（FOUC）。
- 亮 / 深两套 token AA 对比度通过（正文 ≥ 4.5:1）。
- 流式字号（clamp）在移动端到大屏丝滑过渡。
- 移动端 header 折叠为汉堡菜单，触摸目标 ≥ 44px。
- 列表入场动效生效，且 `prefers-reduced-motion: reduce` 下降级。
- 零 em-dash（`—` / `–`）出现在可见文本。
- 不使用 `h-screen`，统一 `min-h-[100dvh]`。
- 不使用 `window.addEventListener('scroll')`。
- 改动不破坏 SSR（客户端交互隔离在 `'use client'` 小岛）。
- 后台 `/admin/*` 不受影响。
