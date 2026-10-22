'use client';
import {Globe,ChevronDown} from 'lucide-react';
import {useI18n} from './i18n';
import {isLocale,localeNames,type Locale} from '@/lib/i18n';
const labels={uz:'Sayt tili',ru:'Язык сайта',en:'Website language'};
export function LanguageSwitcher(){
  const {locale,setLocale}=useI18n();
  return <label className="language-switcher"><Globe size={16} aria-hidden="true"/><span className="sr-only">{labels[locale]}</span><select aria-label={labels[locale]} value={locale} onChange={event=>{if(isLocale(event.target.value))setLocale(event.target.value);}}>{(['uz','ru','en'] as Locale[]).map(value=><option key={value} value={value}>{localeNames[value]}</option>)}</select><ChevronDown size={13} aria-hidden="true"/></label>;
}
