import { Navigate, Route, Routes } from 'react-router-dom'
import { Center, Loader } from '@mantine/core'
import { lazy, Suspense } from 'react'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AppBackgroundProvider } from './components/layout/AppBackgroundProvider'
import { AppFrame } from './components/layout/AppFrame'
import { DashboardPage } from './pages/DashboardPage'
import { EventEditorPage } from './pages/EventEditorPage'
import { CalendarPage } from './pages/CalendarPage'
import { GiftsPage } from './pages/GiftsPage'
import { FutureMomentsPage } from './pages/FutureMomentsPage'
import { LoginPage } from './pages/LoginPage'
import { MiniGamesPage } from './pages/MiniGamesPage'
import { ProfilePage } from './pages/ProfilePage'
import { RegisterPage } from './pages/RegisterPage'
import { TimelinePage } from './pages/TimelinePage'
import { TruthOrDarePage } from './pages/TruthOrDarePage'

const CoupleQuizPage = lazy(() => import('./pages/CoupleQuizPage').then(({ CoupleQuizPage: page }) => ({ default: page })))
const RelationshipRulesPage = lazy(() => import('./pages/RelationshipRulesPage').then(({ RelationshipRulesPage: page }) => ({ default: page })))
const MonthlyPlansPage = lazy(() => import('./pages/MonthlyPlansPage').then(({ MonthlyPlansPage: page }) => ({ default: page })))

function PageLoading() {
  return (
    <Center mih="55vh">
      <Loader color="pink" aria-label="Carregando página" />
    </Center>
  )
}

export default function App() {
  return (
    <AppBackgroundProvider>
      <AppFrame>
        <Routes>
          <Route path="/" element={<LoginPage />} />
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
          <Route
            path="/presentes"
            element={
              <ProtectedRoute>
                <GiftsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/calendario"
            element={
              <ProtectedRoute>
                <CalendarPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/planos-do-mes"
            element={
              <ProtectedRoute>
                <Suspense fallback={<PageLoading />}>
                  <MonthlyPlansPage />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/nossas-regras"
            element={<ProtectedRoute><Suspense fallback={<PageLoading />}><RelationshipRulesPage /></Suspense></ProtectedRoute>}
          />
          <Route
            path="/futuro"
            element={
              <ProtectedRoute>
                <FutureMomentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/jogos"
            element={
              <ProtectedRoute>
                <MiniGamesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/jogos/verdade-ou-desafio"
            element={
              <ProtectedRoute>
                <TruthOrDarePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/jogos/quem-conhece-melhor"
            element={
              <ProtectedRoute>
                <Suspense fallback={<PageLoading />}>
                  <CoupleQuizPage />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/jogos/quiz-do-casal"
            element={
              <ProtectedRoute>
                <Suspense fallback={<PageLoading />}>
                  <CoupleQuizPage />
                </Suspense>
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
