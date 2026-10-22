import type {Locale} from './i18n';
export const months=['yanvar','fevral','mart','aprel','may','iyun','iyul','avgust','sentabr','oktabr','noyabr','dekabr'];
const localeTags={uz:'uz-UZ',en:'en-GB',ru:'ru-RU'};
export const monthTitle=(date:Date,locale:Locale='uz')=>locale==='uz'?`${months[date.getMonth()]} ${date.getFullYear()}`:new Intl.DateTimeFormat(localeTags[locale],{month:'long',year:'numeric'}).format(date);
export const selectedDateLabel=(date:string,locale:Locale='uz')=>{const [year,month,day]=date.split('-').map(Number);return locale==='uz'?`${day} ${months[month-1]} ${year}`:new Intl.DateTimeFormat(localeTags[locale],{day:'numeric',month:'long',year:'numeric'}).format(new Date(year,month-1,day));};
export function dateTime(value:string,timeZone:string,locale:Locale='uz'){
  if(locale!=='uz')return new Intl.DateTimeFormat(localeTags[locale],{timeZone,year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value));
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));
  const part=(name:string)=>parts.find(p=>p.type===name)?.value||'';
  return `${part('day')} ${months[Number(part('month'))-1]} ${part('year')}, ${part('hour')}:${part('minute')}`;
}
