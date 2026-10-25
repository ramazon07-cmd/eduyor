'use client';
import {createContext,useContext,useEffect,useState,useCallback,type ReactNode} from 'react';
import {api,ApiError} from '@/lib/api';
import type {User} from '@/lib/types';
type Auth = {user:User|null;loading:boolean;error:string;refresh:()=>Promise<void>;setUser:(u:User|null)=>void};
const Context = createContext<Auth>({user:null,loading:true,error:'',refresh:async()=>{},setUser:()=>{}});
export function AuthProvider({children}:{children:ReactNode}) {
  const [user,setUser] = useState<User|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const refresh = useCallback(async()=>{
    try {setUser(await api<User>('me/'));setError('');}
    catch(e) {if(e instanceof ApiError && [401,403].includes(e.status)){setUser(null);setError('');}else setError('Hisobni yuklab bo‘lmadi. Sahifani yangilang.');}
    finally {setLoading(false);}
  },[]);
  useEffect(()=>{void refresh();},[refresh]);
  return <Context.Provider value={{user,loading,error,refresh,setUser}}>{children}</Context.Provider>;
}
export const useAuth = () => useContext(Context);
// Signed-out visitors go to sign-in first and return to the mentor's booking page afterwards.
export function useMentorHref(){
  const {user}=useAuth();
  return (id:number)=>user?`/mentors/${id}`:`/login?next=${encodeURIComponent(`/mentors/${id}`)}`;
}
