'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useSyncExternalStore,type ReactNode} from 'react';
import {translateText,type Locale} from '@/lib/i18n';
import {localeSnapshot,serverLocaleSnapshot,subscribeLocale,setLocale} from '@/lib/locale-store';
type I18n={locale:Locale;setLocale:(value:Locale)=>void;t:<T>(value:T)=>T};
const Context=createContext<I18n>({locale:'uz',setLocale:()=>{},t:value=>value});
export function LanguageProvider({children}:{children:ReactNode}){
  const locale=useSyncExternalStore(subscribeLocale,localeSnapshot,serverLocaleSnapshot);
  useEffect(()=>{document.documentElement.lang=locale;},[locale]);
  const t=useCallback(<T,>(value:T)=>translateText(value,locale),[locale]);
  const value=useMemo(()=>({locale,setLocale,t}),[locale,setLocale,t]);
  return <Context.Provider value={value}><title>{translateText('EduYor — Birga o‘sing',locale)}</title>{children}</Context.Provider>;
}
export const useI18n=()=>useContext(Context);
