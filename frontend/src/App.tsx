import { useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { AdminRoute } from '@/components/AdminRoute'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { SuperAdminRoute } from '@/components/SuperAdminRoute'
import { TeacherRoute } from '@/components/TeacherRoute'
import { Toaster } from '@/components/ui/toaster'
import { useAuth } from '@/stores/auth'

import { RequireCenterAdmin } from '@/components/guards/RequireCenterAdmin'
import CenterAdminLayout from './layouts/CenterAdminLayout'
import CenterDashboard from './pages/center/CenterDashboard'
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
import SuperAdminComingSoonPage from './pages/superadmin/SuperAdminComingSoonPage'
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard'
import SuperAdminLayout from './pages/superadmin/SuperAdminLayout'
import SuperAdminOrgsPage from './pages/superadmin/SuperAdminOrgsPage'
import AdminStudentsPage from './pages/admin/AdminStudentsPage'
import AdminTeachersPage from './pages/admin/AdminTeachersPage'
import AdminTestEditPage from './pages/admin/AdminTestEditPage'
import AdminTestsPage from './pages/admin/AdminTestsPage'
import DashboardPage from './pages/admin/DashboardPage'
import HistoryPage from './pages/HistoryPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/auth/LoginPage'
import MyWritingsPage from './pages/MyWritingsPage'
import NotFoundPage from './pages/NotFoundPage'
import OrgLandingPage from './pages/OrgLandingPage'
import OrgRegisterPage from './pages/OrgRegisterPage'
import ResultPage from './pages/ResultPage'
import SpeakingComingSoonPage from './pages/SpeakingComingSoonPage'
import ProfilePage from './pages/student/ProfilePage'
import StudentDashboard from './pages/student/StudentDashboard'
import TakeTestPage from './pages/TakeTestPage'
import TeacherGradePage from './pages/teacher/TeacherGradePage'
import TeacherQueuePage from './pages/teacher/TeacherQueuePage'
import TeacherStudentsPage from './pages/teacher/TeacherStudentsPage'
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
          <Route path="/login" element={<LoginPage />} />
          <Route path="/tests/speaking" element={<SpeakingComingSoonPage />} />
          <Route path="/tests/:module" element={<TestListPage />} />
          <Route path="/take/:attemptId" element={<TakeTestPage />} />
          <Route path="/result/:attemptId" element={<ResultPage />} />

          {/* Mock session — public student routes */}
          <Route path="/mock/join/:code" element={<MockJoinPage />} />
          <Route path="/mock/session/:bsid" element={<MockSessionPage />} />

          {/* Auth-required */}
          <Route path="/dashboard" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
          <Route path="/my-writings" element={<ProtectedRoute><MyWritingsPage /></ProtectedRoute>} />
          <Route path="/writing/sent" element={<ProtectedRoute><WritingSentPage /></ProtectedRoute>} />

          {/* Teacher */}
          <Route path="/teacher" element={<TeacherRoute><TeacherQueuePage /></TeacherRoute>} />
          <Route path="/teacher/grade/:id" element={<TeacherRoute><TeacherGradePage /></TeacherRoute>} />
          <Route path="/teacher/students" element={<TeacherRoute><TeacherStudentsPage /></TeacherRoute>} />

          {/* SuperAdmin (ILDIZMock platform) */}
          <Route path="/super" element={<SuperAdminRoute><SuperAdminDashboard /></SuperAdminRoute>} />
          <Route path="/super/organizations" element={<SuperAdminRoute><SuperAdminOrgsPage /></SuperAdminRoute>} />
          <Route path="/super/organizations/:id" element={<SuperAdminRoute><CenterDetailPage /></SuperAdminRoute>} />
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
                <SuperAdminComingSoonPage
                  title="Payments"
                  subtitle="Subscription and billing history across all centers"
                />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super/audio"
            element={
              <SuperAdminRoute>
                <SuperAdminComingSoonPage
                  title="Audio files"
                  subtitle="Listening audio library"
                />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super/stats"
            element={
              <SuperAdminRoute>
                <SuperAdminComingSoonPage
                  title="Statistics"
                  subtitle="Platform-wide analytics"
                />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super/settings"
            element={
              <SuperAdminRoute>
                <SuperAdminComingSoonPage
                  title="Settings"
                  subtitle="Platform configuration"
                />
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

          {/* Center admin (slug-based) — ETAP 2 */}
          <Route path="/:slug/admin" element={<RequireCenterAdmin />}>
            <Route element={<CenterAdminLayout />}>
              <Route index element={<CenterDashboard />} />
              <Route path="students" element={<CenterStudentsPage />} />
              <Route path="teachers" element={<CenterTeachersPage />} />
              <Route path="tests" element={<CenterTestsPage />} />
              <Route path="tests/:testId/preview" element={<TestPreviewPage />} />
              <Route path="mock" element={<MockSessionsPage />} />
              <Route path="mock/:sessionId" element={<MockControlPage />} />
              <Route path="mock/:sessionId/results" element={<MockResultsPage />} />
            </Route>
          </Route>

          {/* Org-branded — must come AFTER all static routes */}
          <Route path="/:slug/register" element={<OrgRegisterPage />} />
          <Route path="/:slug/login" element={<LoginPage />} />
          <Route path="/:slug" element={<OrgLandingPage />} />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    </ErrorBoundary>
  )
}
