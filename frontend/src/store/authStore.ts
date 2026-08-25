import { create } from 'zustand';
import { User } from '../types';
import { authApi } from '../api/endpoints';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isLoading: true,
  setAuth: (user, token) => {
    localStorage.setItem('token', token);
    set({ user, token, isLoading: false });
  },
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, isLoading: false });
  },
  fetchMe: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ user: null, token: null, isLoading: false });
      return;
    }
    try {
      set({ isLoading: true });
      const user = await authApi.getMe();
      set({ user, token, isLoading: false });
    } catch {
      localStorage.removeItem('token');
      set({ user: null, token: null, isLoading: false });
    }
  },
}));
