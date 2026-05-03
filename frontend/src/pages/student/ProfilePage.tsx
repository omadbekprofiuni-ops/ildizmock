import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  const [target, setTarget] = useState<string>(user?.target_band ?? '')
  const [lang, setLang] = useState<string>(user?.language ?? 'uz')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    document.title = 'ILDIZmock — Profile'
    if (user) {
      setTarget(user.target_band ?? '')
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

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="container flex h-16 items-center gap-3">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Profile</h1>
        </div>
      </header>

      <main className="container max-w-xl py-10">
        <Card>
          <CardContent className="space-y-5 p-6">
            <div className="grid grid-cols-2 gap-4">
              <ReadOnly label="First name" value={user.first_name} />
              <ReadOnly label="Last name" value={user.last_name} />
            </div>
            <ReadOnly label="Username" value={user.username} />
            <ReadOnly label="Role" value={roleLabel(user.role) || user.role} />
            <p className="text-xs text-[var(--muted)]">
              Contact admin to change first name, last name or phone.
            </p>

            <hr />

            <div className="space-y-2">
              <Label>Target band</Label>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— not set —</option>
                {TARGETS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Language</Label>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>

            <Button onClick={onSave} disabled={saving} className="w-full">
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input value={value} readOnly className="bg-slate-50" />
    </div>
  )
}
