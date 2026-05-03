import { Construction } from 'lucide-react'

import { PageHeader, PageShell, SurfaceCard } from '@/components/admin-shell'

export default function AttendancePage() {
  return (
    <PageShell>
      <PageHeader
        title="Davomat"
        subtitle="Talabalar davomati (tez orada)"
      />

      <SurfaceCard className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Construction className="mx-auto mb-4 h-16 w-16 text-amber-500" />
          <h2 className="mb-2 text-2xl font-semibold text-slate-700">
            Tez orada
          </h2>
          <p className="mx-auto max-w-md text-slate-500">
            Davomat tizimi ishlab chiqilmoqda. Bu bo'limda talabalar davomatini
            avtomatik va qo'lda belgilash imkoniyati bo'ladi.
          </p>

          <div className="mx-auto mt-6 max-w-md text-left">
            <h3 className="mb-2 font-medium text-slate-700">
              Rejalashtrilgan funksiyalar:
            </h3>
            <ul className="space-y-1 text-sm text-slate-600">
              <li>✓ Har kunlik davomat olish</li>
              <li>✓ QR kod orqali tezkor davomat</li>
              <li>✓ Davomatni export qilish (Excel)</li>
              <li>✓ Davomat statistikasi</li>
              <li>✓ Ota-onalarga avtomatik bildirishnoma</li>
            </ul>
          </div>
        </div>
      </SurfaceCard>
    </PageShell>
  )
}
