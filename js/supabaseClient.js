import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Default Supabase project credentials (can be overridden via window.__ENV__)
const SUPABASE_URL = (window.__ENV__ && window.__ENV__.SUPABASE_URL) || 'https://ayhbmtdfekshlyrdmkjd.supabase.co';
const SUPABASE_ANON_KEY = (window.__ENV__ && window.__ENV__.SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5aGJtdGRmZWtzaGx5cmRta2pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4ODI4MTIsImV4cCI6MjEwNzQ1ODgxMn0.uCJahMUtEgKrU1jzcxSk301roeAoVFiwGnzZHqZMILo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
