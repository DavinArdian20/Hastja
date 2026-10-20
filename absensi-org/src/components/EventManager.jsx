import { useState, useEffect, useCallback } from 'react'
import { supabase } from "../lib/supabaseClient";
import { Btn, Card, Input, Msg } from './ui'

export default function EventManager({ profile }) {
  const [events, setEvents] = useState([])
  const [title, setTitle] = useState('')
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [activeQr, setActiveQr] = useState(null) // Untuk pop-up/preview QR

  const isSekretaris = ['Sekretaris', 'sekretaris', 'Wakil Ketua', 'Ketua Umum', 'admin'].includes(profile?.role)

  const fetchEvents = useCallback(async () => {
    const { data } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false })
    setEvents(data || [])
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  // Fungsi Sekretaris Bikin QR Kegiatan Baru
  const handleCreateEvent = async (e) => {
    e.preventDefault()
    if (!title) return

    // Bikin string kode unik otomatis (contoh: HASTJA-1700000000000)
    const uniqueQrCode = `HASTJA-${Date.now()}`

    const { data, error } = await supabase
      .from('events')
      .insert([{ title, qr_code: uniqueQrCode }])
      .select()
      .single()

    if (!error) {
      setMsg({ type: 'success', text: 'QR Presensi Kegiatan berhasil dibuat!' })
      setTitle('')
      setActiveQr(data) // Langsung tampilkan QR yang baru dibuat
      fetchEvents()
    } else {
      setMsg({ type: 'error', text: 'Gagal membuat QR Kegiatan.' })
    }
  }

  if (!isSekretaris) return null

  return (
    <div className="space-y-6">
      {msg.text && <Msg type={msg.type}>{msg.text}</Msg>}

      <Card className="border-[#2C2C2C] bg-[#1E1E1E] space-y-4">
        <h3 className="font-semibold text-white">Buat QR Presensi Kegiatan Baru</h3>
        
        <form onSubmit={handleCreateEvent} className="flex gap-2">
          <Input
            placeholder="Nama Kegiatan (misal: Rapat Pleno 20 Okt)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-xs"
            required
          />
          <Btn type="submit" className="bg-[#E2A053] text-gray-950 font-bold text-xs whitespace-nowrap">
            + Bikin QR
          </Btn>
        </form>
      </Card>

      {/* Tampilan QR yang sedang aktif dipajang */}
      {activeQr && (
        <Card className="border-[#E2A053] bg-[#1E1E1E] text-center space-y-3">
          <h4 className="font-bold text-[#E2A053]">{activeQr.title}</h4>
          <p className="text-xs text-gray-400">Tampilkan QR Code ini di proyektor/layar HP untuk di-scan anggota:</p>
          
          <div className="flex justify-center py-2">
            <div className="p-3 bg-white rounded-xl shadow-lg">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${activeQr.qr_code}`}
                alt="QR Code Presensi"
                className="h-48 w-48"
              />
            </div>
          </div>

          <Btn
            variant="secondary"
            onClick={() => setActiveQr(null)}
            className="text-xs py-1 px-3"
          >
            Tutup Tampilan QR
          </Btn>
        </Card>
      )}

      {/* Daftar Kegiatan yang Sudah Dibuat */}
      <Card className="border-[#2C2C2C] bg-[#1E1E1E] space-y-3">
        <h3 className="font-semibold text-white text-sm">Daftar Kegiatan & QR Code</h3>
        <div className="divide-y divide-[#2C2C2C] max-h-60 overflow-y-auto">
          {events.map((item) => (
            <div key={item.id} className="flex justify-between items-center py-2.5 text-xs">
              <div>
                <p className="font-medium text-white">{item.title}</p>
                <p className="text-[10px] text-gray-400">Kode: {item.qr_code}</p>
              </div>
              <Btn
                onClick={() => setActiveQr(item)}
                className="bg-[#2C2C2C] text-gray-200 hover:bg-gray-700 text-[10px] py-1 px-2.5"
              >
                Tampilkan QR
              </Btn>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}