import type {Metadata} from 'next';
import './globals.css';
import './theme.css';
import './landing.css';
import './makon.css';
import {Figtree} from 'next/font/google';
import {LanguageProvider} from '@/components/i18n';
import {AuthProvider} from '@/components/auth';
import {ControlRouteShell} from '@/components/control-route-shell';
import {sidebarInitScript} from '@/lib/sidebar';
const sans=Figtree({subsets:['latin','latin-ext'],variable:'--font-sans',display:'swap'});
export const metadata:Metadata = {applicationName:'EduYor',icons:{icon:{url:'/brand/eduyor-mark.svg?v=20261024',type:'image/svg+xml',sizes:'any'},shortcut:'/brand/eduyor-mark.svg?v=20261024',apple:'/brand/eduyor-logo.png'},description:'O‘zingizga mos mentor toping. 50 daqiqalik onlayn darsni oson band qiling.'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="uz" className={sans.variable} suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:sidebarInitScript}}/></head><body><LanguageProvider><AuthProvider><ControlRouteShell>{children}</ControlRouteShell></AuthProvider></LanguageProvider></body></html>;}
