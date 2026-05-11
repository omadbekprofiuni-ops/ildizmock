import { useEffect, useRef } from 'react'

import { api } from '@/lib/api'
import { useAuth, type User } from '@/stores/auth'

/**
 * Google Identity Services (GIS) "Sign in with Google" tugmasi.
 *
 * Google'ning rasmiy `g_id_signin` div'ini render qiladi va callback'da
 * kelgan `credential` (ID token) bizning `/b2c/auth/google` endpoint'iga
 * jo'natadi. Muvaffaqiyatli bo'lganda `useAuth` state yangilanadi.
 *
 * Kerakli prerequisite'lar:
 *  - `index.html`'da `https://accounts.google.com/gsi/client` skript tegi
 *  - `VITE_GOOGLE_OAUTH_CLIENT_ID` env (Bo'sh bo'lsa tugma ko'rinmaydi)
 */

interface GoogleCredentialResponse { credential: string }

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    ux_mode?: 'popup' | 'redirect'
    auto_select?: boolean
  }) => void
  renderButton: (
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon'
      theme?: 'outline' | 'filled_blue' | 'filled_black'
      size?: 'large' | 'medium' | 'small'
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
      shape?: 'rectangular' | 'pill' | 'circle' | 'square'
      width?: number
      logo_alignment?: 'left' | 'center'
    },
  ) => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } }
  }
}

interface Props {
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  onSuccess?: () => void
  onError?: (message: string) => void
}

export function GoogleSignInButton({ text = 'continue_with', onSuccess, onError }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const clientId = (import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string | undefined)?.trim()

  useEffect(() => {
    if (!clientId || !containerRef.current) return

    let cancelled = false
    const init = () => {
      if (cancelled) return
      const gid = window.google?.accounts?.id
      if (!gid) {
        // Skript hali yuklanmagan bo'lsa, biroz kutamiz.
        window.setTimeout(init, 200)
        return
      }
      gid.initialize({
        client_id: clientId,
        callback: async (response: GoogleCredentialResponse) => {
          try {
            const { data } = await api.post<User>('/b2c/auth/google', {
              id_token: response.credential,
            })
            useAuth.setState({ user: data, initialised: true })
            onSuccess?.()
          } catch (err) {
            const e = err as { response?: { data?: { detail?: string } } }
            onError?.(e?.response?.data?.detail || "Google bilan kirishda xatolik")
          }
        },
      })
      if (containerRef.current) {
        gid.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text,
          shape: 'rectangular',
          width: 320,
          logo_alignment: 'center',
        })
      }
    }
    init()
    return () => { cancelled = true }
  }, [clientId, text, onSuccess, onError])

  if (!clientId) {
    // Konfiguratsiya yo'q — disabled, lekin haqiqiy Google tugmasi shaklida
    // ko'rinadi (asosiy CTA sifatida). Hover'da tooltip orqali tushuntiramiz.
    return (
      <button
        type="button"
        disabled
        title="VITE_GOOGLE_OAUTH_CLIENT_ID env sozlanmagan"
        className="flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-xl border-2 border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-400"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Google bilan davom etish
      </button>
    )
  }

  return <div ref={containerRef} className="flex justify-center" />
}
