import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Btn, Card, Input, Msg } from './ui'

export default function GalleryManager({ profile }) {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [judul, setJudul] = useState('')
  const [deskripsi, setDeskripsi] = useState('')
  const [file, setFile] = useState(null)
  const [msg, setMsg] = useState({ type: '', text: '' })

  const fetchPhotos = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('proker_galleries')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setPhotos(data || [])
    } catch (err) {
      console.error('Error fetching gallery:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPhotos()
  }, [])

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) return setMsg({ type: 'error', text: 'Pilih foto terlebih dahulu!' })

    try {
      setUploading(true)
      setMsg({ type: '', text: '' })

      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `documentation/${fileName}`

      const { error: storageErr } = await supabase.storage
        .from('proker-photos')
        .upload(filePath, file)

      if (storageErr) throw storageErr

      const { data: urlData } = supabase.storage
        .from('proker-photos')
        .getPublicUrl(filePath)

      const { error: dbErr } = await supabase.from('proker_galleries').insert([
        {
          judul,
          deskripsi,
          image_url: urlData.publicUrl,
        },
      ])

      if (dbErr) throw dbErr

      setMsg({ type: 'success', text: 'Foto kegiatan berhasil diunggah!' })
      setJudul('')
      setDeskripsi('')
      setFile(null)
      fetchPhotos()
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Gagal mengunggah foto.' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card className="space-y-4 border-hastja-border bg-hastja-card p-4">
      <h3 className="text-base font-bold text-white">Dokumentasi & Foto Kegiatan Proker</h3>

      {/* Form Upload - Dapat diakses oleh semua role */}
      <form onSubmit={handleUpload} className="space-y-3 rounded-lg border border-hastja-border bg-hastja-bg/50 p-3">
        <p className="text-xs font-medium text-gray-300">Unggah Dokumentasi Baru</p>
        {msg.text && <Msg type={msg.type}>{msg.text}</Msg>}
        <Input
          placeholder="Nama Kegiatan / Judul Foto"
          value={judul}
          onChange={(e) => setJudul(e.target.value)}
          required
        />
        <Input
          placeholder="Keterangan / Deskripsi (opsional)"
          value={deskripsi}
          onChange={(e) => setDeskripsi(e.target.value)}
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files[0])}
          required
          className="w-full text-xs text-gray-300 file:mr-4 file:rounded-lg file:border-0 file:bg-hastja-gold file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-black hover:file:bg-[#d49142]"
        />
        <Btn type="submit" disabled={uploading} className="w-full text-xs">
          {uploading ? 'Mengunggah...' : 'Unggah Foto'}
        </Btn>
      </form>

      {/* Grid Foto Kegiatan */}
      {loading ? (
        <p className="text-xs text-gray-400">Memuat dokumentasi...</p>
      ) : photos.length === 0 ? (
        <p className="text-xs text-gray-400">Belum ada foto dokumentasi kegiatan.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {photos.map((item) => (
            <div
              key={item.id}
              className="overflow-hidden rounded-lg border border-hastja-border bg-hastja-bg/60 shadow"
            >
              <img
                src={item.image_url}
                alt={item.judul}
                className="h-36 w-full object-cover"
              />
              <div className="p-2.5">
                <h4 className="font-semibold text-white text-xs">{item.judul}</h4>
                {item.deskripsi && (
                  <p className="mt-0.5 text-[11px] text-gray-400">{item.deskripsi}</p>
                )}
                <p className="mt-1 text-[10px] text-gray-500">
                  {new Date(item.created_at).toLocaleDateString('id-ID')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}