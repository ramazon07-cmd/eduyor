'use client';
import {useState,type ReactNode} from 'react';
import {Copy} from 'lucide-react';
import {useI18n} from './i18n';
import {Button} from './ui/button';
import './invite-code.css';

// Codes are stored as 8 characters; show them in two readable halves.
export const displayCode=(code:string)=>`${code.slice(0,4)}-${code.slice(4)}`;

export function InviteCode({code,children}:{code:string;children?:ReactNode}){
  const {t}=useI18n();const [copied,setCopied]=useState(false);const value=displayCode(code);
  // Clipboard access can be blocked; the code stays visible to copy by hand.
  async function copy(){try{await navigator.clipboard.writeText(value);setCopied(true);}catch{setCopied(false);}}
  return <div className="invite-code"><strong>{value}</strong><Button type="button" variant="outline" size="sm" onClick={copy}><Copy size={15}/>{t(copied?'Nusxalandi':'Nusxalash')}</Button>{children}</div>;
}
