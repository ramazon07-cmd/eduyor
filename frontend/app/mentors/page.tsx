'use client';
import {useEffect,useState,useCallback,useRef} from 'react';
import {Search,SlidersHorizontal,ArrowLeft,ArrowRight,X,Globe,Wallet} from 'lucide-react';
import {useAuth} from '@/components/auth';
import {api,money} from '@/lib/api';
import type {Mentor,Page,Subject} from '@/lib/types';
import {MentorCard,Notice,Empty} from '@/components/common';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';

type Filters={search:string;subject:string;language:string;min_price:string;max_price:string;ordering:string};
const defaults:Filters={search:'',subject:'',language:'',min_price:'',max_price:'',ordering:'name'};
const languageNames:Record<string,string>={uz:'O‘zbekcha',en:'Inglizcha',ru:'Ruscha'};
const languagePatterns:Record<string,RegExp>={uz:/(^|[^a-zа-я])(o[‘’ʻʼ'`]?zbek(cha)?|uzbek|uz)([^a-zа-я]|$)/i,en:/(^|[^a-zа-я])(english|ingliz(cha)?|en)([^a-zа-я]|$)/i,ru:/(^|[^a-zа-я])(rus(cha)?|russian|русский|ru)([^a-zа-я]|$)/i};
function readFilters(params:URLSearchParams):Filters{return Object.fromEntries(Object.entries(defaults).map(([key,value])=>[key,params.get(key)||value])) as Filters;}
function encodeFilters(filters:Filters,page=1){const params=new URLSearchParams();Object.entries(filters).forEach(([key,value])=>{if(value&&value!==defaults[key as keyof Filters])params.set(key,value);});if(page>1)params.set('page',String(page));return params.toString();}

export default function Directory(){
  const {user,loading:authLoading,refresh}=useAuth();
  const requestId=useRef(0);
  const [data,setData]=useState<Page<Mentor>|null>(null);
  const [subjects,setSubjects]=useState<Subject[]>([]);
  const [subjectError,setSubjectError]=useState('');
  const [draft,setDraft]=useState<Filters>(defaults);
  const [query,setQuery]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [validation,setValidation]=useState('');
  const params=new URLSearchParams(query||'');
  const applied=readFilters(params);
  const page=Math.max(1,Number(params.get('page'))||1);

  useEffect(()=>{if(user?.id)void refresh();},[user?.id,refresh]);
  const loadSubjects=useCallback(()=>{setSubjectError('');api<Subject[]>('subjects/').then(setSubjects).catch(()=>setSubjectError('Fanlarni yuklab bo‘lmadi.'));},[]);
  useEffect(()=>{
    function restore(){const params=new URLSearchParams(window.location.search);setDraft(readFilters(params));setQuery(params.toString());setValidation('');}
    restore();loadSubjects();window.addEventListener('popstate',restore);
    return()=>window.removeEventListener('popstate',restore);
  },[loadSubjects]);
  const load=useCallback(async()=>{
    if(query===null||authLoading)return;
    const request=++requestId.current;setLoading(true);setError('');
    try{const result=await api<Page<Mentor>>(`mentors/?${query}&exclude_self=1`);if(request===requestId.current)setData(result);}
    catch(e){if(request===requestId.current){setError((e as Error).message);setData(null);}}
    finally{if(request===requestId.current)setLoading(false);}
  },[query,authLoading,user?.id]);
  useEffect(()=>{void load();return()=>{requestId.current++;};},[load]);
  function apply(filters:Filters,nextPage=1){
    if(filters.min_price&&filters.max_price&&Number(filters.min_price)>Number(filters.max_price)){setValidation('Eng yuqori narx eng past narxdan kam bo‘lmasin.');return;}
    for(const value of [filters.min_price,filters.max_price])if(value&&(!/^\d+$/.test(value)||Number(value)<30000||Number(value)>60000)){setValidation('Narxni 30 000–60 000 so‘m oralig‘ida kiriting.');return;}
    setValidation('');setDraft(filters);
    const next=encodeFilters(filters,nextPage);window.history.pushState(null,'',`${window.location.pathname}${next?'?'+next:''}`);setQuery(next);
  }
  function reset(){apply({...defaults});}
  function update(key:keyof Filters,value:string){setDraft(f=>({...f,[key]:value}));setValidation('');}
  const own=user?.mentor_listing;
  const term=applied.search.toLowerCase().trim();
  const ownMatches=!!own&&(!term||[own.full_name,own.headline,...own.subjects.map(s=>s.name)].join(' ').toLowerCase().includes(term))&&(!applied.subject||own.subjects.some(s=>String(s.id)===applied.subject))&&(!applied.language||!!languagePatterns[applied.language]?.test(own.teaching_languages))&&(!applied.min_price||Number(own.hourly_price)>=Number(applied.min_price))&&(!applied.max_price||Number(own.hourly_price)<=Number(applied.max_price));
  const showOwn=ownMatches&&page===1;
  const rows=data?.results.filter(m=>!showOwn||m.id!==own?.id)||[];
  const count=(data?.count||0)+(ownMatches?1:0);
  const active=([
    ['search',applied.search?`Qidiruv: ${applied.search}`:''],
    ['subject',applied.subject?(subjects.find(s=>String(s.id)===applied.subject)?.name||'Tanlangan fan'):''],
    ['language',applied.language?(languageNames[applied.language]||applied.language):''],
    ['min_price',applied.min_price?`${money(applied.min_price)} dan`:''],
    ['max_price',applied.max_price?`${money(applied.max_price)} gacha`:''],
  ] as [keyof Filters,string][]).filter(([,label])=>label);

  return <div className="container section">
    <div className="directory-heading"><div><span className="eyebrow">O‘ZINGIZGA MOSINI TOPING</span><h1>Bir maqsad. Mos mentor.</h1><p>Fan, til va byudjetingiz bo‘yicha tanlang.</p></div><span className="directory-symbol" aria-hidden="true">↗</span></div>
    <form className="directory-filters card" onSubmit={e=>{e.preventDefault();apply(draft);}}>
      <div className="directory-search-row"><label className="search-field"><Search size={20}/><Input aria-label="Mentor qidirish" placeholder="Ism, fan yoki sarlavha bo‘yicha qidirish" maxLength={160} value={draft.search} onChange={e=>update('search',e.target.value)}/></label><Button><SlidersHorizontal size={17}/>Mentorlarni topish</Button></div>
      <div className="filter-fields">
        <label><span>Fan</span><select value={draft.subject} onChange={e=>apply({...draft,subject:e.target.value})}><option value="">Barcha fanlar</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label><span><Globe size={14}/>Ta’lim tili</span><select value={draft.language} onChange={e=>apply({...draft,language:e.target.value})}><option value="">Barcha tillar</option>{Object.entries(languageNames).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
        <fieldset className="price-filter"><legend><Wallet size={14}/>Dars narxi · so‘m</legend><div><Input aria-label="Eng past narx" type="number" min="30000" max="60000" step="1" placeholder="30 000 dan" value={draft.min_price} onChange={e=>update('min_price',e.target.value)}/><span aria-hidden="true">—</span><Input aria-label="Eng yuqori narx" type="number" min="30000" max="60000" step="1" placeholder="60 000 gacha" value={draft.max_price} onChange={e=>update('max_price',e.target.value)}/></div></fieldset>
      </div>
      <div className="quick-budgets"><span>Tez tanlash:</span>{[30000,40000,50000].map(price=><button type="button" key={price} aria-pressed={!applied.min_price&&applied.max_price===String(price)} className={!applied.min_price&&applied.max_price===String(price)?'selected':''} onClick={()=>apply({...draft,min_price:'',max_price:String(price)})}>{money(price)} gacha</button>)}<span className="filter-duration">50 daqiqalik onlayn dars</span></div>
    </form>
    {subjectError&&<Notice kind="error">{subjectError}<button onClick={loadSubjects}>Qayta urinish</button></Notice>}
    {validation&&<Notice kind="error">{validation}</Notice>}
    {!!subjects.length&&<div className="directory-subjects" aria-label="Fan bo‘yicha tez tanlash"><button type="button" className={!applied.subject?'selected':''} aria-pressed={!applied.subject} onClick={()=>apply({...draft,subject:''})}>Barcha fanlar</button>{subjects.map(s=><button type="button" key={s.id} className={applied.subject===String(s.id)?'selected':''} aria-pressed={applied.subject===String(s.id)} onClick={()=>apply({...draft,subject:String(s.id)})}>{s.name}</button>)}</div>}
    {!!active.length&&<div className="active-filters" aria-label="Faol filtrlar">{active.map(([key,label])=><button type="button" key={key} onClick={()=>apply({...applied,[key]:''})} aria-label={`${label} filtrini olib tashlash`}>{label}<X size={13}/></button>)}<button type="button" className="reset-filters" onClick={reset}>Hammasini tozalash</button></div>}
    <div className="directory-results-bar"><span className="muted small" role="status">{loading?'Mentorlar qidirilmoqda…':error?'Natijalarni yuklab bo‘lmadi':`${count} ta e’lon${showOwn&&!own?.is_public?' · shaxsiy e’loningiz bilan':''}`}</span><label>Saralash<select value={applied.ordering} onChange={e=>apply({...applied,ordering:e.target.value})}><option value="name">Ism bo‘yicha</option><option value="price_asc">Arzonidan boshlab</option><option value="price_desc">Qimmatidan boshlab</option></select></label></div>
    {error&&<Notice kind="error">{error}<button onClick={load}>Qayta urinish</button></Notice>}
    {loading?<div className="mentor-grid" aria-busy="true">{[1,2,3].map(n=><div className="card skeleton" key={n} aria-label="Mentor yuklanmoqda"/>)}</div>:!error&&(rows.length||showOwn)?<div className="mentor-grid">{showOwn&&own&&<MentorCard mentor={own} own={own}/ >}{rows.map(m=><MentorCard key={m.id} mentor={m}/>)}</div>:!error&&<Empty title="Mos mentor topilmadi"><p>Fan, til yoki narx oralig‘ini o‘zgartirib ko‘ring.</p><Button variant="outline" onClick={reset}>Filtrlarni tozalash</Button></Empty>}
    {data&&data.count>9&&!error&&<div className="pagination"><Button variant="outline" disabled={!data.previous||loading} onClick={()=>apply(applied,page-1)}><ArrowLeft size={16}/>Oldingi</Button><span>{page} / {Math.ceil(data.count/9)}</span><Button variant="outline" disabled={!data.next||loading} onClick={()=>apply(applied,page+1)}>Keyingi<ArrowRight size={16}/></Button></div>}
  </div>;
}
