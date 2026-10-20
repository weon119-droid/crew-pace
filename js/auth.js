import { supabase } from './supabaseClient.js';

/**
 * Initiates Google OAuth login flow.
 * In production or local dev, redirectTo will redirect back to current origin + /board.html
 */
export async function signInWithGoogle() {
  const redirectOrigin = window.location.origin;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${redirectOrigin}/board.html`
    }
  });

  if (error) {
    console.error('Google Sign-in Error:', error);
    throw error;
  }
  return data;
}

/**
 * Sign out current user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Sign-out Error:', error);
  }
  window.location.href = '/index.html';
}

/**
 * Get current session
 */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Session retrieval error:', error);
    return null;
  }
  return session;
}

/**
 * Get current authenticated user profile from public.profiles
 */
export async function getCurrentProfile() {
  const session = await getSession();
  if (!session || !session.user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error) {
    console.warn('Profile fetch warning (new profile might be provisioning):', error);
    return {
      id: session.user.id,
      email: session.user.email,
      full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
      avatar_url: session.user.user_metadata?.avatar_url || '',
      role: 'GUEST',
      status: 'PENDING'
    };
  }

  return data;
}
