# EduYor

Platforma nomi EduYor bo‘ldi. Logo matni, menyu/footer, brauzer sarlavhasi va application-name metadatasi, bosh sahifa, to‘lov kartasi, dars sahifasi, admin sarlavhasi va brauzer title’i, npm paket nomi va hujjatlar yangilandi.

## O‘rnatish

Serverlarni Ctrl+C bilan to‘xtating. `backend/` va `frontend/` turgan asosiy loyiha papkasida, virtual muhit faol holda:

```sh
unzip -o ~/Downloads/EduYor-update.zip -d .
python3 EduYor-update/apply_patch.py
python3 backend/manage.py migrate
python3 backend/manage.py runserver
```

Ikkinchi terminalda frontend papkasida `npm run dev` buyrug‘ini qayta ishga tushiring. Brauzerda sahifani yangilang.

Bu jamlangan patch: filtrlar, birlashtirilgan bio/yutuqlar, til va narx tanlovlari, 20% komissiya, 30–60 ming narx va soddalashtirilgan qo‘lda to‘lov tekshiruvi ham kiritilgan. Migratsiyalar oldin qo‘llangan bo‘lsa, qayta ma’lumot o‘zgarmaydi.

Hisoblar va bronlar saqlanadi. Installer `settings.py`, `.env`, `.env.local` va SQLite baza faylini almashtirmaydi; eski kod backups/eduyor-update-* ichiga nusxalanadi. Yangi npm/pip paket yo‘q. Yangi loyiha uchun database misollari eduyor nomida; mavjud bazangizning ulanish sozlamalari o‘z holida ishlaydi.

## Tekshirish

```sh
python3 backend/manage.py check
cd frontend
npm run typecheck
npm run build
```
