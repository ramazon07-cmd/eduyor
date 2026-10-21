#!/usr/bin/env python3
"""Prepare local env files without replacing existing values or user data."""
from pathlib import Path
import re
import secrets

root = Path(__file__).resolve().parents[1]
backend_env = root/'backend/.env'
if not backend_env.exists():
    backend_env.write_text((root/'backend/.env.example').read_text())
    backend_env.chmod(0o600)
content = backend_env.read_text()
key_line = re.search(r'^DJANGO_SECRET_KEY[ \t]*=[ \t]*(.*)$',content,re.MULTILINE)
if not key_line or key_line.group(1).strip() in ('',"''",'""'):
    replacement = 'DJANGO_SECRET_KEY='+secrets.token_urlsafe(64)
    content = re.sub(r'^DJANGO_SECRET_KEY[ \t]*=.*$',replacement,content,flags=re.MULTILINE) if key_line else content.rstrip()+'\n'+replacement+'\n'
    backend_env.write_text(content)
frontend_env = root/'frontend/.env.local'
if not frontend_env.exists():
    frontend_env.write_text((root/'frontend/.env.local.example').read_text())
print('Local sozlamalar tayyor. Mavjud env qiymatlari va baza saqlandi.')
print('Keyingi qadam: python3 backend/manage.py migrate')
