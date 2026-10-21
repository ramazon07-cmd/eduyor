'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Video,X} from 'lucide-react';
import {useAuth} from './auth';
import {api} from '@/lib/api';
import type {Booking,Page} from '@/lib/types';
export function MeetingNotice(){
  const {user}=useAuth();const [booking,setBooking]=useState<Booking|null>(null);const seen=useRef(new Set<string>());
  useEffect(()=>{
    if(!user){seen.current.clear();setBooking(null);return;}
    let active=true;
    async function check(){
      try{
        const data=await api<Page<Booking>>('bookings/?meeting_ready=1&page=1');
        if(!active)return;
        const ready=data.results.filter(b=>b.student===user!.id&&b.status==='confirmed'&&b.payment_status==='verified'&&b.meeting_url&&new Date(b.ends_at).getTime()>Date.now());
        const fresh=ready.find(b=>!seen.current.has(`${b.id}:${b.meeting_url}`));
        if(fresh){seen.current.add(`${fresh.id}:${fresh.meeting_url}`);setBooking(fresh);}
      }catch{/* The lesson page exposes fetch errors; a background alert must not interrupt navigation. */}
    }
    void check();const timer=setInterval(check,20000);
    return()=>{active=false;clearInterval(timer);setBooking(null);};
  },[user?.id]);
  if(!booking)return null;
  return <aside className="meeting-notice" role="status" aria-live="polite"><span className="meeting-notice-icon"><Video size={22}/></span><div><strong>Google Meet havolasi tayyor</strong><p>{booking.mentor_name} darsga kirish havolasini yubordi.</p><Link href={`/sessions/${booking.id}`} onClick={()=>setBooking(null)}>Darsni ochish <ArrowUpRight size={14}/></Link></div><button type="button" onClick={()=>setBooking(null)} aria-label="Bildirishnomani yopish"><X size={16}/></button></aside>;
}
