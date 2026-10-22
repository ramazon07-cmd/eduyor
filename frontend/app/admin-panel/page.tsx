'use client';
import {useCallback,useEffect,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {api,ApiError} from '@/lib/api';
import {AdminPanelView,type Row,type Page,type Summary,type Tab} from '@/components/admin-panel-view';
export default function AdminPanel(){
 const router=useRouter();const [operator,setOperator]=useState('');const [tab,setTab]=useState<Tab>('overview');const [summary,setSummary]=useState<Summary|null>(null);const [data,setData]=useState<Page|null>(null);const [state,setState]=useState('pending');const [page,setPage]=useState(1);const [query,setQuery]=useState('');const [search,setSearch]=useState('');const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const [review,setReview]=useState<{row:Row;action:string}|null>(null);
 const reload=useCallback(async()=>{setLoading(true);setError('');try{const [me,stats,rows]=await Promise.all([api<{email:string}>('control/me/'),api<Summary>('control/summary/'),tab==='overview'?Promise.resolve(null):api<Page>(`control/${tab}/?state=${encodeURIComponent(state)}&page=${page}&search=${encodeURIComponent(search)}`)]);setOperator(me.email);setSummary(stats);setData(rows);}catch(e){if(e instanceof ApiError&&(e.status===401||e.status===403)){router.replace('/admin-panel/login');}else setError((e as Error).message);}finally{setLoading(false);}},[tab,state,page,search,router]);
 useEffect(()=>{void reload();},[reload]);
 function select(next:Tab,filter?:string){setTab(next);setState(filter||(next==='bookings'?'submitted':'pending'));setPage(1);setSearch('');setQuery('');setData(null);setMessage('');}
 async function operate(row:Row,action:string,extra:Record<string,unknown>={}){setBusy(true);setError('');setMessage('');try{const result=await api<Row>(`control/${tab}/${row.id}/`,{method:'POST',body:JSON.stringify({action,version:row.version,receipt_digest:row.receipt_digest,...extra})});setReview(null);setMessage(result.payment_status==='refund_required'?'Pul tushumi qayd etildi. Bron faol emas — pulni qaytarish kerak.':'Amal muvaffaqiyatli saqlandi.');await reload();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function signOut(){setBusy(true);try{await api('control/me/',{method:'DELETE'});window.location.assign('/admin-panel/login');}catch(e){setError((e as Error).message);setBusy(false);}}
 function submitReview(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!review)return;const f=new FormData(e.currentTarget);void operate(review.row,review.action,{reference:f.get('reference')||'',checked:f.get('checked')==='on',note:f.get('note')||''});}
 return <AdminPanelView controller={{operator,tab,summary,data,state,page,query,loading,error,message,busy,review,setSearch,setQuery,setPage,setState,setReview,select,reload,operate,signOut,submitReview}}/>;
}
