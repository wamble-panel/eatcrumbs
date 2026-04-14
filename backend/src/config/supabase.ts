import { createClient } from '@supabase/supabase-js'
import { env } from './env'

// Service-role client — bypasses RLS for server-side operations.
// We enforce tenant isolation at the application layer.
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
