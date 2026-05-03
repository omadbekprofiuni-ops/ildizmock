import { useEffect } from 'react'
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom'

import { AdminRoute } from '@/components/AdminRoute'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { SuperAdminRoute } from '@/components/SuperAdminRoute'
import { TeacherRoute } from '@/components/TeacherRoute'
import { Toaster } from '@/components/ui/toaster'
import { useAuth } from '@/stores/auth'

import CenterAdminLayout from './layouts/CenterAdminLayout'
import CenterAnalyticsPage from './pages/center/AnalyticsPage'
import CenterDashboard from './pages/center/CenterDashboard'
import EasyTestCreatePage from './pages/center/EasyTestCreatePage'
import StudentDetailPage from './pages/center/StudentDetailPage'
import TestCreateHubPage from './pages/center/TestCreateHubPage'
import GroupCreatePage from './pages/center/GroupCreatePage'
import GroupDetailPage from './pages/center/GroupDetailPage'
import GroupsComparisonPage from './pages/center/GroupsComparisonPage'
import GroupsListPage from './pages/center/GroupsListPage'
import CenterSettingsPage from './pages/center/SettingsPage'
import CenterStudentsPage from './pages/center/StudentsPage'
import CenterTeachersPage from './pages/center/TeachersPage'
import CenterTestsPage from './pages/center/TestsPage'
import TestPreviewPage from './pages/center/TestPreviewPage'
import MockControlPage from './pages/center/mock/MockControlPage'
import MockResultsPage from './pages/center/mock/MockResultsPage'
import MockSessionsPage from './pages/center/mock/MockSessionsPage'
import MockJoinPage from './pages/mock/MockJoinPage'
import MockSessionPage from './pages/mock/MockSessionPage'
import SuperTestsListPage from './pages/super/SuperTestsListPage'
import TestWizardPage from './pages/super/TestWizardPage'
import CenterDetailPage from './pages/superadmin/CenterDetailPage'
import OrgContextRedirect from './pages/superadmin/OrgContextRedirect'
import OrgStatisticsPage from './pages/superadmin/OrgStatisticsPage'
import OrgStudentsPage from './pages/superadmin/OrgStudentsPage'
import OrgTeachersPage from './pages/superadmin/OrgTeachersPage'
import OrgTestResultsPage from './pages/superadmin/OrgTestResultsPage'
import OrgTestsPage from './pages/superadmin/OrgTestsPage'
import OrgWritingsPage from './pages/superadmin/OrgWritingsPage'
import SuperAdminAudioPage from './pages/superadmin/SuperAdminAudioPage'
import SuperAdminBillingPage from './pages/superadmin/SuperAdminBillingPage'
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard'
import SuperAdminLayout from './pages/superadmin/SuperAdminLayout'
import SuperAdminOrgsPage from './pages/superadmin/SuperAdminOrgsPage'
import SuperAdminSettingsPage from './pages/superadmin/SuperAdminSettingsPage'
import SuperAdminStatsPage from './pages/superadmin/SuperAdminStatsPage'
import AdminStudentsPage from './pages/admin/AdminStudentsPage'
import AdminTeachersPage from './pages/admin/AdminTeachersPage'
import AdminTestEditPage from './pages/admin/AdminTestEditPage'
import AdminTestsPage from './pages/admin/AdminTestsPage'
import DashboardPage from './pages/admin/DashboardPage'
import HistoryPage from './pages/HistoryPage'
import HomePage from './pages/HomePage'
import FeaturesPage from './pages/public/FeaturesPage'
import PricingPage from './pages/public/PricingPage'
import LoginPage from './pages/auth/LoginPage'
import MyWritingsPage from './pages/MyWritingsPage'
import NotFoundPage from './pages/NotFoundPage'
import OrgLandingPage from './pages/OrgLandingPage'
import ResultPage from './pages/ResultPage'
import SpeakingComingSoonPage from './pages/SpeakingComingSoonPage'
import StudentCertificatesPage from './pages/student/CertificatesPage'
import MockResultDetailPage from './pages/student/MockResultDetailPage'
import StudentMockResultsPage from './pages/student/MockResultsPage'
import VerifyCertificatePage from './pages/VerifyCertificatePage'
import PracticeHistoryPage from './pages/student/PracticeHistoryPage'
import PracticeListPage from './pages/student/PracticeListPage'
import PracticeModulePage from './pages/student/PracticeModulePage'
import ProfilePage from './pages/student/ProfilePage'
import StudentDashboard from './pages/student/StudentDashboard'
import TakeTestPage from './pages/TakeTestPage'
import TeacherGradePage from './pages/teacher/TeacherGradePage'
import TeacherQueuePage from './pages/teacher/TeacherQueuePage'
import TeacherStudentsPage from './pages/teacher/TeacherStudentsPage'
import TeacherStudentDetailPage from './pages/teacher/TeacherStudentDetailPage'
import MockSpeakingGradePage from './pages/teacher/mock/MockSpeakingGradePage'
import MockSpeakingQueuePage from './pages/teacher/mock/MockSpeakingQueuePage'
import MockWritingGradePage from './pages/teacher/mock/MockWritingGradePage'
import MockWritingQueuePage from './pages/teacher/mock/MockWritingQueuePage'
import TestListPage from './pages/TestListPage'
import WritingSentPage from './pages/WritingSentPage'

export default function App() {
  const fetchMe = useAuth((s) => s.fetchMe)
  useEffect(() => { fetchMe() }, [fetchMe])

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* Public — guest can browse */}
          <Route path="/" element={<HomePage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/tests/speaking" element={<SpeakingComingSoonPage />} />
          <Route path="/tests/:module" element={<TestListPage />} />
          <Route path="/take/:attemptId" element={<TakeTestPage />} />
          <Route path="/result/:attemptId" element={<ResultPage />} />

          {/* Mock session — public student routes */}
          <Route path="/mock/join/:code" element={<MockJoinPage />} />
          <Route path="/mock/session/:bsid" element={<MockSessionPage />} />

          {/* ETAP 20 — Public certificate verification */}
          <Route path="/verify/:code" element={<VerifyCertificatePage />} />

          {/* Auth-required */}
          <Route path="/dashboard" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
          <Route path="/my-writings" element={<ProtectedRoute><MyWritingsPage /></ProtectedRoute>} />
          <Route path="/writing/sent" element={<ProtectedRoute><WritingSentPage /></ProtectedRoute>} />
          <Route path="/student/mock" element={<ProtectedRoute><StudentMockResultsPage /></ProtectedRoute>} />
          <Route path="/student/mock/:id" element={<ProtectedRoute><MockResultDetailPage /></ProtectedRoute>} />
          <Route path="/student/certificates" element={<ProtectedRoute><StudentCertificatesPage /></ProtectedRoute>} />
          <Route path="/practice" element={<ProtectedRoute><PracticeListPage /></ProtectedRoute>} />
          <Route path="/practice/history" element={<ProtectedRoute><PracticeHistoryPage /></ProtectedRoute>} />
          <Route path="/practice/:module" element={<ProtectedRoute><PracticeModulePage /></ProtectedRoute>} />

          {/* Teacher */}
          <Route path="/teacher" element={<TeacherRoute><TeacherQueuePage /></TeacherRoute>} />
          <Route path="/teacher/grade/:id" element={<TeacherRoute><TeacherGradePage /></TeacherRoute>} />
          <Route path="/teacher/students" element={<TeacherRoute><TeacherStudentsPage /></TeacherRoute>} />
          <Route path="/teacher/students/:studentId" element={<TeacherRoute><TeacherStudentDetailPage /></TeacherRoute>} />
          <Route path="/teacher/mock/writing" element={<TeacherRoute><MockWritingQueuePage /></TeacherRoute>} />
          <Route path="/teacher/mock/writing/:id" element={<TeacherRoute><MockWritingGradePage /></TeacherRoute>} />
          <Route path="/teacher/mock/speaking" element={<TeacherRoute><MockSpeakingQueuePage /></TeacherRoute>} />
          <Route path="/teacher/mock/speaking/:id" element={<TeacherRoute><MockSpeakingGradePage /></TeacherRoute>} />

          {/* SuperAdmin (ILDIZMock platform) */}
          <Route path="/super" element={<SuperAdminRoute><SuperAdminDashboard /></SuperAdminRoute>} />
          <Route path="/super/organizations" element={<SuperAdminRoute><SuperAdminOrgsPage /></SuperAdminRoute>} />
          <Route path="/super/organizations/:id" element={<SuperAdminRoute><CenterDetailPage /></SuperAdminRoute>} />
          {/* ETAP 22 — /super/org/:id/dashboard alias */}
          <Route path="/super/org/:id/dashboard" element={<SuperAdminRoute><CenterDetailPage /></SuperAdminRoute>} />
          {/* TROUBLESHOOTING — /super/org/:id/stats alias */}
          <Route path="/super/org/:id/stats" element={<SuperAdminRoute><CenterDetailPage /></SuperAdminRoute>} />

          {/* SuperAdmin org context links (sidebar nav) — context'dan id orqali */}
          <Route
            path="/super/org/dashboard"
            element={
              <SuperAdminRoute>
                <OrgContextRedirect to={(id) => `/super/organizations/${id}`} />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super/org/students"
            element={<SuperAdminRoute><OrgStudentsPage /></SuperAdminRoute>}
          />
          <Route
            path="/super/org/teachers"
            element={<SuperAdminRoute><OrgTeachersPage /></SuperAdminRoute>}
          />
          <Route
            path="/super/org/writings"
            element={<SuperAdminRoute><OrgWritingsPage /></SuperAdminRoute>}
          />
          <Route
            path="/super/org/statistics"
            element={<SuperAdminRoute><OrgStatisticsPage /></SuperAdminRoute>}
          />
          <Route
            path="/super/org/stats"
            element={<SuperAdminRoute><OrgStatisticsPage /></SuperAdminRoute>}
          />
          <Route
            path="/super/org/payment"
            element={<SuperAdminRoute><SuperAdminBillingPage /></SuperAdminRoute>}
          />
          <Route
            path="/super/org/billing"
            element={<SuperAdminRoute><SuperAdminBillingPage /></SuperAdminRoute>}
          />
          {/* :orgId-based aliases */}
          <Route
            path="/super/org/:orgId/students"
            element={<SuperAdminRoute><OrgStudentsPage /></SuperAdminRoute>}
          />
          <Route
            path="/super/org/:orgId/teachers"
            element={<SuperAdminRoute><OrgTeachersPage /></SuperAdminRoute>}
          />
          <Route
            path="/super/org/:orgId/writings"
            element={<SuperAdminRoute><OrgWritingsPage /></SuperAdminRoute>}
          />
          <Route
            path="/super/org/:orgId/statistics"
            element={<SuperAdminRoute><OrgStatisticsPage /></SuperAdminRoute>}
          />
          <Route
            path="/super/org/:orgId/payment"
            element={<SuperAdminRoute><SuperAdminBillingPage /></SuperAdminRoute>}
          />
          {/* Org tests va test results */}
          <Route
            path="/super/org/tests"
            element={<SuperAdminRoute><OrgTestsPage /></SuperAdminRoute>}
          />
          <Route
            path="/super/org/:orgId/tests"
            element={<SuperAdminRoute><OrgTestsPage /></SuperAdminRoute>}
          />
          <Route
            path="/super/org/:orgId/tests/:testId/results"
            element={<SuperAdminRoute><OrgTestResultsPage /></SuperAdminRoute>}
          />
          <Route
            path="/super/tests"
            element={
              <SuperAdminRoute>
                <SuperTestsListPage />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super/tests/wizard"
            element={
              <SuperAdminRoute>
                <TestWizardPage />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super/tests/wizard/:id"
            element={
              <SuperAdminRoute>
                <TestWizardPage />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super/tests/new"
            element={
              <SuperAdminRoute>
                <AdminTestEditPage Layout={SuperAdminLayout} basePath="/super/tests" />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super/tests/:testId/edit"
            element={
              <SuperAdminRoute>
                <AdminTestEditPage Layout={SuperAdminLayout} basePath="/super/tests" />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super/payments"
            element={
              <SuperAdminRoute>
                <SuperAdminBillingPage />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super/audio"
            element={
              <SuperAdminRoute>
                <SuperAdminAudioPage />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super/stats"
            element={
              <SuperAdminRoute>
                <SuperAdminStatsPage />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super/settings"
            element={
              <SuperAdminRoute>
                <SuperAdminSettingsPage />
              </SuperAdminRoute>
            }
          />

          {/* Admin (legacy, with org_admin permissions) */}
          <Route path="/admin" element={<AdminRoute><DashboardPage /></AdminRoute>} />
          <Route path="/admin/tests" element={<AdminRoute><AdminTestsPage /></AdminRoute>} />
          <Route path="/admin/tests/new" element={<AdminRoute><AdminTestEditPage /></AdminRoute>} />
          <Route path="/admin/tests/:testId/edit" element={<AdminRoute><AdminTestEditPage /></AdminRoute>} />
          <Route path="/admin/teachers" element={<AdminRoute><AdminTeachersPage /></AdminRoute>} />
          <Route path="/admin/students" element={<AdminRoute><AdminStudentsPage /></AdminRoute>} />

          {/* Center layout (slug-based) — Permission'lar backend tomonda
              IsCenterAdmin / IsCenterMember orqali tekshiriladi. */}
          <Route path="/:slug/admin" element={<ProtectedRoute><Outlet /></ProtectedRoute>}>
            <Route element={<CenterAdminLayout />}>
              <Route index element={<CenterDashboard />} />
              <Route path="students" element={<CenterStudentsPage />} />
              <Route path="students/:studentId" element={<StudentDetailPage />} />
              <Route path="teachers" element={<CenterTeachersPage />} />
              <Route path="tests" element={<CenterTestsPage />} />
              <Route path="tests/new" element={<TestCreateHubPage />} />
              <Route path="tests/new/:module" element={<EasyTestCreatePage />} />
              <Route path="tests/:testId/preview" element={<TestPreviewPage />} />
              <Route path="mock" element={<MockSessionsPage />} />
              <Route path="mock/:sessionId" element={<MockControlPage />} />
              <Route path="mock/:sessionId/results" element={<MockResultsPage />} />
              <Route path="groups" element={<GroupsListPage />} />
              <Route path="groups/new" element={<GroupCreatePage />} />
              <Route path="groups/comparison" element={<GroupsComparisonPage />} />
              <Route path="groups/:groupId" element={<GroupDetailPage />} />
              <Route path="analytics" element={<CenterAnalyticsPage />} />
              <Route path="settings" element={<CenterSettingsPage />} />
            </Route>
          </Route>

          {/* Org-branded — must come AFTER all static routes */}
          <Route path="/:slug/login" element={<LoginPage />} />
          <Route path="/:slug" element={<OrgLandingPage />} />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    </ErrorBoundary>
  )
}
