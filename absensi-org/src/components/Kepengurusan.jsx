import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Kepengurusan() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStructure = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase.from('profiles').select('*')
        if (error) throw error
        setMembers(data || [])
      } catch (err) {
        console.error('Error fetching kepengurusan:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStructure()
  }, [])

  // Helper pencarian role spesifik (menghindari kata 'Wakil' terbaca sebagai 'Ketua')
  const getMemberByRole = (roleKeywords, excludeKeywords = []) => {
    return members.find((m) => {
      const r = (m.role || '').toLowerCase()
      const matches = roleKeywords.some((kw) => r.includes(kw.toLowerCase()))
      const excluded = excludeKeywords.some((ex) => r.includes(ex.toLowerCase()))
      return matches && !excluded
    })
  }

  const getMembersByRoles = (roleKeywords) => {
    return members.filter((m) => {
      const r = (m.role || '').toLowerCase()
      return roleKeywords.some((kw) => r.includes(kw.toLowerCase()))
    })
  }

  // Fallback foto profil
  const getPhotoUrl = (m) => {
    if (m?.foto_url) return m.foto_url
    if (m?.avatar_url) return m.avatar_url
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(
      m?.nama || 'User'
    )}&background=18181b&color=d49142&bold=true&length=2`
  }

  // Data Pejabat Utama BPH
  const ketua = getMemberByRole(['ketua umum', 'ketua'], ['wakil'])
  const wakil = getMemberByRole(['wakil ketua', 'wakil'])
  const sekretaris = getMemberByRole(['sekretaris'])
  const bendahara = getMemberByRole(['bendahara'])

  // Data Divisi Organisasi
  const divisions = [
    { name: 'Divisi PDD', keywords: ['pdd', 'pubdok'] },
    { name: 'Divisi Acara', keywords: ['acara'] },
    { name: 'Divisi Humas', keywords: ['humas'] },
    { name: 'Divisi Logistik', keywords: ['logistik'] },
  ]

  // Card Node Anggota & Pengurus (Dibuat SERAGAM 100% untuk semua posisi)
  const MemberNode = ({ member }) => {
    if (!member) return null
    return (
      <div className="group relative aspect-[3/4] w-32 sm:w-36 overflow-hidden rounded-xl border border-hastja-gold/50 bg-hastja-card shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-hastja-gold hover:shadow-hastja-gold/20">
        <img
          src={getPhotoUrl(member)}
          alt={member.nama}
          className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-x-0 bottom-0 flex flex-col justify-end bg-gradient-to-t from-black/95 via-black/50 to-transparent p-2 text-center">
          <p className="truncate text-xs font-bold text-white sm:text-sm">
            {member.nama}
          </p>
          <span className="mt-0.5 inline-block rounded border border-hastja-gold/40 bg-hastja-gold/20 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-hastja-gold truncate">
            {member.role}
          </span>
        </div>
      </div>
    )
  }

  // Placeholder Kosong (Ukuran & Bentuk Presisi 100% Sama dengan MemberNode)
  const EmptyNode = ({ label }) => (
    <div className="flex aspect-[3/4] w-32 sm:w-36 flex-col items-center justify-center rounded-xl border border-dashed border-hastja-border bg-hastja-bg/40 p-2 text-center shadow">
      <p className="text-[10px] font-bold uppercase tracking-wider text-hastja-gold">
        {label}
      </p>
      <p className="mt-1 text-[9px] text-gray-500">Belum diisi</p>
    </div>
  )

  return (
    <div className="space-y-8">
      {/* Header Judul */}
      <div className="space-y-1 text-center">
        <h2 className="text-xl font-extrabold tracking-wide text-white sm:text-2xl">
          Struktur Kepengurusan
        </h2>
        <p className="text-xs text-gray-400">
          Pohon Hierarki Organisasi Hastja
        </p>
      </div>

      {loading ? (
        <p className="py-8 text-center text-xs text-gray-400">
          Memuat data kepengurusan...
        </p>
      ) : members.length === 0 ? (
        <p className="py-8 text-center text-xs text-gray-400">
          Belum ada data pengurus di database.
        </p>
      ) : (
        /* Container Pohon Hierarki (Bisa Di-scroll horizontal jika di layar HP) */
        <div className="overflow-x-auto pb-8 pt-4">
          <div className="flex min-w-[720px] flex-col items-center space-y-2">
            
            {/* LEVEL 1: KETUA UMUM */}
            <div className="flex flex-col items-center">
              {ketua ? <MemberNode member={ketua} /> : <EmptyNode label="Ketua Umum" />}
              <div className="h-6 w-0.5 bg-hastja-gold/60"></div>
            </div>

            {/* LEVEL 2: WAKIL KETUA */}
            <div className="flex flex-col items-center">
              {wakil ? <MemberNode member={wakil} /> : <EmptyNode label="Wakil Ketua" />}
              <div className="h-6 w-0.5 bg-hastja-gold/60"></div>
            </div>

            {/* LEVEL 3: SEKRETARIS & BENDAHARA */}
            <div className="flex w-full flex-col items-center">
              <div className="relative flex w-72 items-center justify-center sm:w-80">
                <div className="absolute top-0 h-0.5 w-full bg-hastja-gold/60"></div>
              </div>

              <div className="flex w-80 justify-around pt-2 sm:w-[380px]">
                <div className="relative flex flex-col items-center">
                  <div className="absolute -top-2 h-2 w-0.5 bg-hastja-gold/60"></div>
                  {sekretaris ? <MemberNode member={sekretaris} /> : <EmptyNode label="Sekretaris" />}
                </div>

                <div className="relative flex flex-col items-center">
                  <div className="absolute -top-2 h-2 w-0.5 bg-hastja-gold/60"></div>
                  {bendahara ? <MemberNode member={bendahara} /> : <EmptyNode label="Bendahara" />}
                </div>
              </div>

              <div className="my-2 h-8 w-0.5 bg-hastja-gold/60"></div>
            </div>

            {/* LEVEL 4: DIVISI-DIVISI & ANGGOTA */}
            <div className="w-full space-y-2">
              <div className="text-center">
                <span className="rounded-full border border-hastja-gold/30 bg-hastja-gold/10 px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-hastja-gold">
                  Jajaran Divisi & Anggota
                </span>
              </div>

              {/* Garis Cabang Utama Divisi */}
              <div className="relative flex w-full items-center justify-center pt-3">
                <div className="absolute top-3 h-0.5 w-[85%] bg-hastja-border"></div>
              </div>

              <div className="grid grid-cols-4 gap-4 pt-3">
                {divisions.map((div) => {
                  const divMembers = getMembersByRoles(div.keywords)
                  const kadiv = divMembers.find((m) =>
                    (m.role || '').toLowerCase().includes('kadiv')
                  )
                  const anggotaList = divMembers.filter(
                    (m) => !(m.role || '').toLowerCase().includes('kadiv')
                  )

                  return (
                    <div
                      key={div.name}
                      className="relative flex flex-col items-center"
                    >
                      {/* Garis Penghubung Atas */}
                      <div className="absolute -top-3 h-3 w-0.5 bg-hastja-border"></div>

                      {/* Kepala Divisi (Kadiv) */}
                      <div className="mb-2 text-center">
                        <p className="mb-1.5 text-[10px] font-bold uppercase text-hastja-gold">
                          {div.name}
                        </p>
                        {kadiv ? <MemberNode member={kadiv} /> : <EmptyNode label="Kadiv" />}
                      </div>

                      {/* Garis Penghubung Kadiv ke Anggota */}
                      <div className="mb-2 h-4 w-0.5 bg-hastja-border"></div>

                      {/* Anggota Divisi */}
                      <div className="flex w-full flex-col items-center space-y-3">
                        {anggotaList.length > 0 ? (
                          anggotaList.map((m) => (
                            <MemberNode key={m.id || m.user_id} member={m} />
                          ))
                        ) : (
                          <EmptyNode label="Anggota" />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}