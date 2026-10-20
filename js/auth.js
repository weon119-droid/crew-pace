import { supabase } from './supabaseClient.js';

/**
 * Google OAuth 2.0 Sign-In
 */
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/index.html`
    }
  });
  if (error) throw error;
  return data;
}

/**
 * Instant Email Sign In / Sign Up
 */
export async function signInOrSignUpWithEmail(email, password, name = '') {
  let { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const signup = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name || email.split('@')[0],
          name: name || email.split('@')[0]
        }
      }
    });
    if (signup.error) throw signup.error;
    return signup.data;
  }
  return data;
}

/**
 * Sign Out
 */
export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
}

/**
 * Get current active session
 */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) return null;
  return session;
}

/**
 * Fetch current user profile with role ('pending' | 'member' | 'admin')
 */
export async function getCurrentProfile() {
  const session = await getSession();
  if (!session || !session.user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error || !data) {
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
      avatar_url: session.user.user_metadata?.avatar_url || '',
      role: 'pending'
    };
  }

  return data;
}
