import type {Metadata} from 'next';
import './globals.css';
import './refresh.css';
import {AuthProvider} from '@/components/auth';
import {Header,Footer} from '@/components/common';
export const metadata:Metadata = {applicationName:'EduYor',title:{default:'EduYor — Birga o‘sing',template:'%s | EduYor'},description:'O‘zingizga mos mentor toping. Bir soatlik onlayn darsni oson band qiling.'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="uz"><body><AuthProvider><Header/><main>{children}</main><Footer/></AuthProvider></body></html>;}
