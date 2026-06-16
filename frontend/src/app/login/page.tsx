'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { authApi } from '@/services/authApi';
import { ApiRequestError } from '@/services/errors';

/** F1.1 - 登录 / 注册页 */
export default function LoginPage() {
  const router = useRouter();
  const signIn = useAuthStore((s) => s.signIn);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isRegister = mode === 'register';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = isRegister
        ? await authApi.register({ username, password, nickname })
        : await authApi.login({ username, password });
      signIn(data.user, data.token);
      router.push('/world');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-atlas-border bg-atlas-surface/80 p-8 backdrop-blur">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-wide">
            <span className="text-atlas-primary">Atlas</span> 路过
          </h1>
          <p className="mt-1 text-sm text-atlas-muted">
            {isRegister ? '创建账号，开启旅程' : '登录，继续你的旅程'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            label="用户名"
            value={username}
            onChange={setUsername}
            placeholder="3-32 个字符"
            autoComplete="username"
          />
          {isRegister && (
            <Field
              label="昵称（可选）"
              value={nickname}
              onChange={setNickname}
              placeholder="展示名称"
              autoComplete="nickname"
            />
          )}
          <Field
            label="密码"
            value={password}
            onChange={setPassword}
            placeholder="至少 6 位"
            type="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-atlas-primary py-2.5 font-medium text-black transition-opacity disabled:opacity-50"
          >
            {loading ? '处理中…' : isRegister ? '注册并登录' : '登录'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-atlas-muted">
          {isRegister ? '已有账号？' : '还没有账号？'}
          <button
            onClick={() => {
              setMode(isRegister ? 'login' : 'register');
              setError('');
            }}
            className="ml-1 text-atlas-primary hover:underline"
          >
            {isRegister ? '去登录' : '去注册'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-atlas-muted">{props.label}</span>
      <input
        className="w-full rounded-lg border border-atlas-border bg-atlas-bg px-3 py-2 outline-none focus:border-atlas-primary"
        value={props.value}
        type={props.type ?? 'text'}
        placeholder={props.placeholder}
        autoComplete={props.autoComplete}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  );
}
