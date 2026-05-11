import { create } from 'zustand'

import { api } from '@/lib/api'

export type User = {
  id: number
  username: string
  phone: string | null
  first_name: string
  last_name: string
  role: 'student' | 'teacher' | 'org_admin' | 'superadmin'
    | 'b2c_user'  // ETAP 14 — individual (B2C) user
    | 'admin' | 'super_admin'  // legacy
  target_band: string | null
  language: 'uz' | 'ru' | 'en'
  must_change_password: boolean
  created_at: string
  org_slug: string | null
  // ETAP 14 — B2C profile fields (faqat role='b2c_user' bo'lganda mavjud).
  email?: string
  phone_number?: string
  preferred_language?: 'uz' | 'ru' | 'en'
  target_exam?: string
  has_completed_onboarding?: boolean
}

export function roleLabel(role: User['role'] | null | undefined): string {
  switch (role) {
    case 'superadmin':
    case 'super_admin':
      return 'Super Admin'
    case 'org_admin':
    case 'admin':
      return 'Center Admin'
    case 'teacher':
      return 'Teacher'
    case 'student':
      return 'Student'
    default:
      return ''
  }
}

export type B2CSignupInput = {
  first_name: string
  last_name: string
  email: string
  password: string
  password_confirm: string
}

export type B2CProfileUpdate = Partial<{
  first_name: string
  last_name: string
  phone_number: string
  preferred_language: 'uz' | 'ru' | 'en'
  target_exam: string
  has_completed_onboarding: boolean
}>

type AuthState = {
  user: User | null
  loading: boolean
  initialised: boolean
  login: (username: string, password: string) => Promise<void>
  // ETAP 14 — B2C (email + parol)
  loginB2C: (email: string, password: string) => Promise<void>
  signupB2C: (input: B2CSignupInput) => Promise<void>
  logout: () => Promise<void>
  fetchMe: () => Promise<User | null>
  updateProfile: (patch: Partial<Pick<User, 'first_name' | 'last_name' | 'target_band' | 'language'>>) => Promise<User>
  updateB2CProfile: (patch: B2CProfileUpdate) => Promise<User>
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

  loginB2C: async (email, password) => {
    set({ loading: true })
    try {
      const { data } = await api.post<User>('/b2c/auth/login', { email, password })
      set({ user: data, initialised: true })
    } finally {
      set({ loading: false })
    }
  },

  signupB2C: async (input) => {
    set({ loading: true })
    try {
      const { data } = await api.post<User>('/b2c/auth/signup', input)
      set({ user: data, initialised: true })
    } finally {
      set({ loading: false })
    }
  },

  logout: async () => {
    try {
      // B2C logout endpoint cookie tozalashda farq qilmaydi, lekin B2C
      // foydalanuvchi uchun semantik to'g'ri endpointni chaqiramiz.
      const role = (useAuth.getState().user?.role) ?? null
      const url = role === 'b2c_user' ? '/b2c/auth/logout' : '/auth/logout'
      await api.post(url)
    } catch {
      /* ignore */
    }
    set({ user: null })
  },

  fetchMe: async () => {
    try {
      // `/auth/me` ETAP 14'dan keyin role'ga qarab B2B yoki B2C ma'lumotlarini
      // qaytaradi, shuning uchun bitta endpoint yetarli.
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

  updateB2CProfile: async (patch) => {
    const { data } = await api.patch<User>('/b2c/profile', patch)
    set({ user: data })
    return data
  },
}))
