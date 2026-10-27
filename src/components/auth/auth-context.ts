import { createContext, useContext } from 'react'
export type AppUser = { id: string; email: string | null; user_metadata: { name: string | null } }

export type AuthContextValue = {
  user: AppUser | null
  loading: boolean
  refreshSession: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}
