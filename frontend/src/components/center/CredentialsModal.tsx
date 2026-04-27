import { useState } from 'react'

interface Credentials {
  username: string
  password?: string
  new_password?: string
  login_url: string
}

interface Props {
  credentials: Credentials
  onClose: () => void
}

export function CredentialsModal({ credentials, onClose }: Props) {
  const [copied, setCopied] = useState('')
  const password = credentials.password ?? credentials.new_password ?? ''
  const fullUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${credentials.login_url}`
      : credentials.login_url

  const copy = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(''), 1500)
  }

  const copyAll = () => {
    const text = `Login: ${credentials.username}\nParol: ${password}\nURL: ${fullUrl}`
    copy(text, 'all')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">
            ✓
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Hisob ma'lumotlari</h2>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm">
          <Row
            label="Login"
            value={credentials.username}
            onCopy={() => copy(credentials.username, 'login')}
            copied={copied === 'login'}
          />
          <Row
            label="Parol"
            value={password}
            onCopy={() => copy(password, 'pass')}
            copied={copied === 'pass'}
          />
          <Row
            label="URL"
            value={fullUrl}
            onCopy={() => copy(fullUrl, 'url')}
            copied={copied === 'url'}
          />
        </div>

        <div className="mt-4 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
          ⚠️ <strong>Diqqat:</strong> Parol bu yerda faqat bir marta
          ko'rsatiladi. Eslab qolish yoki nusxa olish uchun yuqoridagi tugmalardan
          foydalaning.
        </div>

        <button
          type="button"
          onClick={copyAll}
          className="mt-4 w-full rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          {copied === 'all' ? '✓ Nusxalandi!' : '📋 Hammasini nusxalash'}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Yopish
        </button>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  onCopy,
  copied,
}: {
  label: string
  value: string
  onCopy: () => void
  copied: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
        <div className="truncate text-slate-900">{value}</div>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="shrink-0 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs hover:bg-slate-100"
      >
        {copied ? '✓ Nusxalandi' : 'Nusxalash'}
      </button>
    </div>
  )
}
