import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Btn, Card, Input, Msg, fmt } from './ui'

export default function KasManager({ profile }) {
  const [saldo, setSaldo] = useState(0)
  const [transactions, setTransactions] = useState([])
  const [memberKasList, setMemberKasList] = useState([])
  const [loading, setLoading] = useState(true)

  // Form State Bendahara (Input Manual)
  const [keterangan, setKeterangan] = useState('')
  const [nominal, setNominal] = useState('')
  const [jenis, setJenis] = useState('masuk')

  // Form State Anggota (Kirim Pembayaran)
  const [nominalBayar, setNominalBayar] = useState('')
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [submitting, setSubmitting] = useState(false)

  // Hanya Bendahara dan Admin yang punya akses pengolahan kas
  const userRole = (profile?.role || '').toLowerCase()
  const isBendahara = ['bendahara', 'admin'].includes(userRole)

  const loadKasData = useCallback(async () => {
    try {
      setLoading(true)

      // 1. Ambil Transaksi & Hitung Saldo
      const { data: txData } = await supabase
        .from('kas_transactions')
        .select('*')
        .order('created_at', { ascending: false })

      const txList = txData || []
      setTransactions(txList)

      const totalSaldo = txList.reduce((acc, item) => {
        return item.jenis === 'masuk' ? acc + Number(item.nominal) : acc - Number(item.nominal)
      }, 0)
      setSaldo(totalSaldo)

      // 2. Ambil Daftar Anggota & Status Pembayaran Kas
      const [{ data: profiles }, { data: payments }] = await Promise.all([
        supabase.from('profiles').select('user_id, id, nama, role'),
        supabase.from('kas_payments').select('*').order('created_at', { ascending: false }),
      ])

      if (profiles) {
        const mappedList = profiles.map((p) => {
          const pId = p.user_id || p.id
          const userPay = payments?.find((pay) => pay.user_id === pId)
          return {
            ...p,
            payment_id: userPay?.id || null,
            status: userPay?.status || 'belum_bayar',
            nominal_terakhir: userPay?.nominal || 0,
            bukti_url: userPay?.bukti_url || null,
          }
        })
        setMemberKasList(mappedList)
      }
    } catch (err) {
      console.error('Error loading kas data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadKasData()
  }, [loadKasData])

  // Function Bendahara: Tandai Lunas
  const handleMarkLunas = async (member) => {
    try {
      setSubmitting(true)
      const userId = member.user_id || member.id
      const defaultNominal = member.nominal_terakhir > 0 ? member.nominal_terakhir : 10000

      if (member.payment_id) {
        await supabase
          .from('kas_payments')
          .update({ status: 'approved' })
          .eq('id', member.payment_id)
      } else {
        await supabase.from('kas_payments').insert([
          {
            user_id: userId,
            nominal: defaultNominal,
            status: 'approved',
          },
        ])
      }

      await supabase.from('kas_transactions').insert([
        {
          keterangan: `Pembayaran Kas - ${member.nama}`,
          nominal: defaultNominal,
          jenis: 'masuk',
          created_by: profile?.user_id || profile?.id,
        },
      ])

      setMsg({ type: 'success', text: `Kas ${member.nama} berhasil ditandai LUNAS!` })
      loadKasData()
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Gagal memperbarui status.' })
    } finally {
      setSubmitting(false)
    }
  }

  // Function Bendahara: Batal Lunas (Fitur Koreksi Kepencet)
  const handleMarkBelumLunas = async (member) => {
    try {
      setSubmitting(true)
      const defaultNominal = member.nominal_terakhir > 0 ? member.nominal_terakhir : 10000

      if (member.payment_id) {
        await supabase
          .from('kas_payments')
          .update({ status: 'rejected' })
          .eq('id', member.payment_id)
      }

      // Potong kembali saldo kas yang tadi terlanjur bertambah
      await supabase.from('kas_transactions').insert([
        {
          keterangan: `Pembatalan/Koreksi Kas - ${member.nama}`,
          nominal: defaultNominal,
          jenis: 'keluar',
          created_by: profile?.user_id || profile?.id,
        },
      ])

      setMsg({ type: 'success', text: `Status kas ${member.nama} dikembalikan ke BELUM BAYAR.` })
      loadKasData()
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Gagal membatalkan status.' })
    } finally {
      setSubmitting(false)
    }
  }

  // Function Bendahara: Catat Transaksi Manual
  const handleAddTransaction = async (e) => {
    e.preventDefault()
    if (!nominal || Number(nominal) <= 0) return

    try {
      setSubmitting(true)
      const { error } = await supabase.from('kas_transactions').insert([
        {
          keterangan,
          nominal: Number(nominal),
          jenis,
          created_by: profile?.user_id || profile?.id,
        },
      ])

      if (error) throw error

      setMsg({ type: 'success', text: 'Catatan transaksi kas berhasil disimpan!' })
      setKeterangan('')
      setNominal('')
      loadKasData()
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Gagal menyimpan transaksi.' })
    } finally {
      setSubmitting(false)
    }
  }

  // Function Anggota: Ajukan Pembayaran
  const handleMemberPayment = async (e) => {
    e.preventDefault()
    if (!nominalBayar || Number(nominalBayar) <= 0) return

    try {
      setSubmitting(true)
      const { error } = await supabase.from('kas_payments').insert([
        {
          user_id: profile?.user_id || profile?.id,
          nominal: Number(nominalBayar),
          status: 'pending',
        },
      ])

      if (error) throw error

      setMsg({ type: 'success', text: 'Konfirmasi pembayaran berhasil dikirim ke Bendahara!' })
      setNominalBayar('')
      loadKasData()
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Gagal mengirim konfirmasi.' })
    } finally {
      setSubmitting(false)
    }
  }

  const myStatus = memberKasList.find(
    (m) => (m.user_id || m.id) === (profile?.user_id || profile?.id)
  )?.status

  return (
    <div className="space-y-4">
      {msg.text && <Msg type={msg.type}>{msg.text}</Msg>}

      {/* 1. Ringkasan Saldo Kas */}
      <Card className="border-hastja-border bg-hastja-card p-4">
        <p className="text-xs text-gray-400">Total Saldo Kas Organisasi</p>
        <h2 className="mt-1 text-2xl font-bold text-hastja-gold">
          Rp {saldo.toLocaleString('id-ID')}
        </h2>
      </Card>

      {/* 2. FITUR KHUSUS BENDAHARA */}
      {isBendahara ? (
        <>
          {/* Daftar Status Kas Anggota */}
          <Card className="border-hastja-border bg-hastja-card p-4">
            <h3 className="mb-3 text-sm font-bold text-white">Daftar Status Kas Anggota</h3>
            {loading ? (
              <p className="text-xs text-gray-400">Memuat data anggota...</p>
            ) : memberKasList.length === 0 ? (
              <p className="text-xs text-gray-400">Belum ada data anggota.</p>
            ) : (
              <div className="divide-y divide-hastja-border">
                {memberKasList.map((m) => {
                  const isLunas = m.status === 'approved'
                  const isPending = m.status === 'pending'

                  return (
                    <div key={m.id || m.user_id} className="flex items-center justify-between py-2.5 text-xs">
                      <div>
                        <p className="font-semibold text-white">{m.nama}</p>
                        <p className="text-[10px] text-gray-400 capitalize">{m.role || 'Anggota'}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        {isLunas ? (
                          <div className="flex items-center gap-2">
                            <span className="rounded-full border border-green-800 bg-green-950/60 px-2.5 py-1 text-[10px] font-bold text-green-300">
                              LUNAS
                            </span>
                            <Btn
                              disabled={submitting}
                              variant="danger"
                              onClick={() => handleMarkBelumLunas(m)}
                              className="px-2 py-1 text-[10px]"
                            >
                              Batal / Belum Lunas
                            </Btn>
                          </div>
                        ) : isPending ? (
                          <div className="flex items-center gap-2">
                            <span className="rounded-full border border-yellow-800 bg-yellow-950/60 px-2 py-1 text-[10px] font-bold text-yellow-300">
                              PENDING (Rp {Number(m.nominal_terakhir).toLocaleString('id-ID')})
                            </span>
                            <Btn
                              disabled={submitting}
                              onClick={() => handleMarkLunas(m)}
                              className="px-2 py-1 text-[10px]"
                            >
                              Konfirmasi Lunas
                            </Btn>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="rounded-full border border-red-800 bg-red-950/60 px-2 py-1 text-[10px] font-bold text-red-300">
                              BELUM BAYAR
                            </span>
                            <Btn
                              disabled={submitting}
                              onClick={() => handleMarkLunas(m)}
                              className="border-hastja-border bg-hastja-bg px-2 py-1 text-[10px] text-gray-200 hover:bg-hastja-border"
                            >
                              Tandai Lunas
                            </Btn>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {/* Form Input Catatan Kas Manual */}
          <Card className="border-hastja-border bg-hastja-card p-4">
            <h3 className="mb-3 text-sm font-bold text-white">Catat Pemasukan / Pengeluaran Lain</h3>
            <form onSubmit={handleAddTransaction} className="grid gap-3 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <Input
                  placeholder="Keterangan (contoh: Beli Perlengkapan Proker)"
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  required
                />
              </div>
              <Input
                type="number"
                placeholder="Nominal (Rp)"
                value={nominal}
                onChange={(e) => setNominal(e.target.value)}
                required
              />
              <div className="flex gap-2 sm:col-span-1">
                <select
                  value={jenis}
                  onChange={(e) => setJenis(e.target.value)}
                  className="w-full rounded-lg border border-hastja-border bg-hastja-bg px-2 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="masuk">Masuk</option>
                  <option value="keluar">Keluar</option>
                </select>
                <Btn type="submit" disabled={submitting} className="text-xs">
                  Simpan
                </Btn>
              </div>
            </form>
          </Card>
        </>
      ) : (
        /* 3. FITUR UNTUK ANGOTA & KETUA/SEKRETARIS */
        <Card className="border-hastja-border bg-hastja-card p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Status Kas Saya</h3>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                myStatus === 'approved'
                  ? 'border border-green-800 bg-green-950/60 text-green-300'
                  : myStatus === 'pending'
                  ? 'border border-yellow-800 bg-yellow-950/60 text-yellow-300'
                  : 'border border-red-800 bg-red-950/60 text-red-300'
              }`}
            >
              {myStatus === 'approved'
                ? 'LUNAS'
                : myStatus === 'pending'
                ? 'MENUNGGU KONFIRMASI BENDAHARA'
                : 'BELUM BAYAR'}
            </span>
          </div>

          {myStatus !== 'approved' && (
            <form onSubmit={handleMemberPayment} className="mt-4 space-y-3">
              <Input
                type="number"
                placeholder="Nominal Kas yang Dibayarkan (Rp)"
                value={nominalBayar}
                onChange={(e) => setNominalBayar(e.target.value)}
                required
              />
              <Btn type="submit" disabled={submitting} className="w-full text-xs">
                Kirim Konfirmasi Pembayaran
              </Btn>
            </form>
          )}
        </Card>
      )}

      {/* 4. Transparansi Arus Kas */}
      <Card className="border-hastja-border bg-hastja-card p-4">
        <h3 className="mb-3 text-sm font-bold text-white">Transparansi Arus Kas</h3>
        {loading ? (
          <p className="text-xs text-gray-400">Memuat data kas...</p>
        ) : transactions.length === 0 ? (
          <p className="text-xs text-gray-400">Belum ada riwayat transaksi.</p>
        ) : (
          <div className="divide-y divide-hastja-border">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2 text-xs">
                <div>
                  <p className="font-medium text-white">{tx.keterangan}</p>
                  <p className="text-[10px] text-gray-400">{fmt(tx.created_at)}</p>
                </div>
                <span
                  className={`font-semibold ${
                    tx.jenis === 'masuk' ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {tx.jenis === 'masuk' ? '+' : '-'} Rp {Number(tx.nominal).toLocaleString('id-ID')}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}