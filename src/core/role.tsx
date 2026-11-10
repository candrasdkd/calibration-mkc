import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useEffect, useState, type PropsWithChildren } from 'react';
import { supabase, supabaseConfigured } from './supabase';

export type Role = 'admin' | 'technician';
type LocalSession = { role: Role; userName: string };
const SESSION_KEY = 'kalibrasi-local-session-v1';

export type RoleContextValue = {
  role: Role;
  userName: string;
  isReady: boolean;
  isAuthenticated: boolean;
  isServerSession: boolean;
  backendConfigured: boolean;
  signIn: (role: Role, identity: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};
export const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: PropsWithChildren) {
  const [role, setRole] = useState<Role>('admin');
  const [userName, setUserName] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isServerSession, setIsServerSession] = useState(false);

  useEffect(() => {
    let active = true;
    const client = supabase;
    if (client) {
      const { data: { subscription } } = client.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT' && active) {
          setIsAuthenticated(false);
          setIsServerSession(false);
          setUserName('');
        }
      });
      client.auth.getSession().then(async ({ data, error }) => {
        if (error || !data.session || !active) return;
        const { data: profile, error: profileError } = await client
          .from('profiles')
          .select('full_name, role')
          .eq('id', data.session.user.id)
          .single();
        if (!active || profileError || (profile.role !== 'admin' && profile.role !== 'technician')) return;
        let technicianName = '';
        if (profile.role === 'technician') {
          const { data: technician, error: technicianError } = await client.from('technicians')
            .select('account_status,name').eq('user_id', data.session.user.id).maybeSingle();
          if (technicianError || technician?.account_status !== 'active') {
            await client.auth.signOut();
            return;
          }
          technicianName = technician.name;
        }
        setRole(profile.role);
        setUserName(technicianName || profile.full_name || data.session.user.email || '');
        setIsAuthenticated(true);
        setIsServerSession(true);
      }).catch(() => undefined).finally(() => { if (active) setIsReady(true); });
      return () => { active = false; subscription.unsubscribe(); };
    }
    if (!__DEV__) {
      void AsyncStorage.removeItem(SESSION_KEY).catch(() => undefined).finally(() => { if (active) setIsReady(true); });
      return () => { active = false; };
    }
    AsyncStorage.getItem(SESSION_KEY).then((value) => {
      if (!active || !value) return;
      const session = JSON.parse(value) as Partial<LocalSession>;
      if ((session.role === 'admin' || session.role === 'technician') && typeof session.userName === 'string') {
        setRole(session.role);
        setUserName(session.userName);
        setIsAuthenticated(true);
      }
    }).catch(() => undefined).finally(() => { if (active) setIsReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!supabase || !isAuthenticated || !isServerSession || role !== 'technician') return undefined;
    const client = supabase;
    let active = true;
    let channel: ReturnType<typeof client.channel> | undefined;
    void client.auth.getSession().then(({ data }) => {
      const userId = data.session?.user.id;
      if (!active || !userId) return;
      channel = client.channel(`technician-status-${userId}`)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'technicians', filter: `user_id=eq.${userId}`,
        }, (payload) => {
          const row = payload.new as { account_status?: string; name?: string };
          if (row.account_status !== 'active') void client.auth.signOut();
          else if (row.name) setUserName(row.name);
        })
        .subscribe();
    });
    return () => { active = false; void channel?.unsubscribe(); };
  }, [isAuthenticated, isServerSession, role]);

  const signIn = async (nextRole: Role, identity: string, password: string) => {
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: identity.trim(), password });
      if (error) throw error;
      if (!data.user) throw new Error('Akun tidak ditemukan.');
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', data.user.id)
        .single();
      if (profileError || (profile.role !== 'admin' && profile.role !== 'technician')) {
        await supabase.auth.signOut();
        throw profileError ?? new Error('Role akun belum valid. Hubungi admin.');
      }
      let technicianName = '';
      if (profile.role === 'technician') {
        const { data: technician, error: technicianError } = await supabase.from('technicians')
          .select('account_status,name').eq('user_id', data.user.id).maybeSingle();
        if (technicianError || technician?.account_status !== 'active') {
          await supabase.auth.signOut();
          throw technicianError ?? new Error('Akun teknisi belum aktif. Terima undangan email atau hubungi admin.');
        }
        technicianName = technician.name;
      }
      setRole(profile.role);
      setUserName(technicianName || profile.full_name || data.user.email || identity.trim());
      setIsAuthenticated(true);
      setIsServerSession(true);
      return;
    }

    if (!__DEV__) throw new Error('Backend belum dikonfigurasi. Hubungi admin aplikasi.');
    const session = { role: nextRole, userName: identity.trim() };
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setRole(session.role);
    setUserName(session.userName);
    setIsAuthenticated(true);
    setIsServerSession(false);
  };

  const signOut = async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } else {
      await AsyncStorage.removeItem(SESSION_KEY);
    }
    setIsAuthenticated(false);
    setUserName('');
    setIsServerSession(false);
  };

  return <RoleContext.Provider value={{ role, userName, isReady, isAuthenticated, isServerSession, backendConfigured: supabaseConfigured, signIn, signOut }}>{children}</RoleContext.Provider>;
}

