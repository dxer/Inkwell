import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { checkAuthFn } from '../lib/functions'
import {
  LayoutDashboard,
  FileText,
  FolderTree,
  Settings,
  LogOut,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { useState, useEffect } from 'react'

export const logoutFn = createServerFn({ method: 'POST' })
  .handler(async () => {
    const { deleteCookie } = await import('@tanstack/react-start/server');
    deleteCookie('inkwell_session');
    return { success: true };
  });

export const Route = createFileRoute('/admin')({
  loader: async ({ location }) => {
    // The login route is a child of /admin, so its parent (this) loader runs
    // on the way to /admin/login too. We must NOT redirect to /admin/login
    // when we are already heading there, otherwise we get a redirect loop
    // (ERR_TOO_MANY_REDIRECTS). Allow the login page through unauthenticated.
    if (location.pathname === '/admin/login') {
      return { username: null };
    }

    const auth = await checkAuthFn();
    if (!auth.authenticated) {
      throw redirect({ to: '/admin/login' });
    }
    return { username: auth.username };
  },
  component: AdminLayout
})

const NAV_ITEMS = [
  { to: '/admin' as const, label: '工作台首页', icon: LayoutDashboard, exact: true },
  { to: '/admin/posts' as const, label: '文章管理', icon: FileText },
  { to: '/admin/categories' as const, label: '分类管理', icon: FolderTree },
  { to: '/admin/settings' as const, label: '站点设置', icon: Settings },
]

function AdminLayout() {
  const navigate = useNavigate();
  const { username } = Route.useLoaderData();
  const [collapsed, setCollapsed] = useState(false);

  // Restore collapsed setting on mount
  useEffect(() => {
    const stored = localStorage.getItem("inkwell_sidebar_collapsed");
    if (stored === "true") {
      setCollapsed(true);
    }
  }, []);

  const toggleCollapse = () => {
    const nextVal = !collapsed;
    setCollapsed(nextVal);
    localStorage.setItem("inkwell_sidebar_collapsed", String(nextVal));
  };

  // The login page is a child of this layout route, but it must NOT show the
  // admin sidebar (the user isn't authenticated yet). Render only the outlet
  // when we're on /admin/login.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname === '/admin/login') {
    return <Outlet />;
  }

  const handleLogout = async () => {
    try {
      await logoutFn();
      navigate({ to: "/admin/login" });
    } catch (e) {
      console.error("Logout failed", e);
    }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row md:h-screen md:max-h-screen md:overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside className={`w-full ${collapsed ? 'md:w-[68px]' : 'md:w-[250px]'} shrink-0 bg-background border-b md:border-b-0 md:border-r border-border/60 flex flex-col justify-between transition-all duration-300 ease-out md:h-screen`}>
        <div className="flex flex-col">
          {/* Brand header */}
          <div className={`px-5 pt-6 pb-4 ${collapsed ? 'md:px-3 md:pt-5' : ''}`}>
            <Link to="/admin" className={`flex items-center ${collapsed ? 'md:justify-center' : 'gap-2.5'} no-underline`}>
              <span className="grid place-items-center w-9 h-9 shrink-0">
                <svg width="36" height="36" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="20" y="24" width="24" height="32" rx="6" fill="#cc785c"/>
                  <rect x="26" y="16" width="12" height="10" fill="#cc785c"/>
                  <ellipse cx="32" cy="24" rx="8" ry="3" fill="#a64027"/>
                  <path d="M32 30C34 30 36 32 36 34C36 37.5 33.5 39 32 39C30.5 39 28 37.5 28 34C28 32 30 30 32 30Z" fill="white" opacity="0.9"/>
                  <rect x="22" y="50" width="20" height="4" rx="2" fill="#a64027" opacity="0.6"/>
                </svg>
              </span>
              {!collapsed && <span className="text-base font-bold tracking-tight truncate">Inkwell</span>}
            </Link>
            {!collapsed ? (
              <div className="flex items-center gap-2 mt-3.5 px-0.5">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
                  <Sparkles size={11} className="text-primary" />
                </div>
                <span className="text-[11px] text-muted-foreground font-medium truncate">
                  {username || '管理员'}
                </span>
              </div>
            ) : (
              <p className="hidden md:block text-[9px] text-muted-foreground mt-3 font-semibold uppercase tracking-wider text-center truncate w-full">
                {username?.slice(0, 3) || 'ADM'}
              </p>
            )}
          </div>

          {/* Separator */}
          <div className={`mx-4 ${collapsed ? 'md:mx-2' : ''} border-t border-border/40 mb-2`} />

          {/* Navigation */}
          <nav className={`flex flex-col gap-0.5 px-3 ${collapsed ? 'md:px-2' : ''}`}>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.exact }}
                title={collapsed ? item.label : undefined}
                className="no-underline block"
              >
                {({ isActive }) => (
                  <div
                    className={`relative px-3 py-2 rounded-lg text-[13px] transition-all duration-200 flex items-center ${
                      isActive
                        ? 'bg-primary/8 text-foreground font-semibold'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                    } ${collapsed ? 'md:justify-center md:px-0 md:w-10 md:h-10 mx-auto' : 'gap-2.5'}`}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-primary rounded-r-full" />
                    )}
                    <item.icon
                      size={16}
                      strokeWidth={isActive ? 2.25 : 1.75}
                      className={`shrink-0 transition-all duration-200 ${isActive ? 'text-primary' : ''}`}
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </div>
                )}
              </Link>
            ))}
          </nav>
        </div>

        {/* Bottom actions */}
        <div className={`flex flex-col gap-0.5 px-3 pb-4 pt-3 mt-auto border-t border-border/40 mx-3 ${collapsed ? 'md:px-1 md:mx-1' : ''}`}>
          <Link
            to="/"
            className={`px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-lg transition-colors flex items-center no-underline ${collapsed ? 'md:justify-center md:px-0 md:w-10 md:h-10 mx-auto' : 'gap-2.5'}`}
            title={collapsed ? "预览前台网站" : undefined}
          >
            <ExternalLink size={15} strokeWidth={1.75} className="shrink-0" />
            {!collapsed && <span className="truncate">预览前台</span>}
          </Link>
          <button
            onClick={handleLogout}
            className={`px-3 py-2 text-[13px] text-muted-foreground hover:text-destructive hover:bg-destructive/8 rounded-lg text-left transition-colors flex items-center ${collapsed ? 'md:justify-center md:px-0 md:w-10 md:h-10 mx-auto' : 'gap-2.5'} cursor-pointer`}
            title={collapsed ? "退出登录" : undefined}
          >
            <LogOut size={15} strokeWidth={1.75} className="shrink-0" />
            {!collapsed && <span className="truncate">退出登录</span>}
          </button>
          
          {/* Toggle Sidebar Collapse Button (Desktop Only) */}
          <button
            type="button"
            onClick={toggleCollapse}
            className="hidden md:flex px-3 py-1.5 text-xs text-muted-foreground/70 hover:text-foreground hover:bg-secondary/50 rounded-lg transition-colors items-center justify-center cursor-pointer mt-1.5 shrink-0"
            title={collapsed ? "展开菜单" : "折叠菜单"}
          >
            {collapsed ? <ChevronRight size={14} /> : <div className="flex items-center gap-1.5"><ChevronLeft size={14} /><span>收起</span></div>}
          </button>
        </div>
      </aside>

      {/* Main panel content */}
      <main className="relative flex-1 flex flex-col min-h-0 overflow-hidden bg-content">
        <div className="admin-grid" />
        <div className="admin-vignette" />
        <div className="relative z-10 flex-1 flex flex-col min-h-0">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
