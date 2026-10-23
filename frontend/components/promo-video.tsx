'use client';
import {useEffect,useRef,useState} from 'react';
import {Play} from 'lucide-react';
import {useI18n} from '@/components/i18n';

// Drop the promo file at public/videos/eduyor-promo.mp4; until it exists the card shows a notice instead of a broken player.
const SRC='/videos/eduyor-promo.mp4';
const POSTER='/images/learning-together.png';

export function PromoVideo(){
  const {t:translate}=useI18n();
  const [missing,setMissing]=useState(false);
  const video=useRef<HTMLVideoElement>(null);
  // The source error can fire before hydration attaches onError, so also check the settled network state.
  useEffect(()=>{if(video.current?.networkState===HTMLMediaElement.NETWORK_NO_SOURCE)setMissing(true);},[]);
  return <figure className="promo-video">
    {missing
      ?<div className="promo-video-empty" role="status" style={{backgroundImage:`url(${POSTER})`}}><span><Play size={22} aria-hidden="true"/></span><p>{translate("Video tez orada qo‘shiladi.")}</p></div>
      :<video ref={video} controls playsInline preload="metadata" poster={POSTER} aria-label={translate("EduYor tanishtiruv videosi")}><source src={SRC} type="video/mp4" onError={()=>setMissing(true)}/></video>}
    <figcaption>{translate("EduYor darsi qanday o‘tadi")}</figcaption>
  </figure>;
}
