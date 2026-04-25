import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/toaster'
import { api } from '@/lib/api'

import AdminLayout from './AdminLayout'

type Teacher = {
  id: number
  phone: string
  first_name: string
  last_name: string
  is_active: boolean
  created_at: string
  student_count: number
}

export default function AdminTeachersPage() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    phone: '+998',
    first_name: '',
    last_name: '',
    password: '',
  })

  const list = useQuery({
    queryKey: ['admin-teachers'],
    queryFn: async () =>
      (await api.get<Teacher[]>('/admin/teachers/')).data,
  })

  const create = useMutation({
    mutationFn: async () =>
      (await api.post('/admin/teachers/', form)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-teachers'] })
      toast.success('Teacher yaratildi')
      setOpen(false)
      setForm({ phone: '+998', first_name: '', last_name: '', password: '' })
    },
    onError: (err) => {
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data
      const msg = data
        ? Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(' · ')
        : 'Xatolik'
      toast.error(msg)
    },
  })

  return (
    <AdminLayout>
      <header className="flex items-center justify-between border-b bg-white px-8 py-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Teachers</h1>
          <p className="text-sm text-muted-foreground">
            Teacher rolidagi foydalanuvchilar
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New teacher
        </Button>
      </header>
      <div className="p-8">
        {list.isLoading && <p className="text-muted-foreground">Loading…</p>}
        {list.data && list.data.length === 0 && (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
              Hali ustoz yo‘q.
            </CardContent>
          </Card>
        )}
        {list.data && list.data.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-3">Ism</th>
                    <th className="px-6 py-3">Username</th>
                    <th className="px-6 py-3">Students</th>
                    <th className="px-6 py-3">Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {list.data.map((t) => (
                    <tr key={t.id}>
                      <td className="px-6 py-3 font-medium">
                        {`${t.first_name} ${t.last_name}`.trim() || '—'}
                      </td>
                      <td className="px-6 py-3 font-mono text-xs">{t.phone}</td>
                      <td className="px-6 py-3">{t.student_count}</td>
                      <td className="px-6 py-3">{t.is_active ? '✓' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New teacher qo‘shish</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ism</Label>
                <Input
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Familiya</Label>
                <Input
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Username</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+998901234567"
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? 'Yaratilmoqda…' : 'Yaratish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
