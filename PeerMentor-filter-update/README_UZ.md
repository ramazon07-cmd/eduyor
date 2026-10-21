# PeerMentor · mentor filtrlari

Bu jamlangan patch: yangi filtrlar, oldingi Makon.ai’dan ilhomlangan dizayn, 30 000–60 000 so‘mlik narx va 20% komissiya o‘z ichiga olingan. Oldingi ZIPlarni qaytadan o‘rnatish shart emas.

## O‘rnatish

Backend va frontendni Ctrl+C bilan to‘xtating. Sizning terminal loggingizdagi loyiha yo‘liga mos buyruqlar:

```sh
cd ~/Downloads/peermentor
unzip -o ~/Downloads/PeerMentor-filter-update.zip -d .
python3 PeerMentor-filter-update/apply_patch.py ~/Downloads/peermentor
python3 backend/manage.py migrate
python3 backend/manage.py runserver 127.0.0.1:8000
```

Python virtual muhitingiz faol bo‘lsin (terminalingizdagi `.venv`). Agar faol bo‘lmasa, loyiha ildizidan `source .venv/bin/activate`.

Ikkinchi terminal:

```sh
cd ~/Downloads/peermentor/frontend
npm run dev
```

`manage.py` backend ichida. Loyiha ildizidan to‘liq `python3 backend/manage.py ...` buyrug‘ini ishlating. Oldingi xatoda ZIP backend ichiga ochilgan va keyin `.py` o‘rniga `.p` yozilgan. Yuqoridagi buyruqlar yangi patchni to‘g‘ri joyga qo‘llaydi. Installer ham ish papkasining ota papkalaridan loyiha ildizini aniqlay oladi.

## Filtrlar

- Ism, sarlavha yoki fan bo‘yicha qidirish.
- Fan: haqiqiy backend ro‘yxatidan select va tez tanlash tugmalari.
- Ta’lim tili: O‘zbekcha, Inglizcha, Ruscha. Mentorning mavjud matnli til maydonidagi keng tarqalgan nomlar ham taniladi.
- Eng past / eng yuqori narx. Chegaralar ham natijaga kiradi. 30k / 40k / 50k gacha tez tanlash.
- Ism yoki arzon/qimmat narx bo‘yicha saralash.
- Filtrlar birga qo‘llanadi, so‘ng backend pagination ishlaydi. Faol filtrlar bittalab yoki birga tozalanadi. URL orqali filtrni saqlash/ulashish mumkin.
- O‘z e’loningiz avvalgidek alohida ko‘rinadi va tanlangan filtrga mos bo‘lsa chiqadi; o‘zingizni band qila olmaysiz.

Filtrlarning o‘zi yangi migratsiya talab qilmaydi. `migrate` oldingi 0002 narx migratsiyasi hali o‘rnatilmagan bo‘lsa uni qo‘llaydi. U mavjud mentor e’lonlari narxini 30k–60k oralig‘iga keltiradi; eski bronning moliyaviy nusxasini o‘zgartirmaydi.

`settings.py`, `.env`, `.env.local` va SQLite baza fayli patch tomonidan almashtirilmaydi. Oldingi kod `backups/filter-update-*` ichiga nusxalanadi. Yangi npm/pip paket kerak emas. To‘lov qo‘lda tekshiriladi; Payme/Click integratsiyasi qo‘shilmagan.

## Tekshirish

```sh
python3 backend/manage.py test core.test_directory_filters core.test_payment_updates core.test_pricing
cd frontend
npm run typecheck
npm run build
```
