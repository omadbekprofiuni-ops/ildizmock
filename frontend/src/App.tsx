import { useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { AdminRoute } from '@/components/AdminRoute'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { SuperAdminRoute } from '@/components/SuperAdminRoute'
import { TeacherRoute } from '@/components/TeacherRoute'
import { Toaster } from '@/components/ui/toaster'
import { useAuth } from '@/stores/auth'

import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard'
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
import RegisterPage from './pages/auth/RegisterPage'
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
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/tests/speaking" element={<SpeakingComingSoonPage />} />
          <Route path="/tests/:module" element={<TestListPage />} />
          <Route path="/take/:attemptId" element={<TakeTestPage />} />
          <Route path="/result/:attemptId" element={<ResultPage />} />

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

          {/* SuperAdmin (ILDIZMock platforma) */}
          <Route path="/super" element={<SuperAdminRoute><SuperAdminDashboard /></SuperAdminRoute>} />
          <Route path="/super/organizations" element={<SuperAdminRoute><SuperAdminOrgsPage /></SuperAdminRoute>} />

          {/* Admin (legacy, org_admin huquqi bilan) */}
          <Route path="/admin" element={<AdminRoute><DashboardPage /></AdminRoute>} />
          <Route path="/admin/tests" element={<AdminRoute><AdminTestsPage /></AdminRoute>} />
          <Route path="/admin/tests/new" element={<AdminRoute><AdminTestEditPage /></AdminRoute>} />
          <Route path="/admin/tests/:testId/edit" element={<AdminRoute><AdminTestEditPage /></AdminRoute>} />
          <Route path="/admin/teachers" element={<AdminRoute><AdminTeachersPage /></AdminRoute>} />
          <Route path="/admin/students" element={<AdminRoute><AdminStudentsPage /></AdminRoute>} />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    </ErrorBoundary>
  )
}
