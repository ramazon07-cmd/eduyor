#!/usr/bin/env python3
"""Apply the simplified booking patch without touching settings or user data."""
from pathlib import Path
from datetime import datetime
import json
import shutil
import sys

patch_dir = Path(__file__).resolve().parent
root = Path(sys.argv[1]).expanduser().resolve() if len(sys.argv) > 1 else Path.cwd().resolve()
if not (root/'backend/manage.py').is_file() or not (root/'frontend/package.json').is_file():
    raise SystemExit('PeerMentor loyiha papkasida ishga tushiring: python3 PeerMentor-booking-update/apply_patch.py')
manifest = json.loads((patch_dir/'manifest.json').read_text())
backup = root/'backups'/('booking-update-' + datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
changed = []
for name in manifest['files']:
    relative = Path(name)
    if relative.is_absolute() or '..' in relative.parts or relative.name in {'settings.py','.env','db.sqlite3'}:
        raise SystemExit('Xavfsiz bo‘lmagan fayl yo‘li: ' + name)
    source = patch_dir/'files'/relative
    if not source.is_file():
        raise SystemExit('Patch fayli topilmadi: ' + name)
    target = root/relative
    if target.is_symlink() or not target.resolve().is_relative_to(root):
        raise SystemExit('Loyiha tashqarisidagi yo‘l rad etildi: ' + name)
# Validate the full payload before replacing any files.
for name in manifest['files']:
    source = patch_dir/'files'/name
    target = root/name
    content = source.read_bytes()
    if target.is_file() and target.read_bytes() == content:
        continue
    if target.is_symlink() or not target.resolve().is_relative_to(root):
        raise SystemExit('Loyiha tashqarisidagi yo‘l rad etildi: ' + name)
    if target.is_file():
        saved = backup/name
        saved.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(target,saved)
    target.parent.mkdir(parents=True,exist_ok=True)
    temp = target.with_name(target.name+'.peermentor-update-tmp')
    temp.write_bytes(content)
    temp.replace(target)
    changed.append(name)
print(f'Tayyor: {len(changed)} ta fayl yangilandi.')
if changed:
    print('Oldingi fayllar: '+str(backup))
print('SQLite bazasi, settings.py va .env o‘zgarmadi. Migratsiya kerak emas.')
print('Backend va frontend serverlarini qayta ishga tushiring.')
