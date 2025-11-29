
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/types/auth';
import { logActivity } from '@/utils/activityLogger';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SupabaseAuthContextType {
  user: SupabaseUser | null;
  session: Session | null;
  profile: UserProfile | null;
  userRole: UserRole | null;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isLoading: boolean;
  isSuspended: boolean;
}

const AuthContext = createContext<SupabaseAuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);

  const fetchUserProfile = async (userId: string): Promise<boolean> => {
    // Prevent concurrent fetches
    if (isFetching) return false;
    
    setIsFetching(true);
    try {
      // Combined query: fetch profile and role in a single request using PostgreSQL join
      // Use specific foreign key to avoid ambiguity
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(`
          *,
          user_roles!user_roles_user_id_profiles_fkey!inner(role, is_active)
        `)
        .eq('id', userId)
        .eq('user_roles.is_active', true)
        .single();

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        throw profileError;
      }
      
      if (profileData) {
        // Check if user is suspended (is_active = false)
        if (!profileData.is_active) {
          console.log('User is suspended:', userId);
          setIsSuspended(true);
          setProfile(null);
          setUserRole(null);
          setUser(null);
          setSession(null);
          // Sign out the user
          await supabase.auth.signOut();
          return true; // Return true = user is suspended
        }
        
        setIsSuspended(false);
        setProfile(profileData);
        // user_roles returns an array, get first element
        const roleData = Array.isArray(profileData.user_roles) ? profileData.user_roles[0] : profileData.user_roles;
        setUserRole(roleData?.role || profileData.role);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setProfile(null);
      setUserRole(null);
    } finally {
      setIsFetching(false);
      setIsLoading(false);
    }
    return false; // Return false = user is NOT suspended
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Fetch profile and roles when user logs in
        if (session?.user) {
          fetchUserProfile(session.user.id);
        } else {
          setProfile(null);
          setUserRole(null);
          setIsSuspended(false);
          setIsLoading(false); // Only set false when no user
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setIsLoading(false); // Only set false when no session
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (!error && data.session) {
      // Wait for profile to load and check if user was suspended
      const wasSuspended = await fetchUserProfile(data.session.user.id);
      
      // If user was suspended, return a custom error
      if (wasSuspended) {
        return { 
          error: { 
            message: 'Your account has been suspended. Please contact your administrator.' 
          } 
        };
      }

      // Log successful login
      await logActivity({
        action: 'user_login',
        entityType: 'user',
        entityId: data.session.user.id,
        details: {
          email: data.session.user.email,
          timestamp: new Date().toISOString(),
        },
        userId: data.session.user.id,
      });
    } else {
      setIsLoading(false);
    }
    
    return { error };
  };

  const signOut = async () => {
    setIsLoading(true);
    
    // Log logout before signing out
    if (user) {
      await logActivity({
        action: 'user_logout',
        entityType: 'user',
        entityId: user.id,
        details: {
          email: user.email,
          timestamp: new Date().toISOString(),
        },
        userId: user.id,
      });
    }
    
    await supabase.auth.signOut();
    setIsLoading(false);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserProfile(user.id);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, userRole, signIn, signOut, refreshProfile, isLoading, isSuspended }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
