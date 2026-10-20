import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY belum diisi (lihat .env.example)')
}

// Anon key aman dipublikasikan; keamanan data dijaga oleh Row Level Security.
export const supabase = createClient(url, anonKey)
