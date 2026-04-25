import { create } from 'zustand'

import { api } from '@/lib/api'

export type User = {
  id: number
  username: string
  phone: string | null
  first_name: string
  last_name: string
  role: 'student' | 'teacher' | 'org_admin' | 'superadmin'
    | 'admin' | 'super_admin'  // legacy
  target_band: string | null
  language: 'uz' | 'ru' | 'en'
  must_change_password: boolean
  created_at: string
}

type AuthState = {
  user: User | null
  loading: boolean
  initialised: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  fetchMe: () => Promise<User | null>
  updateProfile: (patch: Partial<Pick<User, 'first_name' | 'last_name' | 'target_band' | 'language'>>) => Promise<User>
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialised: false,

  login: async (username, password) => {
    set({ loading: true })
    try {
      const { data } = await api.post<User>('/auth/login', { username, password })
      set({ user: data, initialised: true })
    } finally {
      set({ loading: false })
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      /* ignore */
    }
    set({ user: null })
  },

  fetchMe: async () => {
    try {
      const { data } = await api.get<User>('/auth/me')
      set({ user: data, initialised: true })
      return data
    } catch {
      set({ user: null, initialised: true })
      return null
    }
  },

  updateProfile: async (patch) => {
    const { data } = await api.patch<User>('/auth/me', patch)
    set({ user: data })
    return data
  },
}))
