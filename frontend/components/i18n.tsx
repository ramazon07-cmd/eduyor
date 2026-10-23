'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useSyncExternalStore,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {translateText,type Locale} from '@/lib/i18n';
import {localeSnapshot,serverLocaleSnapshot,subscribeLocale,setLocale} from '@/lib/locale-store';
type I18n={locale:Locale;setLocale:(value:Locale)=>void;t:<T>(value:T)=>T};
// Browser-tab label per route (paths are normalised to end with a slash); the first match wins.
const pageTitles:[RegExp,string][]=[[/^\/mentors\/[^/]+\/$/,'Mentor bilan dars'],[/^\/mentors\/$/,'Mentorlar'],[/^\/requests\/[^/]+\/$/,'So‘rov'],[/^\/requests\/$/,'EduYor Request'],[/^\/sessions\//,'Dars tafsilotlari'],[/^\/dashboard\/home\//,'Bosh sahifa'],[/^\/dashboard\//,'Darslarim'],[/^\/profile\//,'Profilim'],[/^\/login\//,'Kirish'],[/^\/register\//,'Ro‘yxatdan o‘tish'],[/^\/admin-panel\//,'Boshqaruv paneli']];
const Context=createContext<I18n>({locale:'uz',setLocale:()=>{},t:value=>value});
export function LanguageProvider({children}:{children:ReactNode}){
  const locale=useSyncExternalStore(subscribeLocale,localeSnapshot,serverLocaleSnapshot);
  useEffect(()=>{document.documentElement.lang=locale;},[locale]);
  const path=`${usePathname()||'/'}/`.replace(/\/+$/,'/');
  const label=pageTitles.find(([pattern])=>pattern.test(path))?.[1];
  const t=useCallback(<T,>(value:T)=>translateText(value,locale),[locale]);
  const value=useMemo(()=>({locale,setLocale,t}),[locale,setLocale,t]);
  return <Context.Provider value={value}><title>{label?`${translateText(label,locale)} | EduYor`:translateText('EduYor | Birga o‘sing',locale)}</title>{children}</Context.Provider>;
}
export const useI18n=()=>useContext(Context);
