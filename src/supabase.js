import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cjtifhhrtgjhovyghbyj.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqdGlmaGhydGdqaG92eWdoYnlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNDA0MzQsImV4cCI6MjA5NzkxNjQzNH0.Q6cvSbTnA8tjgfy57Uz_SI6V_8JkiRwvLE1qeZMEw1Q'

export const supabase = createClient(supabaseUrl, supabaseKey)
