'use client';
import {usePathname} from 'next/navigation';
import {AppShell} from './app-shell';
export function ControlRouteShell({children}:{children:React.ReactNode}){
  const pathname=usePathname();
  return pathname.startsWith('/admin-panel')?<>{children}</>:<AppShell>{children}</AppShell>;
}
