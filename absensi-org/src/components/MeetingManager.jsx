import { useCallback, useEffect, useState } from 'react'
import { supabase } from "../lib/supabaseClient";
import { Btn, Card, Input, Msg } from './ui'

import * as XLSX from 'xlsx'

// Urutan hirarki resmi organisasi Hastja
const ROLE_HIERARCHY = [
  'Ketua Umum',
  'Wakil Ketua',
  'Sekretaris',
  'Bendahara',
  'Kadiv Acara',
  'Anggota Acara',
  'Kadiv Humas',
  'Anggota Humas',
  'Kadiv PDD',
  'Anggota PDD',
  'Kadiv Logistik',
  'Anggota Logistik',
  'Anggota'
]

const getRoleRank = (role) => {
  if (!role) return 999
  const index = ROLE_HIERARCHY.findIndex(
    (r) => r.toLowerCase() === role.trim().toLowerCase()
  )
  return index === -1 ? 999 : index
}

export default function MeetingManager({ profile }) {
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState({ type: '', text: '' })

  // Form Tambah Rapat
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')
  const [status, setStatus] = useState('Wajib')

  // Notulen
  const [editingNotulenId, setEditingNotulenId] = useState(null)
  const [notulenText, setNotulenText] = useState('')

  // Pop-up / Preview QR
  const [activeQrMeeting, setActiveQrMeeting] = useState(null)
  const [qrDuration, setQrDuration] = useState('30') // Default 30 menit

  const isSekretaris = ['Sekretaris', 'sekretaris', 'Wakil Ketua', 'Ketua Umum', 'admin'].includes(profile?.role)

  const fetchMeetings = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('meetings')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error) {
      setMeetings(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchMeetings()
  }, [fetchMeetings])

  const handleAddMeeting = async (e) => {
    e.preventDefault()
    if (!title || !date || !time || !location) return

    setMsg({ type: '', text: '' })
    const { error } = await supabase.from('meetings').insert([
      { title, date, time, location, status }
    ])

    if (!error) {
      setMsg({ type: 'success', text: 'Jadwal rapat berhasil ditambahkan!' })
      setTitle('')
      setDate('')
      setTime('')
      setLocation('')
      fetchMeetings()
    } else {
      setMsg({ type: 'error', text: `Gagal menambahkan rapat: ${error.message}` })
    }
  }

  // Fungsi Hapus Jadwal Rapat (Khusus Sekretaris)
  const handleDeleteMeeting = async (meetingId, meetingTitle) => {
    if (!window.confirm(`Yakin ingin menghapus rapat "${meetingTitle}"?`)) return

    try {
      setMsg({ type: '', text: '' })
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', meetingId)

      if (!error) {
        setMsg({ type: 'success', text: 'Jadwal rapat berhasil dihapus!' })
        if (activeQrMeeting?.id === meetingId) {
          setActiveQrMeeting(null)
        }
        fetchMeetings()
      } else {
        setMsg({ type: 'error', text: `Gagal menghapus rapat: ${error.message}` })
      }
    } catch (err) {
      console.error(err)
      setMsg({ type: 'error', text: 'Terjadi kesalahan sistem saat menghapus.' })
    }
  }

  // Fungsi Generate QR dengan waktu expired
  const handleGenerateQr = async (meeting) => {
    const minutes = parseInt(qrDuration, 10) || 30
    const qrCode = `HASTJA-MEET-${meeting.id}-${Date.now()}`
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString()

    const { error } = await supabase
      .from('meetings')
      .update({ qr_code: qrCode, qr_expires_at: expiresAt })
      .eq('id', meeting.id)

    if (!error) {
      setMsg({ type: 'success', text: `QR Absen dibuat! Berlaku selama ${minutes} menit.` })
      const updatedMeeting = { ...meeting, qr_code: qrCode, qr_expires_at: expiresAt }
      setActiveQrMeeting(updatedMeeting)
      fetchMeetings()
    } else {
      setMsg({ type: 'error', text: `Gagal generate QR: ${error.message}` })
    }
  }

  const handleSaveNotulen = async (meetingId) => {
    try {
      setMsg({ type: '', text: '' })
      const { error } = await supabase
        .from('meetings')
        .update({ notulen: notulenText })
        .eq('id', meetingId)

      if (!error) {
        setMsg({ type: 'success', text: 'Notulen rapat berhasil diperbarui!' })
        setEditingNotulenId(null)
        setNotulenText('')
        fetchMeetings()
      } else {
        setMsg({ type: 'error', text: `Gagal menyimpan: ${error.message}` })
      }
    } catch (err) {
      setMsg({ type: 'error', text: 'Terjadi kesalahan sistem saat menyimpan.' })
    }
  }

  // Fungsi Ekspor Data Absensi ke Excel Terurut Berdasarkan Hirarki Jabatan
  const handleExportExcel = async (meeting) => {
    try {
      setMsg({ type: 'info', text: 'Sedang mengunduh data absensi...' })

      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('*')

      if (profErr) throw profErr

      const { data: attendances, error: attErr } = await supabase
        .from('attendances')
        .select('*')
        .eq('event_id', meeting.id)

      if (attErr) throw attErr

      const attendedUserIds = new Set(attendances.map((a) => a.user_id))
      const attendanceMap = new Map(attendances.map((a) => [a.user_id, a.created_at]))

      const sortedProfiles = [...(profiles || [])].sort((a, b) => {
        return getRoleRank(a.role) - getRoleRank(b.role)
      })

      const excelData = sortedProfiles.map((userProfile, index) => {
        const uid = userProfile.user_id || userProfile.id
        const isPresent = attendedUserIds.has(uid)
        const attendTime = attendanceMap.get(uid)

        return {
          'No': index + 1,
          'Nama Lengkap': userProfile.nama || userProfile.full_name || '-',
          'Jabatan / Role': userProfile.role || 'Anggota',
          'Email / Username': userProfile.email || userProfile.username || '-',
          'Status Presensi': isPresent ? 'HADIR' : 'TIDAK HADIR',
          'Waktu Scan': attendTime
            ? new Date(attendTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
            : '-'
        }
      })

      const worksheet = XLSX.utils.json_to_sheet(excelData)

      worksheet['!cols'] = [
        { wch: 6 },
        { wch: 25 },
        { wch: 22 },
        { wch: 25 },
        { wch: 18 },
        { wch: 15 }
      ]

      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Absensi Rapat')

      const cleanTitle = meeting.title.replace(/[^a-zA-Z0-9]/g, '_')
      const fileName = `Absensi_${cleanTitle}.xlsx`
      XLSX.writeFile(workbook, fileName)

      setMsg({ type: 'success', text: `Berhasil mengunduh file ${fileName}` })
    } catch (err) {
      console.error('Export Error:', err)
      setMsg({ type: 'error', text: 'Gagal mengekspor data ke Excel.' })
    }
  }

  const isExpired = (expiresAt) => {
    if (!expiresAt) return true
    return new Date() > new Date(expiresAt)
  }

  return (
    <div className="space-y-6">
      {msg.text && <Msg type={msg.type}>{msg.text}</Msg>}

      {/* Pop-up QR Code */}
      {activeQrMeeting && (
        <Card className="border-[#E2A053] bg-[#121212] text-center space-y-4">
          <div>
            <h3 className="text-lg font-bold text-[#E2A053]">{activeQrMeeting.title}</h3>
            <p className="text-xs text-gray-400">QR Absensi Rapat</p>
          </div>

          {isExpired(activeQrMeeting.qr_expires_at) ? (
            <div className="py-6 space-y-2">
              <span className="inline-block rounded-full bg-[#8A3931]/30 border border-[#8A3931] px-4 py-1 text-xs text-red-300 font-bold">
                ⛔ QR Code Sudah Kadaluarsa
              </span>
              <p className="text-xs text-gray-400">Silakan generate ulang untuk membuka absensi baru.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-center py-2">
                <div className="p-3 bg-white rounded-xl shadow-lg">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${activeQrMeeting.qr_code}`}
                    alt="QR Absensi Rapat"
                    className="h-48 w-48"
                  />
                </div>
              </div>
              <p className="text-xs text-green-400 font-medium">
                ⏳ Berlaku sampai:{' '}
                {new Date(activeQrMeeting.qr_expires_at).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                WIB
              </p>
            </div>
          )}

          <div className="flex justify-center gap-2 pt-2">
            {isSekretaris && (
              <div className="flex items-center gap-2">
                <select
                  value={qrDuration}
                  onChange={(e) => setQrDuration(e.target.value)}
                  className="rounded-lg border border-[#2C2C2C] bg-[#1E1E1E] text-xs px-2 py-1 text-white"
                >
                  <option value="15">15 Menit</option>
                  <option value="30">30 Menit</option>
                  <option value="60">1 Jam</option>
                </select>
                <Btn
                  onClick={() => handleGenerateQr(activeQrMeeting)}
                  className="bg-[#E2A053] text-gray-950 font-bold text-xs py-1 px-3"
                >
                  {activeQrMeeting.qr_code ? 'Buat Ulang QR' : 'Generate QR'}
                </Btn>
              </div>
            )}
            <Btn
              variant="secondary"
              onClick={() => setActiveQrMeeting(null)}
              className="text-xs py-1 px-3"
            >
              Tutup
            </Btn>
          </div>
        </Card>
      )}

      {/* Form Buat Rapat */}
      {isSekretaris && (
        <Card className="border-[#2C2C2C] bg-[#1E1E1E] space-y-4">
          <div className="flex items-center space-x-2 border-b border-[#2C2C2C] pb-3">
            <div className="h-3 w-3 rounded-full bg-[#E2A053]"></div>
            <h3 className="font-semibold text-white">Buat Jadwal Rapat (Sekretaris)</h3>
          </div>

          <form onSubmit={handleAddMeeting} className="space-y-3">
            <Input
              placeholder="Judul Rapat / Agenda"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xs"
              required
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input
                placeholder="Tanggal (misal: 20 Okt)"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="text-xs"
                required
              />
              <Input
                placeholder="Jam (misal: 18:30)"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="text-xs"
                required
              />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-lg border border-[#2C2C2C] bg-[#121212] px-2 text-xs text-white"
              >
                <option value="Wajib">Wajib</option>
                <option value="Tentatif">Tentatif</option>
                <option value="Selesai">Selesai</option>
              </select>
            </div>
            <Input
              placeholder="Lokasi / Link Meet"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="text-xs"
              required
            />
            <Btn type="submit" className="w-full bg-[#E2A053] text-gray-950 hover:bg-[#d49142] text-xs font-bold py-2">
              + Publis Jadwal Rapat
            </Btn>
          </form>
        </Card>
      )}

      {/* Daftar Rapat */}
      <Card className="border-[#2C2C2C] bg-[#1E1E1E] space-y-4">
        <div className="flex items-center space-x-2 border-b border-[#2C2C2C] pb-3">
          <div className="h-3 w-3 rounded-full bg-[#2F4879]"></div>
          <h2 className="font-semibold text-white">Jadwal Rapat & Agenda</h2>
        </div>

        {loading ? (
          <p className="text-xs text-gray-400">Memuat jadwal rapat...</p>
        ) : meetings.length === 0 ? (
          <p className="text-xs text-gray-400">Belum ada agenda rapat mendatang.</p>
        ) : (
          <div className="space-y-4">
            {meetings.map((item) => {
              const hasQr = Boolean(item.qr_code)
              const expired = isExpired(item.qr_expires_at)

              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-[#2C2C2C] bg-[#121212] p-4 space-y-3 transition-all hover:border-gray-700"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-medium text-white">{item.title}</h4>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          item.status === 'Wajib'
                            ? 'border border-[#8A3931] bg-[#8A3931]/40 text-red-300'
                            : item.status === 'Selesai'
                            ? 'border border-green-800 bg-green-950/60 text-green-300'
                            : 'bg-[#2C2C2C] text-gray-300'
                        }`}
                      >
                        {item.status}
                      </span>
                      {/* Tombol Hapus Rapat */}
                      {isSekretaris && (
                        <button
                          onClick={() => handleDeleteMeeting(item.id, item.title)}
                          title="Hapus Rapat"
                          className="rounded border border-red-900/60 bg-red-950/40 p-1 text-red-400 hover:bg-red-900/50 hover:text-red-200 transition-all text-xs"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-gray-400">
                    <p>📅 {item.date} • {item.time}</p>
                    <p>📍 {item.location}</p>
                  </div>

                  {/* Tombol QR Absensi & Ekspor Excel */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#2C2C2C] pt-2.5">
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-semibold text-gray-400">Status Absen:</span>
                      {hasQr && !expired ? (
                        <span className="text-[10px] text-green-400 font-bold bg-green-950/50 border border-green-800 px-2 py-0.5 rounded">
                          🟢 Active (Scan On)
                        </span>
                      ) : hasQr && expired ? (
                        <span className="text-[10px] text-red-400 font-bold bg-red-950/50 border border-red-800 px-2 py-0.5 rounded">
                          🔴 Expired
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-500">Belum ada QR</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isSekretaris && (
                        <button
                          onClick={() => handleExportExcel(item)}
                          className="rounded border border-green-700 bg-green-950/60 px-2.5 py-1 text-[10px] font-semibold text-green-300 transition-all hover:bg-green-800 hover:text-white"
                        >
                          📊 Ekspor Excel
                        </button>
                      )}
                      <Btn
                        onClick={() => setActiveQrMeeting(item)}
                        className="bg-[#2C2C2C] text-[#E2A053] hover:bg-gray-800 border border-[#2C2C2C] text-[10px] py-1 px-3 font-semibold"
                      >
                        {hasQr ? '📱 Lihat QR Absen' : '📷 Generate QR'}
                      </Btn>
                    </div>
                  </div>

                  {/* Notulen Rapat */}
                  <div className="border-t border-[#2C2C2C] pt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-[#E2A053]">📝 Notulen Rapat:</span>
                      {isSekretaris && editingNotulenId !== item.id && (
                        <button
                          onClick={() => {
                            setEditingNotulenId(item.id)
                            setNotulenText(item.notulen || '')
                          }}
                          className="text-[10px] text-[#E2A053] hover:underline"
                        >
                          {item.notulen ? 'Edit Notulen' : '+ Isi Notulen'}
                        </button>
                      )}
                    </div>

                    {editingNotulenId === item.id ? (
                      <div className="space-y-2 mt-2">
                        <textarea
                          rows={4}
                          value={notulenText}
                          onChange={(e) => setNotulenText(e.target.value)}
                          placeholder="Tuliskan hasil/notulen rapat di sini..."
                          className="w-full rounded-lg border border-[#2C2C2C] bg-[#121212] p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#E2A053]"
                        />
                        <div className="flex space-x-2">
                          <Btn
                            onClick={() => handleSaveNotulen(item.id)}
                            className="bg-green-600 hover:bg-green-500 text-xs py-1 px-3 text-white font-medium"
                          >
                            Simpan Notulen
                          </Btn>
                          <Btn
                            variant="secondary"
                            onClick={() => setEditingNotulenId(null)}
                            className="text-xs py-1 px-3"
                          >
                            Batal
                          </Btn>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-300 bg-[#121212] p-2.5 rounded-md border border-[#2C2C2C] whitespace-pre-line">
                        {item.notulen || 'Belum ada notulen untuk rapat ini.'}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}