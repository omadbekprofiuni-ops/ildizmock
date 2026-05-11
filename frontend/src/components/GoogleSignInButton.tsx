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
    return (
      <div className="text-center text-[11px] uppercase tracking-wider text-slate-400">
        Google bilan kirish · Tez orada
      </div>
    )
  }

  return <div ref={containerRef} className="flex justify-center" />
}
