import { create } from 'zustand';
import type { PublicUser } from '@atlas/shared';
import { clearToken, setToken } from '@/services/token';

/** F1.1 - 登录态管理（token + 用户信息） */
interface AuthState {
  user: PublicUser | null;
  ready: boolean;
  /** 登录成功：写入用户并持久化 token */
  signIn: (user: PublicUser, token: string) => void;
  /** 仅设置用户（如 bootstrap 用已有 token 拉取到的用户） */
  setUser: (user: PublicUser | null) => void;
  /** 登出：清用户与 token */
  signOut: () => void;
  setReady: (ready: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  ready: false,
  signIn: (user, token) => {
    setToken(token);
    set({ user });
  },
  setUser: (user) => set({ user }),
  signOut: () => {
    clearToken();
    set({ user: null });
  },
  setReady: (ready) => set({ ready }),
}));
