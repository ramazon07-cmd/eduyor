'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <div className="container section narrow"><h1>Sahifani yuklab bo‘lmadi.</h1><p>Qayta urinib ko‘ring.</p><button className="btn btn-primary" onClick={reset}>Qayta urinish</button></div>;}
