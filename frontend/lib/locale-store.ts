import {isLocale,type Locale} from './i18n';
const storageKey='eduyor.locale.v1';
let fallback:Locale='uz';
let memoryOnly=false;
export function localeSnapshot():Locale{
  if(memoryOnly)return fallback;
  try{const value=window.localStorage.getItem(storageKey);return isLocale(value)?value:'uz';}catch{return fallback;}
}
export const serverLocaleSnapshot=():Locale=>'uz';
export function subscribeLocale(listener:()=>void){
  const onStorage=(event:StorageEvent)=>{if(event.key!==null&&event.key!==storageKey)return;memoryOnly=false;listener();};
  window.addEventListener('storage',onStorage);window.addEventListener('eduyor:locale',listener);
  return()=>{window.removeEventListener('storage',onStorage);window.removeEventListener('eduyor:locale',listener);};
}
export function setLocale(value:Locale){
  if(!isLocale(value))return;
  fallback=value;
  try{window.localStorage.setItem(storageKey,value);memoryOnly=false;}catch{memoryOnly=true;}
  window.dispatchEvent(new Event('eduyor:locale'));
}
