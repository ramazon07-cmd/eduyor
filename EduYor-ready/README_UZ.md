# EduYor — umumiy dizayn va deployment tayyorgarligi

ZIP ichida to‘liq ishlaydigan backend/ va frontend/ bor. Rasmdagi umumiy yon menyu, oq maydon, ko‘k/to‘q sariq logotip va pastel kartalar barcha frontend sahifalariga ulandi. Admin ham brend ranglari va logotipni ishlatadi.

## Mavjud loyihani yangilash

Ikkala serverni to‘xtating. Terminalda backend/ va frontend/ turgan asosiy loyiha papkasida, mavjud Python virtual muhitingiz faol bo‘lsin:

```bash
unzip -o ~/Downloads/EduYor-ready.zip -d .
python3 EduYor-ready/apply_update.py .
python3 scripts/setup_local.py
python3 backend/manage.py migrate
python3 backend/manage.py runserver
```

Ikkinchi terminalda:

```bash
cd frontend
npm run dev
```

http://localhost:3000 ni oching. Eski sahifani Cmd+Shift+R / Ctrl+Shift+R bilan yangilang. Mavjud base settings.py, env fayllari, SQLite bazasi va media o‘zgartirilmaydi. Kodning oldingi nusxasi backups/eduyor-ready-* ichida qoladi. manage.py yangi settings_local profilidan foydalanadi; u mavjud SQLite fayl nomini saqlaydi. Hozir ishlayotgan virtual muhit/dependencies bilan davom eting.

## Yangi o‘rnatish

ZIPni ochib EduYor-ready/ ichida README.md dagi buyruqlarni bajaring: venv → pip install → scripts/setup_local.py → migrate → seed_demo → runserver; boshqa terminalda frontend/npm ci va npm run dev. Lokal uchun PostgreSQL kerak emas.

## Deployment

Hali internetga joylanmagan. DEPLOYMENT.md ichida bitta Linux VPS uchun aniq buyruqlar va deploy/ ichida Nginx, Gunicorn/Next systemd, TLS renewal fayllari bor. backend/.env.production.example va frontend/.env.production.example mavjud. Serverda PostgreSQL, haqiqiy domen/HTTPS, yangi secret va to‘lov rekvizitlarini sozlash kerak.

Local profil: config.settings_local (SQLite/HTTP). Production profil: config.settings_production (PostgreSQL/HTTPS). Ularni env orqali ajratdik; lokal baza serverdagi baza bilan almashtirilmaydi.

Yangi darslar 50 daqiqa, bron 60 daqiqa saqlanadi. Narx 30 000–60 000 UZS, 20% platformaga / 80% mentorga. Oldin band qilingan darslarning vaqti va summasi saqlanadi. “Pul yubordim” haqiqiy bank tasdig‘i emas; admin tekshiruvi va mentor to‘lovi qo‘lda qoladi.

87 backend testi, typecheck va production build o‘tdi. 3 PostgreSQL parallel testi o‘tkazilmadi. Brauzer preview serveri ochilmadi, haqiqiy HTTPS deployment hali tekshirilmagan. To‘liq natijalar VERIFICATION.md ichida.
