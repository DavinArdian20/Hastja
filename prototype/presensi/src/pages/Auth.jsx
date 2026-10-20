import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Btn, Input, Msg } from '../components/ui'

export default function Auth() {
  const [mode, setMode] = useState('login')
  const [f, setF] = useState({ email: '', password: '', nama: '', divisi: '' })
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setMsg(null)
    const { data, error } = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email: f.email, password: f.password })
      : await supabase.auth.signUp({
          email: f.email, password: f.password,
          options: { data: { nama: f.nama, divisi: f.divisi } }
        })
    setBusy(false)
    if (error) return setMsg({ ok: false, text: error.message })
    if (mode === 'register' && !data.session)
      setMsg({ ok: true, text: 'Pendaftaran berhasil. Cek email untuk konfirmasi, lalu masuk.' })
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Presensi Organisasi</h1>
      <form onSubmit={submit} className="flex flex-col gap-3">
        {mode === 'register' && (
          <>
            <Input placeholder="Nama lengkap" value={f.nama} onChange={set('nama')} required />
            <Input placeholder="Divisi" value={f.divisi} onChange={set('divisi')} />
          </>
        )}
        <Input type="email" placeholder="Email" value={f.email} onChange={set('email')} required />
        <Input type="password" placeholder="Kata sandi (min. 6 karakter)" minLength={6} value={f.password} onChange={set('password')} required />
        <Msg msg={msg} />
        <Btn disabled={busy}>{mode === 'login' ? 'Masuk' : 'Daftar'}</Btn>
      </form>
      <button className="text-sm text-teal-800 underline" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setMsg(null) }}>
        {mode === 'login' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
      </button>
    </main>
  )
}
