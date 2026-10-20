import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import QRScanner from '../components/QRScanner'
import { Btn, Card, Msg, Tabs, fmt } from '../components/ui'

export default function MemberDashboard({ profile }) {
  const [tab, setTab] = useState('scan')
  return (
    <div className="flex flex-col gap-4">
      <Tabs value={tab} onChange={setTab}
        tabs={[['scan', 'Scan presensi'], ['izin', 'Ajukan izin'], ['riwayat', 'Riwayat']]} />
      {tab === 'scan' && <ScanTab />}
      {tab === 'izin' && <PermissionTab userId={profile.user_id} />}
      {tab === 'riwayat' && <HistoryTab userId={profile.user_id} />}
    </div>
  )
}

function ScanTab() {
  const [scanning, setScanning] = useState(false)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const handleScan = (qrKey) => {
    setScanning(false); setBusy(true); setMsg(null)
    if (!navigator.geolocation) { setBusy(false); return setMsg({ ok: false, text: 'Perangkat tidak mendukung GPS.' }) }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { data, error } = await supabase.rpc('submit_attendance', {
          p_qr_key: qrKey, p_lat: coords.latitude, p_lng: coords.longitude
        })
        setBusy(false)
        setMsg(error
          ? { ok: false, text: error.message }
          : { ok: true, text: `Presensi tercatat: ${data.event} (${data.jarak_meter} m dari titik lokasi).` })
      },
      () => { setBusy(false); setMsg({ ok: false, text: 'Lokasi tidak terbaca. Aktifkan GPS dan izinkan akses lokasi.' }) },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  return (
    <Card className="flex flex-col gap-3">
      {scanning
        ? <QRScanner onScan={handleScan} onError={(t) => { setScanning(false); setMsg({ ok: false, text: t }) }} />
        : <Btn disabled={busy} onClick={() => { setMsg(null); setScanning(true) }}>{busy ? 'Memeriksa lokasi…' : 'Buka kamera & scan QR'}</Btn>}
      {scanning && <Btn variant="ghost" onClick={() => setScanning(false)}>Batal</Btn>}
      <Msg msg={msg} />
    </Card>
  )
}

function PermissionTab({ userId }) {
  const [events, setEvents] = useState([])
  const [mine, setMine] = useState([])
  const [f, setF] = useState({ event_id: '', jenis: 'izin', alasan: '' })
  const [msg, setMsg] = useState(null)

  const load = useCallback(async () => {
    const [ev, pm] = await Promise.all([
      supabase.from('events_public').select('id, nama_event, tanggal')
        .gte('tanggal', new Date(Date.now() - 6 * 3600e3).toISOString()).order('tanggal'),
      supabase.from('permissions').select('*, events(nama_event)').eq('user_id', userId).order('created_at', { ascending: false })
    ])
    setEvents(ev.data ?? []); setMine(pm.data ?? [])
  }, [userId])
  useEffect(() => { load() }, [load])

  const submit = async (e) => {
    e.preventDefault()
    const { error } = await supabase.from('permissions').insert({ ...f, user_id: userId })
    if (error) return setMsg({ ok: false, text: error.code === '23505' ? 'Kamu sudah mengajukan izin untuk agenda ini.' : error.message })
    setMsg({ ok: true, text: 'Pengajuan terkirim, menunggu verifikasi pengurus.' })
    setF({ event_id: '', jenis: 'izin', alasan: '' }); load()
  }

  const label = { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak' }
  const sel = 'rounded-md border border-stone-300 bg-white px-3 py-2 text-sm'

  return (
    <>
      <Card>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <select required value={f.event_id} onChange={(e) => setF({ ...f, event_id: e.target.value })} className={sel}>
            <option value="">Pilih agenda</option>
            {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.nama_event} — {fmt(ev.tanggal)}</option>)}
          </select>
          <select value={f.jenis} onChange={(e) => setF({ ...f, jenis: e.target.value })} className={sel}>
            <option value="izin">Izin</option><option value="sakit">Sakit</option>
          </select>
          <textarea required rows={3} placeholder="Alasan" value={f.alasan}
            onChange={(e) => setF({ ...f, alasan: e.target.value })} className={sel} />
          <Msg msg={msg} />
          <Btn>Kirim pengajuan</Btn>
        </form>
      </Card>
      {mine.map((p) => (
        <Card key={p.id}>
          <p className="text-sm font-medium">{p.events?.nama_event ?? 'Agenda'} · {p.jenis}</p>
          <p className="text-sm text-stone-600">{p.alasan}</p>
          <p className="mt-1 text-xs font-medium">{label[p.status_approval]}</p>
        </Card>
      ))}
    </>
  )
}

function HistoryTab({ userId }) {
  const [att, setAtt] = useState([])
  const [events, setEvents] = useState([])

  useEffect(() => {
    supabase.from('attendances').select('*').eq('user_id', userId).order('waktu_absen', { ascending: false })
      .then(({ data }) => setAtt(data ?? []))
    // Hanya agenda yang sudah lewat dihitung sebagai penyebut persentase.
    supabase.from('events_public').select('id, nama_event, tanggal')
      .lte('tanggal', new Date().toISOString())
      .then(({ data }) => setEvents(data ?? []))
  }, [userId])

  const total = events.length
  const hadir = att.filter((a) => a.status === 'hadir' && events.some((e) => e.id === a.event_id)).length
  const pct = total ? Math.round((hadir / total) * 100) : 0
  const nameOf = (id) => events.find((e) => e.id === id)?.nama_event ?? 'Agenda'

  return (
    <>
      <Card>
        <p className="text-3xl font-semibold">{pct}%</p>
        <p className="text-sm text-stone-600">Hadir {hadir} dari {total} agenda yang sudah berlangsung</p>
      </Card>
      {att.map((a) => (
        <Card key={a.id} className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{nameOf(a.event_id)}</p>
            <p className="text-xs text-stone-600">{fmt(a.waktu_absen)}</p>
          </div>
          <span className="text-sm font-medium">{a.status}</span>
        </Card>
      ))}
    </>
  )
}
