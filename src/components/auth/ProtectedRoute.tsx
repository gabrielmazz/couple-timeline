import { Center, Loader } from '@mantine/core'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './auth-context'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <Center mih="55vh">
        <Loader color="pink" />
      </Center>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}
