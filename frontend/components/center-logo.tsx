'use client';
import {useState,type ReactNode} from 'react';
import {centerInitials} from '@/lib/centers';
import './center-logo.css';

// The uploaded logo when there is one; otherwise the given fallback (initials by default).
export function CenterLogo({name,logo,className,children}:{name:string;logo?:string|null;className:string;children?:ReactNode}){
  const [failed,setFailed]=useState(false);
  const show=Boolean(logo)&&!failed;
  return <span className={`${className}${show?' has-logo':''}`} aria-hidden="true">{show?<img src={logo!} alt="" onError={()=>setFailed(true)}/>:children??centerInitials(name)}</span>;
}
