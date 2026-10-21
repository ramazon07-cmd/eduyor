import type {Metadata} from 'next';
import './globals.css';
import {AuthProvider} from '@/components/auth';
import {Header,Footer} from '@/components/common';
export const metadata:Metadata = {applicationName:'EduYor',icons:{icon:'/brand/eduyor-mark.svg',apple:'/brand/eduyor-logo.png'},title:{default:'EduYor — Birga o‘sing',template:'%s | EduYor'},description:'O‘zingizga mos mentor toping. 50 daqiqalik onlayn darsni oson band qiling.'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="uz"><body><AuthProvider><Header/><main>{children}</main><Footer/></AuthProvider></body></html>;}
