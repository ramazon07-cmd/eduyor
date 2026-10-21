# Bekor qilishsiz, mentor jadvalisiz bron

## Qo‘llash

Serverlarni Ctrl+C bilan to‘xtating. ZIP’ni Downloads’ga yuklab, loyiha ildizida bajaring:

```sh
cd ~/Downloads/peermentor
unzip ~/Downloads/PeerMentor-booking-update.zip
python3 PeerMentor-booking-update/apply_patch.py
```

Bu patch avvalgi karta/Google Meet yangilanishlarini ham o‘z ichiga oladi; oldingi patchni alohida qo‘llash shart emas. SQLite `.db`, `.env`, `settings.py`, media va mavjud akkauntlar o‘zgarmaydi. Eski kod `backups/` ga saqlanadi. Model o‘zgarmagan — migration kerak emas. Backend va frontend serverlarini qayta ishga tushiring.

## Yangi tartib

- Dars sahifasidagi “Darsni bekor qilish” tugmasi olib tashlandi. Student va mentor eski API orqali ham bekor qila olmaydi. Admin support/refund amallari saqlanadi.
- Mentor jadval kiritmaydi. “Jadvalim” bo‘limi va arizadagi jadval havolalari olib tashlandi.
- Student har kuni soat 00:00–23:00 oralig‘idagi soat boshlarini tanlaydi. Dars 60 daqiqa. Avvalgi kamida 24 soat oldin va keyingi 30 kun chegaralari saqlanadi. Vaqt zonasi ekranda ko‘rsatiladi.
- Band vaqtlar ikkala ishtirokchi va ikkala rolda tekshiriladi. Pending hold tugashi yoki admin hal qilishi bilan vaqt yana ochilishi mumkin.
- Legacy AvailabilityRule/BlockedDate ma’lumotlari o‘chirilmaydi, ammo yangi slotlar ularga qarab cheklanmaydi. Mavjud tasdiqlangan darslar va moliyaviy snapshotlar o‘zgarmaydi.
- Mentor e’loni uchun admin tasdig‘i va listing pauzasi qoidalari saqlanadi. O‘z e’loningiz holati bilan kartalar orasida ko‘rinadi.
- Google Meet havolasini mentor kiritadi; student kabinetida bildirishnoma chiqadi.

## To‘lov

Kartaga oddiy o‘tkazmani avtomatik aniqlash hozir qo‘shilmagan. Hozirgi admin tekshiruvi saqlanadi. Haqiqiy auto-approval uchun tavsiya qilingan Payme Merchant API ulanishi va talablar `AUTO_PAYMENT.md` da yozilgan.

Avvalgi karta sozlamalari ishlayveradi: backend/.env ichida PAYMENT_CARD_NUMBER, PAYMENT_CARD_HOLDER, PAYMENT_BANK_NAME, PAYMENT_INSTRUCTIONS va PAYMENT_SUPPORT. Eski sinov yo‘riqnomasini haqiqiy to‘lov qabul qilishdan oldin almashtiring. Provayder API kalitlari ushbu patch uchun talab qilinmaydi va bu patch ularni ishlatmaydi.
