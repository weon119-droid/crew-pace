import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const SUPABASE_URL = 'https://ayhbmtdfekshlyrdmkjd.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5aGJtdGRmZWtzaGx5cmRta2pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4ODI4MTIsImV4cCI6MjEwNzQ1ODgxMn0.uCJahMUtEgKrU1jzcxSk301roeAoVFiwGnzZHqZMILo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
