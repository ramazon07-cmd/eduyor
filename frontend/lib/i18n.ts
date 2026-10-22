import {translations} from './translations';
export type Locale='uz'|'en'|'ru';
export const localeNames:Record<Locale,string>={uz:'O‘zbekcha',ru:'Русский',en:'English'};
export const isLocale=(value:unknown):value is Locale=>value==='uz'||value==='en'||value==='ru';
// Placeholders keep names, amounts and counts outside translated copy.
const patterns=Object.entries(translations).filter(([key])=>key.includes('{')).map(([key,values])=>{
  const names:string[]=[];
  const pattern=key.split(/(\{\w+\})/).map(part=>/^\{\w+\}$/.test(part)?(names.push(part.slice(1,-1)),'(.+?)'):part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('');
  return {regex:new RegExp(`^${pattern}$`),names,values};
});
export function translateText<T>(value:T,locale:Locale):T{
  if(typeof value!=='string'||locale==='uz')return value;
  const key=value.trim();
  const index=locale==='en'?0:1;
  let translated=translations[key]?.[index];
  if(!translated){for(const {regex,names,values} of patterns){const match=key.match(regex);if(match){translated=values[index].replace(/\{(\w+)\}/g,(_,name)=>match[names.indexOf(name)+1]);break;}}}
  // API validation errors are formatted as a known field label and message.
  if(!translated){const separator=key.indexOf(': ');if(separator>0&&translations[key.slice(0,separator)]){translated=`${translateText(key.slice(0,separator),locale)}: ${translateText(key.slice(separator+2),locale)}`;}}
  return (translated?value.replace(key,translated):value) as T;
}

// Only structured teaching-language fields use this helper; biographies stay untouched.
export function teachingLanguages(value:string|undefined,locale:Locale):string{
  const aliases:Record<string,string>={'English':'Inglizcha','Русский':'Ruscha','Uzbek':'O‘zbekcha'};
  return (value||'').split(',').map(part=>{const label=part.trim();return translateText(aliases[label]||label,locale);}).join(', ');
}
