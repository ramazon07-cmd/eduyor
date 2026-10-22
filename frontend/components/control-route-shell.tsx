'use client';
import {usePathname} from 'next/navigation';
import {AppShell} from './app-shell';
import {AuthShell} from './auth-shell';
export function ControlRouteShell({children}:{children:React.ReactNode}){
  const pathname=usePathname().replace(/\/+$/, '')||'/';
  if(pathname.startsWith('/admin-panel'))return <>{children}</>;
  if(pathname==='/login'||pathname==='/register')return <AuthShell>{children}</AuthShell>;
  return <AppShell>{children}</AppShell>;
}
