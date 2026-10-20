import { useEffect, useState } from 'react'
import { supabase } from "./lib/supabaseClient"
import Auth from './pages/Auth'
import MemberDashboard from './pages/MemberDashboard'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setSession(null)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
        <p className="text-sm text-gray-400">Memuat aplikasi...</p>
      </div>
    )
  }

  if (!session) {
    return <Auth onLogin={(s) => setSession(s)} />
  }

  return <MemberDashboard session={session} onLogout={handleLogout} />
}