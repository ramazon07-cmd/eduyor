export const months=['yanvar','fevral','mart','aprel','may','iyun','iyul','avgust','sentabr','oktabr','noyabr','dekabr'];
export const monthTitle=(date:Date)=>`${months[date.getMonth()]} ${date.getFullYear()}`;
export const selectedDateLabel=(date:string)=>{const [year,month,day]=date.split('-').map(Number);return `${day} ${months[month-1]} ${year}`;};
export function dateTime(value:string,timeZone:string){
  // Explicit Uzbek month names also work in browsers with incomplete uz ICU data.
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));
  const part=(name:string)=>parts.find(p=>p.type===name)?.value||'';
  return `${part('day')} ${months[Number(part('month'))-1]} ${part('year')}, ${part('hour')}:${part('minute')}`;
}
