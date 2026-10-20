import { useState } from 'react'
import { supabase } from '../lib/supabaseClient';
import { Btn, Input, Msg } from '../components/ui'

export default function Auth({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState({ type: '', text: '' })

  // Trik mengubah username menjadi format internal untuk Supabase Auth
  const formatUsernameToEmail = (user) => {
    const cleanUser = user.trim().toLowerCase().replace(/\s+/g, '')
    return `${cleanUser}@hastja2026.com`
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMsg({ type: '', text: '' })

    const internalEmail = formatUsernameToEmail(username)

    try {
      if (isRegister) {
        // --- PROSES DAFTAR (REGISTER) ---
        const { data, error } = await supabase.auth.signUp({
          email: internalEmail,
          password: password,
          options: {
            data: {
              full_name: fullName,
              username: username.trim(),
            },
          },
        })

        if (error) throw error

        // Buat record profil di tabel profiles
        if (data?.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([
              {
                id: data.user.id,
                full_name: fullName,
                username: username.trim(),
                role: 'member', // Default pendaftar baru sebagai anggota
              },
            ])

          if (profileError && profileError.code !== '23505') { // abaikan jika duplicate key
            console.error('Error insert profile:', profileError)
          }
        }

        setMsg({
          type: 'success',
          text: 'Pendaftaran berhasil! Silakan masuk dengan Username kamu.',
        })
        setIsRegister(false)
        setPassword('')
      } else {
        // --- PROSES MASUK (LOGIN) ---
        const { data, error } = await supabase.auth.signInWithPassword({
          email: internalEmail,
          password: password,
        })

        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            throw new Error('Username atau Password salah!')
          }
          throw error
        }

        if (data?.session) {
          onLogin(data.session)
        }
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Terjadi kesalahan sistem.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 px-4 py-12 text-white">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-gray-800 p-8 shadow-xl border border-gray-700">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">Hastja</h1>
          <p className="mt-2 text-sm text-gray-400">
            {isRegister ? 'Buat akun anggota baru' : 'Masuk menggunakan Username kamu'}
          </p>
        </div>

        {msg.text && <Msg type={msg.type}>{msg.text}</Msg>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Nama Lengkap</label>
              <Input
                type="text"
                placeholder="Contoh: Andika Arya Manggala"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Username</label>
            <Input
              type="text"
              placeholder="Contoh: andika123"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Kata Sandi</label>
            <Input
              type="password"
              placeholder="Minimal 6 karakter"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          <Btn type="submit" className="w-full justify-center py-2.5 mt-2" disabled={loading}>
            {loading ? 'Memproses...' : isRegister ? 'Daftar Akun' : 'Masuk'}
          </Btn>
        </form>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister)
              setMsg({ type: '', text: '' })
            }}
            className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {isRegister
              ? 'Sudah punya akun? Masuk di sini'
              : 'Belum punya akun? Daftar sekarang'}
          </button>
        </div>
      </div>
    </div>
  )
}