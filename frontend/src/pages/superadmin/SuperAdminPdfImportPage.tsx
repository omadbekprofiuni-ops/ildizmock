import PdfImportPage from '@/pages/center/tests/PdfImportPage'
import SuperAdminLayout from '@/pages/superadmin/SuperAdminLayout'

export default function SuperAdminPdfImportPage() {
  return (
    <SuperAdminLayout>
      <PdfImportPage editBasePath="/super/tests" backPath="/super/tests" />
    </SuperAdminLayout>
  )
}
