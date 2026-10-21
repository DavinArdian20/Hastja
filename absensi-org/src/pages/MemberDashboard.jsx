import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import QRScanner from '../components/QRScanner'
import KasManager from '../components/KasManager'
import MeetingManager from '../components/MeetingManager'
import GalleryManager from '../components/GalleryManager'
import Kepengurusan from '../components/Kepengurusan'
import { Btn, Card, Msg, Tabs, fmt } from '../components/ui'
import logo from '../assets/logo.png'

export default function MemberDashboard({ session, onLogout }) {
  const [activeTab, setActiveTab] = useState('home')
  const [profile, setProfile] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState({ type: '', text: '' })

  const user = session?.user

  const fetchProfileAndHistory = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)

      // 1. Ambil data profil dari database
      let { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .or(`user_id.eq.${user.id},id.eq.${user.id}`)
        .maybeSingle()

      // Jika data profil belum ada di database, buatkan otomatis
      if (!profileData && user) {
        const fallbackName =
          user.user_metadata?.full_name ||
          user.user_metadata?.username ||
          user.email?.split('@')[0]

        const { data: newProfile } = await supabase
          .from('profiles')
          .upsert([
            {
              user_id: user.id,
              nama: fallbackName,
              email: user.email,
              role: 'Anggota',
            },
          ])
          .select()
          .single()

        profileData = newProfile
      }

      setProfile(profileData)

      // 2. Ambil riwayat presensi
      const { data: historyData, error: histErr } = await supabase
        .from('attendances')
        .select('*')
        .eq('user_id', user.id)
        .order('waktu_absen', { ascending: false })

      if (histErr) console.error('Error fetching history:', histErr)

      if (historyData && historyData.length > 0) {
        const eventIds = historyData.map((h) => h.event_id)

        const [{ data: meetingsData }, { data: eventsData }] = await Promise.all([
          supabase.from('meetings').select('id, title').in('id', eventIds),
          supabase.from('events').select('id, nama_event').in('id', eventIds),
        ])

        const formattedHistory = historyData.map((item) => {
          const meeting = meetingsData?.find((m) => m.id === item.event_id)
          const event = eventsData?.find((e) => e.id === item.event_id)
          return {
            ...item,
            title_display: meeting?.title || event?.nama_event || 'Kegiatan / Rapat',
          }
        })

        setHistory(formattedHistory)
      } else {
        setHistory([])
      }
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchProfileAndHistory()
  }, [fetchProfileAndHistory])

  const handleScan = async (qrCodeText) => {
    setMsg({ type: '', text: '' })
    try {
      let { data: event } = await supabase
        .from('meetings')
        .select('*')
        .eq('qr_code', qrCodeText)
        .maybeSingle()

      if (!event) {
        const { data: eData } = await supabase
          .from('events')
          .select('*')
          .eq('qr_code', qrCodeText)
          .maybeSingle()
        event = eData
      }

      if (!event) {
        throw new Error('QR Code tidak valid atau kegiatan tidak ditemukan.')
      }

      if (event.qr_expires_at && new Date() > new Date(event.qr_expires_at)) {
        throw new Error('Waktu presensi habis! QR Code sudah kadaluarsa.')
      }

      const { error: attendErr } = await supabase
        .from('attendances')
        .insert([{ user_id: user.id, event_id: event.id }])

      if (attendErr) {
        if (attendErr.code === '23505') {
          throw new Error('Kamu sudah melakukan presensi untuk kegiatan/rapat ini!')
        }
        throw attendErr
      }

      setMsg({ type: 'success', text: `Berhasil presensi untuk: ${event.title || event.nama_event}` })
      fetchProfileAndHistory()
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Gagal melakukan presensi.' })
    }
  }

  const displayName = profile?.nama || profile?.full_name || user?.user_metadata?.full_name || '-'
  const displayUsername =
    profile?.email ||
    profile?.username ||
    user?.user_metadata?.username ||
    user?.email?.split('@')[0] ||
    '-'

  return (
    <div className="min-h-screen bg-hastja-bg text-white">
      {/* Header Top Bar */}
      <header className="sticky top-0 z-10 border-b border-hastja-border bg-hastja-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <img
              src={logo}
              alt="Logo Hastja"
              className="h-10 w-10 rounded-full border border-hastja-gold/50 bg-white object-cover"
            />
            <div>
              <h1 className="text-base font-bold text-white">{displayName}</h1>
              <p className="text-xs font-semibold uppercase tracking-wide text-hastja-gold">
                {profile?.role || 'Anggota'}
              </p>
            </div>
          </div>
          <Btn
            variant="secondary"
            onClick={onLogout}
            className="border-hastja-border bg-hastja-bg text-xs text-gray-300 hover:bg-hastja-border"
          >
            Keluar
          </Btn>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
        <Tabs
          active={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: 'home', label: 'Beranda' },
            { id: 'structure', label: 'Kepengurusan' },
            { id: 'scan', label: 'Scan QR' },
            { id: 'history', label: 'Riwayat' },
            { id: 'profile', label: 'Profil' },
          ]}
        />

        {msg.text && <Msg type={msg.type}>{msg.text}</Msg>}

        {/* --- TAB 1: BERANDA --- */}
        {activeTab === 'home' && (
          <div className="space-y-6">
            {/* 1. Card Shortcut Presensi */}
            <div className="flex items-center justify-between rounded-xl border border-hastja-navy/60 bg-gradient-to-r from-hastja-navy/40 to-hastja-card p-5 shadow-lg">
              <div>
                <h3 className="font-bold text-white">Siap untuk Presensi?</h3>
                <p className="text-xs text-gray-300">Pindai QR Code kegiatan yang disediakan pengurus.</p>
              </div>
              <button
                onClick={() => setActiveTab('scan')}
                className="rounded-lg bg-hastja-gold px-4 py-2 text-xs font-bold text-gray-950 transition-all hover:bg-[#d49142]"
              >
                Scan Sekarang
              </button>
            </div>

            {/* 2. Manajer Kas */}
            <KasManager profile={profile} />

            {/* 3. Manajer Rapat / Agenda */}
            <MeetingManager profile={profile} />

            {/* 4. Galeri Dokumentasi Kegiatan */}
            <GalleryManager profile={profile} />
          </div>
        )}

        {/* --- TAB 2: KEPENGURUSAN --- */}
        {activeTab === 'structure' && <Kepengurusan />}

        {/* --- TAB 3: SCAN QR --- */}
        {activeTab === 'scan' && (
          <Card className="space-y-4 border-hastja-border bg-hastja-card text-center">
            <div>
              <h2 className="text-lg font-semibold text-white">Presensi Kegiatan</h2>
              <p className="mt-1 text-xs text-gray-400">
                Arahkan kamera ke QR Code yang disediakan admin.
              </p>
            </div>
            <div className="py-2">
              <QRScanner onScan={handleScan} onError={(e) => setMsg({ type: 'error', text: e })} />
            </div>
          </Card>
        )}

        {/* --- TAB 4: RIWAYAT --- */}
        {activeTab === 'history' && (
          <Card className="space-y-4 border-hastja-border bg-hastja-card">
            <h2 className="text-lg font-semibold text-white">Riwayat Kehadiran</h2>
            {loading ? (
              <p className="text-sm text-gray-400">Memuat data...</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-gray-400">Belum ada riwayat presensi.</p>
            ) : (
              <div className="divide-y divide-hastja-border">
                {history.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-white">{item.title_display}</p>
                      <p className="text-xs text-gray-400">{fmt(item.waktu_absen)}</p>
                    </div>
                    <span className="rounded-full border border-green-800 bg-green-950/60 px-2.5 py-1 text-xs font-medium text-green-300">
                      {item.status || 'Hadir'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* --- TAB 5: PROFIL --- */}
        {activeTab === 'profile' && (
          <Card className="space-y-4 border-hastja-border bg-hastja-card">
            <h2 className="text-lg font-semibold text-white">Informasi Akun</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-hastja-border pb-2">
                <span className="text-gray-400">Nama Lengkap</span>
                <span className="font-medium text-white">{displayName}</span>
              </div>
              <div className="flex justify-between border-b border-hastja-border pb-2">
                <span className="text-gray-400">Email / Username</span>
                <span className="font-medium text-white">{displayUsername}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-gray-400">Peran</span>
                <span className="font-medium capitalize text-hastja-gold">{profile?.role || 'Anggota'}</span>
              </div>
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}