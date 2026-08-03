import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'

// Public browser configuration. Never put service-role secrets in frontend code.
const defaultSupabaseUrl = 'https://loafkhnjrwhppddwztof.supabase.co'
const defaultSupabasePublishableKey = 'sb_publishable_qnWJFeTv7zv3C-R4XLsHsw_xBG243OT'

const envSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const envSupabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
const envSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const supabaseUrl = envSupabaseUrl || defaultSupabaseUrl
const supabaseKey = envSupabasePublishableKey || envSupabaseAnonKey || defaultSupabasePublishableKey

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      // The session must only exist while this page is open. This prevents a
      // previous login from being restored when the user returns later.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: true,
    },
  },
)
