'use client';
import {useI18n} from '@/components/i18n';
import {LanguageSwitcher} from '@/components/language-switcher';
import {useRouter} from 'next/navigation';
import {useEffect,useState} from 'react';
import {useAuth} from '@/components/auth';
import {api} from '@/lib/api';
import type {User,Profile} from '@/lib/types';
import {Loading,LoginRequired,Notice,Avatar} from '@/components/common';
import {Card} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
export default function ProfilePage(){
  const {t:translate}=useI18n();
  const router=useRouter();
  const {user,loading,setUser}=useAuth();const [profile,setProfile]=useState<Profile|null>(null);const [file,setFile]=useState<File|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [success,setSuccess]=useState(false);
  useEffect(()=>{if(user)setProfile(user.profile);},[user]);
  if(loading)return <Loading/>;if(!user)return <LoginRequired next="/profile"/>;if(!profile)return <Loading/>;
  function field(key:keyof Profile,value:string){setProfile(p=>p?{...p,[key]:value}:p);setSuccess(false);}
  async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setSuccess(false);const data=new FormData();for(const [k,v] of Object.entries(profile!)){if(k!=='avatar')data.append(k,v||'');}if(file)data.append('avatar',file);try{setUser(await api<User>('me/',{method:'PATCH',body:data}));setSuccess(true);setFile(null);router.replace('/dashboard/home');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <div className="container section narrow"><div className="page-heading"><span className="eyebrow">{translate("SIZ HAQINGIZDA")}</span><h1>{translate("Profilim")}</h1><p>{translate("O‘zingizni tanishtiring va maqsadingizni belgilang.")}</p></div><div className="profile-language"><span>{translate("Sayt tili")}</span><LanguageSwitcher/></div><Card className="form-card">{error&&<Notice kind="error">{translate(error)}</Notice>}{success&&<Notice kind="success">{translate("Profil saqlandi.")}</Notice>}<form onSubmit={save} className="form-stack"><div className="profile-avatar"><Avatar name={profile.full_name} src={profile.avatar}/><label className="small">{translate("Profil rasmi · ixtiyoriy")}<Input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)}/><small>{translate("JPEG, PNG, WebP · 2 MB gacha")}</small></label></div><label>{translate("To‘liq ism")}<Input value={profile.full_name} onChange={e=>field('full_name',e.target.value)} required maxLength={120}/></label><div className="form-row"><label>{translate("Maktab / universitet")}<Input value={profile.school} onChange={e=>field('school',e.target.value)} maxLength={160}/></label><label>{translate("Sinf / bosqich")}<Input value={profile.study_level} onChange={e=>field('study_level',e.target.value)} placeholder={translate("Masalan, 11-sinf")} maxLength={80}/></label></div><label>{translate("O‘rganish maqsadingiz")}<textarea value={profile.learning_goals} onChange={e=>field('learning_goals',e.target.value)} maxLength={1500} rows={3} placeholder={translate("Nimani o‘rganmoqchisiz?")}/><small>{translate("Bu ma’lumot faqat o‘zingizga ko‘rinadi.")}</small></label><label>{translate("Vaqt zonasi")}<Input list="timezones" value={profile.timezone} onChange={e=>field('timezone',e.target.value)} required maxLength={64}/><datalist id="timezones">{['Asia/Tashkent','Asia/Samarkand','Asia/Dubai','Europe/London','Europe/Berlin','America/New_York','Asia/Seoul'].map(t=><option key={t} value={t}/>)}</datalist><small>{translate("IANA nomi. Dars vaqtlari shu vaqt zonasida ko‘rsatiladi.")}</small></label><div className="form-actions"><Button disabled={busy}>{translate(busy?'Saqlanmoqda…':'Saqlash')}</Button></div></form></Card></div>;
}
