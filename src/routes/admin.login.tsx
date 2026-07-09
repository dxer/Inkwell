import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { verifyAdminCredentials, signSession, getAuthCredentials } from '../lib/auth'
import { checkAuthFn } from '../lib/functions'
import { PenLine, AlertCircle, Loader2 } from 'lucide-react'
import React, { useState } from 'react'

export const loginFn = createServerFn({ method: 'POST' })
  .validator((data: Record<string, string>) => data)
  .handler(async ({ data }) => {
    const { username, password } = data;

    if (!(await verifyAdminCredentials(username, password))) {
      throw new Error("用户名或密码错误");
    }

    const { secret } = await getAuthCredentials();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    const token = await signSession({ username, expiresAt }, secret);
    
    const { setCookie } = await import('@tanstack/react-start/server');
    setCookie('inkwell_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
      secure: process.env.NODE_ENV !== 'development'
    });
    
    return { success: true };
  });

export const Route = createFileRoute('/admin/login')({
  loader: async () => {
    const auth = await checkAuthFn();
    if (auth.authenticated) {
      throw redirect({ to: '/admin' });
    }
    return { loggedIn: false };
  },
  component: AdminLogin
})

function AdminLogin() {
  const { loggedIn } = Route.useLoaderData();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect immediately if loader reports logged in
  React.useEffect(() => {
    if (loggedIn) {
      navigate({ to: "/admin" });
    }
  }, [loggedIn, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("请输入用户名和密码");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await loginFn({ data: { username, password } });
      navigate({ to: "/admin" });
    } catch (err: any) {
      setError(err.message || "登录失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 grid place-items-center p-4 bg-background">
      <div className="w-full max-w-sm p-8 rounded-xl border border-border bg-card shadow-sm">
        <div className="text-center mb-8">
          <div className="inline-grid place-items-center w-12 h-12 rounded-xl bg-foreground text-background mb-4">
            <PenLine size={22} strokeWidth={2.25} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">管理后台</h1>
          <p className="text-sm text-muted-foreground mt-1">请输入管理员凭证以继续</p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-md border border-destructive/30 bg-destructive/5 text-xs text-destructive flex items-start gap-2">
            <AlertCircle size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="username">
              用户名
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
              placeholder="admin"
              disabled={loading}
              autoComplete="username"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="password">
              密码
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
              placeholder="••••••••"
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-brand hover:bg-brand/90 text-brand-foreground font-semibold rounded-md text-sm transition-colors mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                登录中…
              </>
            ) : (
              "登录"
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
