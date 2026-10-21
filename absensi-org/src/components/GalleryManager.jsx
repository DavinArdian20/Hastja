import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Btn, Card, Input, Msg } from './ui'

export default function GalleryManager({ profile = {} }) {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [judul, setJudul] = useState('')
  const [deskripsi, setDeskripsi] = useState('')
  const [file, setFile] = useState(null)
  const [fileKey, setFileKey] = useState(Date.now())
  const [msg, setMsg] = useState({ type: '', text: '' })

  // Akses CRUD khusus Admin, BPH (termasuk Wakil Ketua), dan PDD (Kadiv/Anggota)
  const userRole = (profile?.role || '').toLowerCase()
  const allowedRoles = [
    'admin',
    'ketua umum',
    'wakil ketua',
    'ketua',
    'sekretaris',
    'pdd',
    'kadiv pdd',
    'anggota pdd',
    'pubdok',
  ]
  const canUpload = allowedRoles.some((role) => userRole.includes(role))

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

  useEffect(() => {
    if (photos.length > 0 && currentIndex >= photos.length) {
      setCurrentIndex(0)
    }
  }, [photos, currentIndex])

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1))
  }

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1))
  }

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
      setFileKey(Date.now())
      fetchPhotos()
      setCurrentIndex(0)
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Gagal mengunggah foto.' })
    } finally {
      setUploading(false)
    }
  }

  const handleDeletePhoto = async (photo) => {
    if (!photo || !confirm(`Apakah kamu yakin ingin menghapus foto "${photo.judul}"?`)) return

    try {
      setMsg({ type: '', text: '' })
      const { error } = await supabase
        .from('proker_galleries')
        .delete()
        .eq('id', photo.id)

      if (error) throw error

      setMsg({ type: 'success', text: 'Foto kegiatan berhasil dihapus.' })
      fetchPhotos()
      setCurrentIndex(0)
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Gagal menghapus foto.' })
    }
  }

  const currentPhoto = photos[currentIndex]

  return (
    <Card className="space-y-4 border-hastja-border bg-hastja-card p-4">
      <h3 className="text-base font-bold text-white">Dokumentasi & Foto Kegiatan Proker</h3>

      {canUpload && (
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
            key={fileKey}
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
      )}

      {!canUpload && msg.text && <Msg type={msg.type}>{msg.text}</Msg>}

      {loading ? (
        <p className="text-xs text-gray-400">Memuat dokumentasi...</p>
      ) : photos.length === 0 ? (
        <p className="text-xs text-gray-400">Belum ada foto dokumentasi kegiatan.</p>
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-hastja-border bg-hastja-bg/80 shadow-lg">
          <div className="relative h-60 w-full sm:h-72">
            <img
              src={currentPhoto?.image_url}
              alt={currentPhoto?.judul || 'Foto Kegiatan'}
              className="h-full w-full object-cover"
            />

            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4">
              <div>
                <h4 className="font-bold text-white text-sm sm:text-base">{currentPhoto?.judul}</h4>
                {currentPhoto?.deskripsi && (
                  <p className="mt-0.5 text-xs text-gray-300">{currentPhoto.deskripsi}</p>
                )}
                <p className="mt-1 text-[10px] text-hastja-gold">
                  {currentPhoto?.created_at && new Date(currentPhoto.created_at).toLocaleDateString('id-ID')}
                </p>
              </div>

              {canUpload && currentPhoto && (
                <button
                  type="button"
                  onClick={() => handleDeletePhoto(currentPhoto)}
                  className="rounded border border-red-800 bg-red-950/80 px-2.5 py-1 text-[10px] font-semibold text-red-300 transition-all hover:bg-red-900"
                >
                  Hapus
                </button>
              )}
            </div>

            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prevSlide}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-xs text-white transition-all hover:bg-black/90"
                >
                  &#10094;
                </button>
                <button
                  type="button"
                  onClick={nextSlide}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-xs text-white transition-all hover:bg-black/90"
                >
                  &#10095;
                </button>
              </>
            )}
          </div>

          {photos.length > 1 && (
            <div className="flex justify-center gap-1.5 bg-hastja-card py-2.5">
              {photos.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  className={`h-2 rounded-full transition-all ${
                    index === currentIndex ? 'w-5 bg-hastja-gold' : 'w-2 bg-gray-600'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}