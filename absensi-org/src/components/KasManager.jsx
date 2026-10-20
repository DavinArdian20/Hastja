import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseclient'
import { Btn, Card, Input, Msg } from './ui'

export default function KasManager({ profile }) {
  const [transactions, setTransactions] = useState([])
  const [payments, setPayments] = useState([])
  const [myPayment, setMyPayment] = useState(null)
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState('income')
  const [msg, setMsg] = useState({ type: '', text: '' })
  
  const isBendahara = ['Bendahara', 'bendahara', 'Wakil Ketua', 'Ketua Umum', 'admin'].includes(profile?.role)
  const currentMonth = 'Oktober 2026'

  const fetchData = useCallback(async () => {
    const { data: transData } = await supabase
      .from('kas_transactions')
      .select('*')
      .order('created_at', { ascending: false })
    setTransactions(transData || [])

    if (isBendahara) {
      const { data: payData } = await supabase
        .from('kas_payments')
        .select('*, profiles(full_name, username)')
        .order('created_at', { ascending: false })
      setPayments(payData || [])
    } else {
      const { data: myPay } = await supabase
        .from('kas_payments')
        .select('*')
        .eq('user_id', profile.id)
        .eq('month_year', currentMonth)
        .maybeSingle()
      setMyPayment(myPay)
    }
  }, [isBendahara, profile?.id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalBalance = transactions.reduce((acc, item) => {
    return item.type === 'income' ? acc + Number(item.amount) : acc - Number(item.amount)
  }, 0)

  const handleAddTransaction = async (e) => {
    e.preventDefault()
    if (!desc || !amount) return

    const { error } = await supabase.from('kas_transactions').insert([
      { description: desc, amount: Number(amount), type }
    ])

    if (!error) {
      setMsg({ type: 'success', text: 'Catatan kas berhasil ditambahkan!' })
      setDesc('')
      setAmount('')
      fetchData()
    }
  }

  const handleRequestPayment = async () => {
    const { error } = await supabase.from('kas_payments').insert([
      { user_id: profile.id, month_year: currentMonth, amount: 20000, status: 'pending' }
    ])

    if (!error) {
      setMsg({ type: 'success', text: 'Pembayaran dikirim! Menunggu konfirmasi bendahara.' })
      fetchData()
    }
  }

  const handleApprove = async (paymentId, amount, userName) => {
    await supabase.from('kas_payments').update({ status: 'approved' }).eq('id', paymentId)
    await supabase.from('kas_transactions').insert([
      { description: `Uang Kas ${currentMonth} - ${userName}`, amount, type: 'income' }
    ])

    setMsg({ type: 'success', text: 'Pembayaran berhasil di-approve!' })
    fetchData()
  }

  return (
    <div className="space-y-6">
      {msg.text && <Msg type={msg.type}>{msg.text}</Msg>}

      <Card className="border-[#2C2C2C] bg-[#1E1E1E]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">Total Saldo Kas Organisasi</p>
            <h3 className="text-2xl font-bold text-[#E2A053]">
              Rp {totalBalance.toLocaleString('id-ID')}
            </h3>
          </div>

          {!isBendahara && (
            <div>
              {myPayment?.status === 'approved' ? (
                <span className="rounded-lg bg-green-950/60 border border-green-800 px-3 py-1.5 text-xs text-green-300 font-bold">
                  ✓ Lunas ({currentMonth})
                </span>
              ) : myPayment?.status === 'pending' ? (
                <span className="rounded-lg bg-[#E2A053]/20 border border-[#E2A053] px-3 py-1.5 text-xs text-[#E2A053] font-bold">
                  ⏳ Menunggu Approval
                </span>
              ) : (
                <Btn onClick={handleRequestPayment} className="bg-[#E2A053] text-gray-950 hover:bg-[#d49142] text-xs font-bold">
                  Konfirmasi Bayar Kas
                </Btn>
              )}
            </div>
          )}
        </div>
      </Card>

      {isBendahara && (
        <Card className="border-[#2C2C2C] bg-[#1E1E1E] space-y-4">
          <h3 className="font-semibold text-white">Input Catatan Kas (Bendahara)</h3>
          <form onSubmit={handleAddTransaction} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Input
              placeholder="Keterangan"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="sm:col-span-2 text-xs"
            />
            <Input
              type="number"
              placeholder="Nominal (Rp)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-xs"
            />
            <div className="flex space-x-2">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="rounded-lg border border-[#2C2C2C] bg-[#121212] text-xs px-2 text-white"
              >
                <option value="income">Masuk</option>
                <option value="expense">Keluar</option>
              </select>
              <Btn type="submit" className="text-xs w-full">Simpan</Btn>
            </div>
          </form>
        </Card>
      )}

      {isBendahara && (
        <Card className="border-[#2C2C2C] bg-[#1E1E1E] space-y-3">
          <h3 className="font-semibold text-white">Konfirmasi Pembayaran Anggota</h3>
          {payments.filter(p => p.status === 'pending').length === 0 ? (
            <p className="text-xs text-gray-400">Tidak ada pengajuan pembayaran pending.</p>
          ) : (
            <div className="divide-y divide-[#2C2C2C]">
              {payments.filter(p => p.status === 'pending').map((p) => (
                <div key={p.id} className="flex justify-between items-center py-2">
                  <div>
                    <p className="text-sm font-medium text-white">{p.profiles?.full_name || p.profiles?.username}</p>
                    <p className="text-xs text-gray-400">{p.month_year} • Rp {Number(p.amount).toLocaleString('id-ID')}</p>
                  </div>
                  <Btn
                    onClick={() => handleApprove(p.id, p.amount, p.profiles?.full_name)}
                    className="bg-green-600 hover:bg-green-500 text-xs py-1 px-3 text-white"
                  >
                    Approve
                  </Btn>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card className="border-[#2C2C2C] bg-[#1E1E1E] space-y-3">
        <h3 className="font-semibold text-white">Transparansi Arus Kas</h3>
        {transactions.length === 0 ? (
          <p className="text-xs text-gray-400">Belum ada riwayat transaksi.</p>
        ) : (
          <div className="divide-y divide-[#2C2C2C] max-h-60 overflow-y-auto">
            {transactions.map((item) => (
              <div key={item.id} className="flex justify-between items-center py-2.5">
                <div>
                  <p className="text-sm font-medium text-white">{item.description}</p>
                  <p className="text-[10px] text-gray-400">
                    {new Date(item.created_at).toLocaleDateString('id-ID')}
                  </p>
                </div>
                <span className={`text-xs font-bold ${item.type === 'income' ? 'text-green-400' : 'text-[#8A3931]'}`}>
                  {item.type === 'income' ? '+' : '-'} Rp {Number(item.amount).toLocaleString('id-ID')}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}