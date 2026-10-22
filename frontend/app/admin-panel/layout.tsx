'use client';
import {usePathname} from 'next/navigation';
import Link from 'next/link';
import './control.css';
import {LanguageSwitcher} from '@/components/language-switcher';
import {BrandMark} from '@/components/brand';
export default function AdminLayout({children}:{children:React.ReactNode}){
  const login=usePathname().replace(/\/+$/, '').endsWith('/login');
  return <div className={`control-root ${login?'control-root-login':'control-root-panel'}`}><header className="control-language"><Link href="/" className="control-brand" aria-label="EduYor"><BrandMark/><span>Edu<span>Yor</span></span></Link><LanguageSwitcher/></header>{children}</div>;
}
