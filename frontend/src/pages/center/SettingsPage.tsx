import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

type SettingsResponse = {
  name: string
  slug: string
  primary_color: string
  logo: string | null
  address: string
  contact_phone: string
  contact_email: string
  plan_status: string
  plan_expires_at: string | null
}

export default function CenterSettingsPage() {
  const { slug } = useParams<{ slug: string }>()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement | null>(null)

  const settings = useQuery({
    queryKey: ['center-settings', slug],
    queryFn: async () =>
      (await api.get<SettingsResponse>(`/center/${slug}/settings/`)).data,
    enabled: !!slug,
  })

  const [name, setName] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#DC2626')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [removeLogo, setRemoveLogo] = useState(false)

  useEffect(() => {
    if (!settings.data) return
    setName(settings.data.name)
    setPrimaryColor(settings.data.primary_color || '#DC2626')
    setAddress(settings.data.address || '')
    setPhone(settings.data.contact_phone || '')
    setEmail(settings.data.contact_email || '')
    setLogoFile(null)
    setRemoveLogo(false)
  }, [settings.data])

  const save = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      fd.append('name', name)
      fd.append('primary_color', primaryColor)
      fd.append('address', address)
      fd.append('contact_phone', phone)
      fd.append('contact_email', email)
      if (logoFile) fd.append('logo', logoFile)
      else if (removeLogo) fd.append('logo', '')
      const res = await api.patch<SettingsResponse>(
        `/center/${slug}/settings/`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      return res.data
    },
    onSuccess: () => {
      toast.success('Settings saved')
      qc.invalidateQueries({ queryKey: ['center-settings', slug] })
      qc.invalidateQueries({ queryKey: ['center-dashboard', slug] })
    },
    onError: () => toast.error('Save failed'),
  })

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setLogoFile(file)
    if (file) setRemoveLogo(false)
  }

  const previewUrl = logoFile
    ? URL.createObjectURL(logoFile)
    : !removeLogo && settings.data?.logo
      ? settings.data.logo
      : null

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-light text-slate-900">Center settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Center branding (logo, color) and contact information.
        </p>
      </div>

      {settings.isLoading && <p className="text-slate-500">Loading…</p>}
      {settings.isError && (
        <p className="text-cta-600">Couldn't load settings.</p>
      )}

      {settings.data && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardContent className="space-y-5 p-6">
              <Field label="Center name">
                <input
                  className="w-full rounded-md border px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>

              <Field label="Primary color">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded border"
                  />
                  <input
                    className="w-32 rounded-md border px-3 py-2 font-mono text-sm uppercase focus:border-slate-900 focus:outline-none"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                  />
                  <span className="text-xs text-slate-500">
                    Accent color for buttons and the student page
                  </span>
                </div>
              </Field>

              <Field label="Manzil">
                <textarea
                  rows={2}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                  placeholder="Toshkent sh., Yunusobod, ..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Telefon">
                  <input
                    className="w-full rounded-md border px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                    placeholder="+998 90 123 45 67"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    className="w-full rounded-md border px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                    placeholder="info@center.uz"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
              </div>

              <div className="flex items-center gap-2 border-t pt-4">
                <Button
                  onClick={() => save.mutate()}
                  disabled={save.isPending}
                >
                  {save.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    'Save'
                  )}
                </Button>
                <span className="text-xs text-slate-500">
                  Plan: {settings.data.plan_status}
                  {settings.data.plan_expires_at &&
                    ` · ${new Date(settings.data.plan_expires_at).toLocaleDateString('uz-UZ')} gacha`}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-6">
              <div>
                <h2 className="text-base font-semibold">Logo</h2>
                <p className="mt-1 text-xs text-slate-500">
                  PNG/JPG/SVG, transparent background tavsiya qilinadi.
                </p>
              </div>

              <div className="flex h-40 items-center justify-center rounded-md border bg-slate-50">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Logo preview"
                    className="max-h-32 max-w-full object-contain"
                  />
                ) : (
                  <span className="text-sm text-slate-400">Logo yo‘q</span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onPickFile}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {logoFile ? 'Boshqa fayl' : 'Choose file'}
                </Button>
                {(settings.data.logo || logoFile) && !removeLogo && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setLogoFile(null)
                      setRemoveLogo(true)
                      if (fileRef.current) fileRef.current.value = ''
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                )}
              </div>
              {logoFile && (
                <p className="text-xs text-slate-500">
                  New: {logoFile.name}
                </p>
              )}
              {removeLogo && (
                <p className="text-xs text-cta-600">
                  Saqlaganingizdan keyin logo o‘chiriladi.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {children}
    </label>
  )
}
