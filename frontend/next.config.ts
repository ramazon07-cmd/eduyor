import type { NextConfig } from 'next';
const origin = new URL(process.env.DJANGO_API_ORIGIN || 'http://127.0.0.1:8000');
if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new Error('DJANGO_API_ORIGIN must be an HTTP(S) origin without a path or credentials.');
const backend = origin.origin;
const config: NextConfig = {
  poweredByHeader: false,
  trailingSlash: true,
  async headers(){return [{source:'/:path*',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'X-Frame-Options',value:'DENY'}]}];},
  async rewrites() {
    return [
      {source:'/api/:path*/', destination:`${backend}/api/:path*/`},
      {source:'/media/:path*', destination:`${backend}/media/:path*`},
    ];
  },
};
export default config;
