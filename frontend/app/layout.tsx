import type {Metadata} from 'next';
import './globals.css';
import './theme.css';
import './landing.css';
import {LanguageProvider} from '@/components/i18n';
import {AuthProvider} from '@/components/auth';
import {ControlRouteShell} from '@/components/control-route-shell';
export const metadata:Metadata = {applicationName:'EduYor',icons:{icon:'/brand/eduyor-mark.svg',apple:'/brand/eduyor-logo.png'},description:'O‘zingizga mos mentor toping. 50 daqiqalik onlayn darsni oson band qiling.'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="uz"><body><LanguageProvider><AuthProvider><ControlRouteShell>{children}</ControlRouteShell></AuthProvider></LanguageProvider></body></html>;}
