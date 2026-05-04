import { Construction } from 'lucide-react'

import { PageHeader, PageShell, SurfaceCard } from '@/components/admin-shell'

export default function AttendancePage() {
  return (
    <PageShell>
      <PageHeader
        title="Attendance"
        subtitle="Student attendance (coming soon)"
      />

      <SurfaceCard className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Construction className="mx-auto mb-4 h-16 w-16 text-amber-500" />
          <h2 className="mb-2 text-2xl font-semibold text-slate-700">
            Coming soon
          </h2>
          <p className="mx-auto max-w-md text-slate-500">
            Attendance system is in development. This section will let you track student attendance
            avtomatik va qo'lda belgilash imkoniyati bo'ladi.
          </p>

          <div className="mx-auto mt-6 max-w-md text-left">
            <h3 className="mb-2 font-medium text-slate-700">
              Rejalashtrilgan funksiyalar:
            </h3>
            <ul className="space-y-1 text-sm text-slate-600">
              <li>✓ Daily attendance tracking</li>
              <li>✓ Quick attendance via QR code</li>
              <li>✓ Export attendance (Excel)</li>
              <li>✓ Attendance statistics</li>
              <li>✓ Ota-onalarga avtomatik bildirishnoma</li>
            </ul>
          </div>
        </div>
      </SurfaceCard>
    </PageShell>
  )
}
