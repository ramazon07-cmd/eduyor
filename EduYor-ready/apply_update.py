#!/usr/bin/env python3
"""Copy the clean release into an existing project, preserving local data/secrets."""
from pathlib import Path
from datetime import datetime
import json
import shutil
import sys

release = Path(__file__).resolve().parent

def is_project(path):
    return (path/'backend/manage.py').is_file() and (path/'frontend/package.json').is_file()

if len(sys.argv)>1:
    target_root=Path(sys.argv[1]).expanduser().resolve()
else:
    candidates=[Path.cwd().resolve(),*Path.cwd().resolve().parents,release.parent]
    target_root=next((path for path in candidates if path!=release and is_project(path)),Path.cwd().resolve())
if not is_project(target_root):
    raise SystemExit('backend/ va frontend/ turgan loyiha papkasida bajaring: python3 EduYor-ready/apply_update.py .')
manifest=json.loads((release/'manifest.json').read_text())
backup=target_root/'backups'/('eduyor-ready-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
changed=[]
for name in manifest['files']:
    relative=Path(name)
    if relative.is_absolute() or '..' in relative.parts or (relative.name.startswith('.env') and not relative.name.endswith('.example')) or relative.name.endswith(('.sqlite3','.sqlite3-wal','.sqlite3-shm')):
        raise SystemExit('Xavfsiz bo‘lmagan fayl yo‘li: '+name)
    source=release/relative;target=target_root/relative
    if not source.is_file() or target.is_symlink() or not target.resolve().is_relative_to(target_root):
        raise SystemExit('Fayl yo‘li tekshiruvdan o‘tmadi: '+name)
for name in manifest['files']:
    source=release/name;target=target_root/name
    # The new local/production profiles layer on the user's existing base config.
    if name=='backend/config/settings.py' and target.exists():continue
    content=source.read_bytes()
    if target.is_file() and target.read_bytes()==content:continue
    if target.is_file():
        saved=backup/name;saved.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target,saved)
    target.parent.mkdir(parents=True,exist_ok=True)
    temp=target.with_name(target.name+'.eduyor-ready-tmp')
    temp.write_bytes(content);temp.replace(target);changed.append(name)
print(f'Tayyor: {len(changed)} ta fayl yangilandi.')
if changed:print('Oldingi kod nusxasi: '+str(backup))
print('Mavjud settings.py, env, SQLite bazasi va media saqlandi.')
print('ENDI: python3 scripts/setup_local.py')
print('KEYIN: python3 backend/manage.py migrate')
print('Backend va frontendni qayta ishga tushiring. Production qo‘llanma: DEPLOYMENT.md')
