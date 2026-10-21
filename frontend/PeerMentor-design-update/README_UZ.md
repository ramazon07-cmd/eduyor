# PeerMentor · narx va dizayn yangilanishi

Bu mavjud loyihaga qo‘llanadigan jamlangan patch. Oldingi patchlarni o‘rnatmagan bo‘lsangiz ham, yangilangan to‘lov kartasi, Google Meet va soddalashtirilgan bron oqimi kiritilgan.

## O‘rnatish

1. Django va Next.js serverlarini Ctrl+C bilan to‘xtating.
2. ZIPni loyiha papkasiga ochib, patchni qo‘llang:

```sh
cd ~/Downloads/peermentor
unzip ~/Downloads/PeerMentor-design-update.zip
python3 PeerMentor-design-update/apply_patch.py
source .venv/bin/activate
python backend/manage.py migrate
python backend/manage.py runserver 127.0.0.1:8000
```

Boshqa terminalda:

```sh
cd ~/Downloads/peermentor/frontend
npm run dev
```

Loyiha yoki ZIP boshqa papkada bo‘lsa, birinchi ikki buyruqdagi yo‘lni moslang. `.venv` boshqa joyda bo‘lsa, mavjud Python muhitingizni faollashtiring. Yangi npm/pip dependency qo‘shilmagan. `settings.py`, `.env`, `.env.local` va bazangiz almashtirilmaydi; lokal SQLite konfiguratsiyangiz saqlanadi. Oldingi kod `backups/design-update-*` ichiga nusxalanadi.

## O‘zgarishlar

- Mentor narxi: 30 000–60 000 UZS, chegaralar ham ruxsat etilgan. Frontend, API, model va baza cheklovi bor.
- Yangi bronlar: 20% platformaga, 80% mentorga. 50 000 → 10 000 + 40 000. Student ustiga to‘lov qilmaydi.
- 0002 migratsiya mavjud mentor e’lonidagi 30 000 dan past narxni 30 000 ga, 60 000 dan yuqori narxni 60 000 ga keltiradi. Eski bronlarning narxi, komissiyasi va mentor ulushi o‘zgarmaydi. Dars sahifasidagi foiz bronning o‘zidan olinadi.
- Makon.ai’dan ilhomlangan original binafsha bosh sahifa, kartalar, kabinet, login va bron/to‘lov sahifalari. Telefon uchun mos layout.
- Mentor vaqt kiritmaydi; student band bo‘lmagan soatni tanlaydi. Dars davomiyligi 60 daqiqa. Keyingi 30 kun, kamida 24 soat oldin.
- Student/mentor bekor qilish tugmasi yo‘q; support holatlarini admin hal qiladi.
- To‘lov qo‘lda tekshiriladi. Avtomatik Payme/Click integratsiyasi qo‘shilmagan. Google Meet havolasini mentor tasdiqlangan darsga kiritadi.

## Tekshirish

```sh
python backend/manage.py makemigrations --check --dry-run
python backend/manage.py test core
cd frontend
npm run typecheck
npm run build
```

SQLite test fallback (test uchun): `TEST_SQLITE=1 python backend/manage.py test core`. SQLite PostgreSQL qator locklarini qo‘llamaydi; parallel bron testlari unda o‘tkazib yuboriladi.
