import { BookOpen, LogOut, Sparkles, User as UserIcon } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { toast } from '@/components/ui/toaster'
import { useAuth } from '@/stores/auth'

export default function B2CDashboardPage() {
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)

  const onLogout = async () => {
    await logout()
    toast.success('Chiqildi')
    navigate('/b2c/login')
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/b2c/dashboard" className="text-base font-extrabold tracking-tight text-slate-900">
            ILDIZ<span className="text-brand-600">mock</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              to="/b2c/profile"
              className="rounded-xl px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
            >
              Profil
            </Link>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:border-brand-300 hover:text-brand-700"
            >
              <LogOut className="h-4 w-4" /> Chiqish
            </button>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-24 pt-12">
        <div className="mb-10">
          <h1 className="text-[32px] font-extrabold tracking-tight text-slate-900">
            Salom, {user?.first_name || 'foydalanuvchi'}!
          </h1>
          <p className="mt-2 text-[15px] text-slate-600">
            Yangi B2C akkauntingiz yaratildi. Hozircha bu yerda asosiy bo'limlar ko'rinadi —
            keyingi etaplarda kredit balansi, katalog va natijalar qo'shiladi.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            to="/tests/reading"
            className="group rounded-[20px] border border-slate-100 bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-brand-100"
            style={{ boxShadow: 'var(--shadow-sm)' }}
          >
            <div className="icon-tile icon-tile--brand">
              <BookOpen className="h-6 w-6" />
            </div>
            <h3 className="mb-1 text-lg font-extrabold text-slate-900">Katalog</h3>
            <p className="text-sm leading-relaxed text-slate-600">
              Reading, Listening, Writing modullarini ochib testlarni ko'rib chiqing.
            </p>
            <span className="mt-3 inline-block text-sm font-bold text-brand-600">
              Ochish →
            </span>
          </Link>

          <Link
            to="/b2c/profile"
            className="group rounded-[20px] border border-slate-100 bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-brand-100"
            style={{ boxShadow: 'var(--shadow-sm)' }}
          >
            <div className="icon-tile icon-tile--accent">
              <UserIcon className="h-6 w-6" />
            </div>
            <h3 className="mb-1 text-lg font-extrabold text-slate-900">Profilim</h3>
            <p className="text-sm leading-relaxed text-slate-600">
              Ism, familiya, telefon, til va maqsadli imtihonni yangilang.
            </p>
            <span className="mt-3 inline-block text-sm font-bold text-brand-600">
              Tahrirlash →
            </span>
          </Link>

          <div
            className="rounded-[20px] border border-dashed border-slate-200 bg-white p-6 opacity-80"
            style={{ boxShadow: 'var(--shadow-sm)' }}
          >
            <div className="icon-tile icon-tile--cta">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="mb-1 text-lg font-extrabold text-slate-900">Kreditlar</h3>
            <p className="text-sm leading-relaxed text-slate-600">
              Test krediti tizimi ETAP 16'da ishga tushadi.
            </p>
            <span className="mt-3 inline-block rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">
              Tez orada
            </span>
          </div>
        </div>
      </section>
    </main>
  )
}
