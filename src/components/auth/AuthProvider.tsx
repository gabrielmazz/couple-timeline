import { onAuthStateChanged } from 'firebase/auth'
import { useEffect, useMemo, useState } from 'react'
import { firebaseAuth } from '../../lib/firebase/client'
import { AuthContext, type AppUser } from './auth-context'

function currentUser(): AppUser | null {
  const user = firebaseAuth.currentUser
  return user ? { id: user.uid, email: user.email, user_metadata: { name: user.displayName } } : null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => onAuthStateChanged(firebaseAuth, () => {
    setUser(currentUser())
    setLoading(false)
  }), [])
  const value = useMemo(() => ({ user, loading, refreshSession: async () => setUser(currentUser()) }), [user, loading])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
