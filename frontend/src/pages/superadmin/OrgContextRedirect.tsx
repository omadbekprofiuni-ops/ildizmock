import { Navigate } from 'react-router-dom'

import { useOrgContext } from '@/stores/orgContext'

/**
 * SuperAdmin /super/org/<page> URL'lari uchun helper.
 * orgContext'dan tanlangan org id ni o'qib, mos route'ga yo'naltiradi.
 * Agar org context bo'sh bo'lsa — markazlar ro'yxatiga qaytaradi.
 */
export default function OrgContextRedirect({
  to,
  fallback = '/super/organizations',
}: {
  to: (orgId: number) => string
  fallback?: string
}) {
  const orgId = useOrgContext((s) => s.orgId)
  if (!orgId) {
    return <Navigate to={fallback} replace />
  }
  return <Navigate to={to(orgId)} replace />
}
