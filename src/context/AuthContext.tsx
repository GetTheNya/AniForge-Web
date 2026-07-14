/**
 * AuthContext — Supabase authentication state provider.
 * Mirrors the Android AuthRepository pattern.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

import type { UserProfile } from '../types/supabase';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  profile: UserProfile | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Helper to fetch user profile
const fetchUserProfile = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, username, avatar_url')
      .eq('id', userId)
      .single();
    if (error) {
      console.error('[auth] Failed to fetch user profile:', error);
      return null;
    }
    return data as UserProfile;
  } catch (err) {
    console.error('[auth] Error fetching user profile:', err);
    return null;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const refreshProfile = useCallback(async () => {
    if (user) {
      const prof = await fetchUserProfile(user.id);
      setProfile(prof);
    }
  }, [user]);

  useEffect(() => {
    // Process session and profile loading
    const handleSessionChange = async (s: Session | null) => {
      setSession(s);
      const currentUser = s?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        const prof = await fetchUserProfile(currentUser.id);
        setProfile(prof);
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    };

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      handleSessionChange(s);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        handleSessionChange(s);
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      console.error('[auth] Google sign-in failed:', error);
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('[auth] Sign-out failed:', error);
      throw error;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, session, isLoading, profile, signInWithGoogle, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>');
  }
  return ctx;
}
