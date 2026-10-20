import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import Auth from './pages/Auth'
import AdminDashboard from './pages/AdminDashboard'
import MemberDashboard from './pages/MemberDashboard'
import { Btn } from './components/ui'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = masih memuat
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return setProfile(null)
    supabase.from('profiles').select('*').eq('user_id', session.user.id).single()
      .then(({ data }) => setProfile(data))
  }, [session])

  if (session === undefined) return <p className="p-6 text-sm">Memuat…</p>
  if (!session) return <Auth />
  if (!profile) return <p className="p-6 text-sm">Memuat profil…</p>

  return (
    <div className="mx-auto min-h-screen max-w-3xl p-4">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{profile.nama}</h1>
          <p className="text-xs text-stone-600">{profile.role === 'admin' ? 'Pengurus' : 'Anggota'}{profile.divisi ? ` · ${profile.divisi}` : ''}</p>
        </div>
        <Btn variant="ghost" onClick={() => supabase.auth.signOut()}>Keluar</Btn>
      </header>
      {profile.role === 'admin' ? <AdminDashboard /> : <MemberDashboard profile={profile} />}
    </div>
  )
}
