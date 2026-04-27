import { Construction } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

import SuperAdminLayout from './SuperAdminLayout'

export default function SuperAdminComingSoonPage({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <SuperAdminLayout>
      <header className="border-b bg-white px-8 py-5">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </header>
      <div className="p-8">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center text-muted-foreground">
            <Construction className="h-10 w-10 text-amber-500" />
            <p className="text-base font-medium text-slate-700">Coming soon</p>
            <p className="max-w-md text-sm">
              This section is under construction. It will be available in an
              upcoming release.
            </p>
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  )
}
