/**
 * Supabase Client Service
 * 
 * Initializes the Supabase JS SDK with environment variables.
 * 
 * Security note: The anon key is designed to be public — it only grants
 * access governed by Row Level Security (RLS) policies on your Supabase tables.
 * All write operations are protected server-side by RLS, not by key secrecy.
 * The real security boundary is your Supabase RLS policies + user JWT tokens.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.',
    'Auth and user sync features will be disabled.',
    'Create a .env file in the project root with these values.',
  );
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  },
);

export default supabase;
