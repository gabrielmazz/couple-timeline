import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AppBackgroundProvider } from './components/layout/AppBackgroundProvider'
import { AppFrame } from './components/layout/AppFrame'
import { DashboardPage } from './pages/DashboardPage'
import { EventEditorPage } from './pages/EventEditorPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { ProfilePage } from './pages/ProfilePage'
import { RegisterPage } from './pages/RegisterPage'
import { TimelinePage } from './pages/TimelinePage'

export default function App() {
  return (
    <AppBackgroundProvider>
      <AppFrame>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/perfil"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route path="/timeline/:coupleId" element={<TimelinePage />} />
          <Route
            path="/timeline/:coupleId/novo-evento"
            element={
              <ProtectedRoute>
                <EventEditorPage mode="create" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/timeline/:coupleId/eventos/:eventId/editar"
            element={
              <ProtectedRoute>
                <EventEditorPage mode="edit" />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppFrame>
    </AppBackgroundProvider>
  )
}
