import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { localDB } from '../lib/storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthCtx {
  user: UserProfile | null;
  loading: boolean;
  login: (email:string, password:string)=>Promise<void>;
  register: (email:string, password:string, merchant_name:string, role?: 'admin'|'merchant')=>Promise<void>;
  logout: ()=>void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  login: async()=>{},
  register: async()=>{},
  logout: ()=>{},
  isAdmin: false,
});

export function AuthProvider({children}:{children:React.ReactNode}) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    if (isSupabaseConfigured) {
      supabase.auth.getSession().then(async({data: sessData}:any)=>{
        if (sessData.session?.user) {
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', sessData.session.user.id).single();
          if (profile) setUser(profile as any);
        }
        setLoading(false);
      });
      const { data: sub } = supabase.auth.onAuthStateChange(async(_e:any, sess:any)=>{
        if (sess?.user) {
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', sess.user.id).single();
          if (profile) setUser(profile as any);
        } else setUser(null);
      });
      return ()=> sub.subscription.unsubscribe();
    } else {
      const u = localDB.getCurrentUser();
      setUser(u);
      setLoading(false);
    }
  },[]);

  const login = async(email:string, password:string)=>{
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const { data: profile, error: perr } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
      if (perr) throw perr;
      setUser(profile as any);
    } else {
      const users = localDB.getUsers();
      const found = users.find(u=> u.email.toLowerCase()===email.toLowerCase());
      if (!found) throw new Error('Usuário não encontrado. Registre-se.');
      // senha ignorada no mock local (aceita qualquer)
      localDB.setCurrentUser(found);
      setUser(found);
    }
  };

  const register = async(email:string, _password:string, merchant_name:string, role:'admin'|'merchant'='merchant')=>{
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signUp({ email, password: _password });
      if (error) throw error;
      if (data.user) {
        const profile = { id: data.user.id, email, role, merchant_name, created_at: new Date().toISOString() };
        const { error: perr } = await supabase.from('profiles').insert(profile);
        if (perr) throw perr;
        setUser(profile as any);
      }
    } else {
      const users = localDB.getUsers();
      if (users.some(u=>u.email.toLowerCase()===email.toLowerCase())) throw new Error('Email já cadastrado');
      const newUser: UserProfile = {
        id: `u_${Date.now()}`,
        email,
        role,
        merchant_name,
        created_at: new Date().toISOString(),
      };
      users.push(newUser);
      localDB.saveUsers(users);
      localDB.setCurrentUser(newUser);
      setUser(newUser);
      // também cria merchant entity
      localDB.ensureMerchant(merchant_name, newUser.id);
    }
  };

  const logout = async()=>{
    if (isSupabaseConfigured) await supabase.auth.signOut();
    else localDB.setCurrentUser(null);
    setUser(null);
  };

  return <AuthContext.Provider value={{user, loading, login, register, logout, isAdmin: user?.role==='admin' }}>{children}</AuthContext.Provider>;
}

export const useAuth = ()=> useContext(AuthContext);
