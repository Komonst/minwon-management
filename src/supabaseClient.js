import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://iniqtrnunfxsiwwqwkip.supabase.co'
const supabaseKey = 'sb_publishable_BPXGWOSGyR8QBg4rMcpNiQ_-aVwLSTj'

export const supabase = createClient(supabaseUrl, supabaseKey)