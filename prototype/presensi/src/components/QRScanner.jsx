import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

// Memindai satu QR lalu berhenti. onScan dipanggil sekali dengan teks QR.
export default function QRScanner({ onScan, onError }) {
  const done = useRef(false)

  useEffect(() => {
    const scanner = new Html5Qrcode('qr-reader')
    scanner
      .start({ facingMode: 'environment' }, { fps: 10, qrbox: 240 }, (text) => {
        if (done.current) return
        done.current = true
        scanner.stop().catch(() => {})
        onScan(text)
      })
      .catch(() => onError?.('Kamera tidak bisa diakses. Izinkan akses kamera di browser.'))

    return () => { if (scanner.isScanning) scanner.stop().catch(() => {}) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div id="qr-reader" className="mx-auto w-full max-w-sm overflow-hidden rounded-lg" />
}
