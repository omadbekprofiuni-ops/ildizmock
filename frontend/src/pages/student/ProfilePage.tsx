import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, User } from 'lucide-react'

import { toast } from '@/components/ui/toaster'
import { roleLabel, useAuth } from '@/stores/auth'

const TARGETS = ['5.0', '5.5', '6.0', '6.5', '7.0', '7.5', '8.0', '8.5', '9.0']
const LANGUAGES = [
  { value: 'uz', label: 'O‘zbek' },
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
]

export default function ProfilePage() {
  const user = useAuth((s) => s.user)
  const updateProfile = useAuth((s) => s.updateProfile)
  const [target, setTarget] = useState<string>(
    user?.target_band != null ? String(user.target_band) : '',
  )
  const [lang, setLang] = useState<string>(user?.language ?? 'uz')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    document.title = 'ILDIZmock — Profile'
    if (user) {
      setTarget(user.target_band != null ? String(user.target_band) : '')
      setLang(user.language ?? 'uz')
    }
  }, [user])

  if (!user) return null

  const onSave = async () => {
    setSaving(true)
    try {
      await updateProfile({
        target_band: target || null,
        language: lang as 'uz' | 'ru' | 'en',
      } as never)
      toast.success('Profile saved')
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const initials = `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase() || 'U'

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-4 px-8">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-brand-600"
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900">Profile</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-8 py-10">
        {/* Profile header card */}
        <div
          className="mb-5 flex items-center gap-5 rounded-[20px] border border-slate-100 bg-white p-7"
          style={{ boxShadow: 'var(--shadow-sm)' }}
        >
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-extrabold tracking-tight text-white"
            style={{ background: 'var(--gradient-brand)' }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-extrabold text-slate-900">
              {user.first_name} {user.last_name}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span>@{user.username}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-bold text-brand-700">
                <User className="h-3 w-3" />
                {roleLabel(user.role) || user.role}
              </span>
            </div>
          </div>
        </div>

        {/* Read-only fields */}
        <div
          className="mb-5 rounded-[20px] border border-slate-100 bg-white p-7"
          style={{ boxShadow: 'var(--shadow-sm)' }}
        >
          <h3 className="mb-4 text-base font-extrabold text-slate-900">Account info</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ReadOnlyField label="First name" value={user.first_name ?? ''} />
            <ReadOnlyField label="Last name" value={user.last_name ?? ''} />
            <div className="sm:col-span-2">
              <ReadOnlyField label="Username" value={user.username ?? ''} />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Contact admin to change first name, last name or phone.
          </p>
        </div>

        {/* Editable preferences */}
        <div
          className="rounded-[20px] border border-slate-100 bg-white p-7"
          style={{ boxShadow: 'var(--shadow-sm)' }}
        >
          <h3 className="mb-4 text-base font-extrabold text-slate-900">Preferences</h3>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-[13px] font-bold text-slate-700">
                Target band
              </label>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-900 transition-all focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              >
                <option value="">— not set —</option>
                {TARGETS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-[13px] font-bold text-slate-700">
                Language
              </label>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-900 transition-all focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="mt-2 w-full rounded-xl bg-brand-600 px-6 py-3.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="mb-2 block text-[13px] font-bold text-slate-700">{label}</label>
      <input
        value={value}
        readOnly
        className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-[15px] text-slate-700"
      />
    </div>
  )
}
