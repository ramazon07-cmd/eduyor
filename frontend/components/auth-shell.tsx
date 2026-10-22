'use client';

import Link from 'next/link';
import {ArrowLeft} from 'lucide-react';
import {Logo} from './common';
import {LanguageSwitcher} from './language-switcher';
import {useI18n} from './i18n';
import './auth-shell.css';

export function AuthShell({children}:{children:React.ReactNode}){
  const {t}=useI18n();
  return <div className="auth-standalone"><a className="skip-link" href="#page-content">{t('Asosiy mazmunga o‘tish')}</a><header className="auth-standalone-header"><Logo/><div><Link href="/" className="auth-home-link"><ArrowLeft size={15}/>{t('Saytga qaytish')}</Link><LanguageSwitcher/></div></header><main id="page-content" className="auth-standalone-main">{children}</main><footer className="auth-standalone-footer">© {new Date().getFullYear()} EduYor</footer></div>;
}
