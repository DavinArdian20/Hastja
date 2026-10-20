import { useCallback, useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from "./lib/supabaseClient";
import { Btn, Card, Input, Msg, Tabs, fmt } from '../components/ui'

export default function AdminDashboard() {
  const [tab, setTab] = useState('events')
  return (
    <div className="flex flex-col gap-4">
      <Tabs value={tab} onChange={setTab}
        tabs={[['events', 'Agenda & QR'], ['izin', 'Verifikasi izin'], ['rekap', 'Rekap absensi']]} />
      {tab === 'events' && <EventsTab />}
      {tab === 'izin' && <PermissionsTab />}
      {tab === 'rekap' && <RekapTab />}
    </div>
  )
}

function EventsTab() {
  const empty = { nama_event: '', tanggal: '', latitude: '', longitude: '', radius_meter: 100 }
  const [f, setF] = useState(empty)
  const [events, setEvents] = useState([])
  const [qr, setQr] = useState(null)
  const [msg, setMsg] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const load = useCallback(async () => {
    const { data } = await supabase.from('events').select('*').order('tanggal', { ascending: false })
    setEvents(data ?? [])
  }, [])
  useEffect(() => { load() }, [load])

  const useMyLocation = () =>
    navigator.geolocation.getCurrentPosition(
      (p) => setF((s) => ({ ...s, latitude: p.coords.latitude.toFixed(6), longitude: p.coords.longitude.toFixed(6) })),
      () => setMsg({ ok: false, text: 'Izin lokasi ditolak. Isi koordinat manual.' }),
      { enableHighAccuracy: true }
    )

  const create = async (e) => {
    e.preventDefault()
    const { error } = await supabase.from('events').insert({
      nama_event: f.nama_event,
      tanggal: new Date(f.tanggal).toISOString(),
      latitude: Number(f.latitude), longitude: Number(f.longitude),
      radius_meter: Number(f.radius_meter)
    })
    if (error) return setMsg({ ok: false, text: error.message })
    setMsg({ ok: true, text: 'Agenda dibuat.' }); setF(empty); load()
  }

  const remove = async (id) => {
    if (!confirm('Hapus agenda ini beserta data presensinya?')) return
    await supabase.from('events').delete().eq('id', id); load()
  }

  return (
    <>
      <Card>
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Input placeholder="Nama agenda" value={f.nama_event} onChange={set('nama_event')} required /></div>
          <div className="sm:col-span-2"><Input type="datetime-local" value={f.tanggal} onChange={set('tanggal')} required /></div>
          <Input type="number" step="any" placeholder="Latitude" value={f.latitude} onChange={set('latitude')} required />
          <Input type="number" step="any" placeholder="Longitude" value={f.longitude} onChange={set('longitude')} required />
          <Input type="number" min="10" placeholder="Radius (meter)" value={f.radius_meter} onChange={set('radius_meter')} required />
          <Btn type="button" variant="ghost" onClick={useMyLocation}>Pakai lokasiku sekarang</Btn>
          <div className="sm:col-span-2"><Msg msg={msg} /></div>
          <Btn className="sm:col-span-2">Buat agenda</Btn>
        </form>
      </Card>

      {events.map((ev) => (
        <Card key={ev.id}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium">{ev.nama_event}</p>
              <p className="text-xs text-stone-600">{fmt(ev.tanggal)} · radius {ev.radius_meter} m</p>
            </div>
            <div className="flex gap-2">
              <Btn variant="ghost" onClick={() => setQr(qr === ev.id ? null : ev.id)}>{qr === ev.id ? 'Tutup QR' : 'Tampilkan QR'}</Btn>
              <Btn variant="danger" onClick={() => remove(ev.id)}>Hapus</Btn>
            </div>
          </div>
          {qr === ev.id && (
            <div className="mt-4 flex flex-col items-center gap-2">
              <QRCodeSVG value={ev.qr_code_key} size={240} marginSize={2} />
              <p className="text-xs text-stone-600">Tampilkan di layar/proyektor saat acara berlangsung.</p>
            </div>
          )}
        </Card>
      ))}
    </>
  )
}

function PermissionsTab() {
  const [rows, setRows] = useState([])
  const load = useCallback(async () => {
    const { data } = await supabase
      .from('permissions')
      .select('*, profiles(nama, divisi), events(nama_event, tanggal)')
      .order('created_at', { ascending: false })
    setRows(data ?? [])
  }, [])
  useEffect(() => { load() }, [load])

  const decide = async (id, status_approval) => {
    await supabase.from('permissions').update({ status_approval }).eq('id', id)
    load()
  }

  if (!rows.length) return <p className="text-sm text-stone-600">Belum ada pengajuan izin.</p>
  return rows.map((r) => (
    <Card key={r.id}>
      <p className="font-medium">{r.profiles?.nama} <span className="text-xs font-normal text-stone-600">({r.jenis})</span></p>
      <p className="text-xs text-stone-600">{r.events?.nama_event} · {fmt(r.events?.tanggal)}</p>
      <p className="my-2 text-sm">{r.alasan}</p>
      {r.status_approval === 'pending' ? (
        <div className="flex gap-2">
          <Btn onClick={() => decide(r.id, 'approved')}>Setujui</Btn>
          <Btn variant="danger" onClick={() => decide(r.id, 'rejected')}>Tolak</Btn>
        </div>
      ) : (
        <p className="text-sm font-medium">{r.status_approval === 'approved' ? 'Disetujui' : 'Ditolak'}</p>
      )}
    </Card>
  ))
}

function RekapTab() {
  const [rows, setRows] = useState([])
  useEffect(() => {
    supabase.from('attendances')
      .select('status, waktu_absen, jarak_meter, profiles(nama, divisi), events(nama_event, tanggal)')
      .order('waktu_absen', { ascending: false })
      .then(({ data }) => setRows(data ?? []))
  }, [])

  const exportCsv = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const head = ['Nama', 'Divisi', 'Agenda', 'Tanggal agenda', 'Status', 'Waktu absen', 'Jarak (m)']
    const body = rows.map((r) => [r.profiles?.nama, r.profiles?.divisi, r.events?.nama_event,
      r.events?.tanggal, r.status, r.waktu_absen, r.jarak_meter].map(esc).join(','))
    const blob = new Blob(['\ufeff' + [head.map(esc).join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = 'rekap-presensi.csv'; a.click()
  }

  return (
    <>
      <Btn onClick={exportCsv} disabled={!rows.length} className="self-start">Ekspor CSV</Btn>
      <div className="overflow-x-auto rounded-lg bg-white ring-1 ring-stone-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-50 text-xs text-stone-600">
            <tr><th className="p-2">Nama</th><th className="p-2">Agenda</th><th className="p-2">Status</th><th className="p-2">Waktu</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-stone-100">
                <td className="p-2">{r.profiles?.nama}</td>
                <td className="p-2">{r.events?.nama_event}</td>
                <td className="p-2">{r.status}</td>
                <td className="p-2 whitespace-nowrap">{fmt(r.waktu_absen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
