# Presensi Organisasi (PWA)
React + Vite + Tailwind + Supabase. Deploy di Vercel.

## Setup
1. Buat project di supabase.com, jalankan `sql/schema.sql` di SQL Editor.
2. `cp .env.example .env`, isi URL & anon key (Supabase > Project Settings > API).
3. `npm install && npm run dev`
4. Daftar akun, lalu jadikan admin lewat SQL Editor:
   `update public.profiles set role='admin' where email='emailmu@contoh.com';`

## Handover pengurus baru
- Tambah akun Supabase pengurus baru ke Organization yang sama (Supabase > Team).
- Transfer repo GitHub & project Vercel (atau tambahkan sebagai member).
- Promosikan pengurus baru dengan query admin di atas; turunkan yang lama: `set role='anggota'`.
- Tips: matikan "Confirm email" di Supabase > Auth > Providers > Email jika tidak ingin verifikasi email.
