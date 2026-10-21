# PeerMentor: karta to‘lovi + Google Meet + o‘z e’loningiz

## O‘rnatish

ZIP faylni Downloads papkasiga yuklang. Ikki serverni Ctrl+C bilan to‘xtating va loyiha papkasida:

```sh
cd ~/Downloads/peermentor
unzip ~/Downloads/PeerMentor-update.zip
python3 PeerMentor-update/apply_patch.py
```

Script faqat patchdagi kod fayllarini almashtiradi, oldingilarini `backups/` ga saqlaydi. `backend/config/settings.py`, `backend/.env`, `backend/db.sqlite3`, media va frontend `.env.local` saqlanadi. Yangi migration yo‘q. Qayta qo‘llash bir xil fayllarni yana almashtirmaydi.

## Platforma kartasi

`backend/.env` ichida quyidagi qiymatlarni o‘zingizning haqiqiy rekvizitlaringiz bilan kiriting. Takrorlangan kalit qoldirmang. PIN, CVV, amal qilish muddati yoki bank paroli kerak emas.

```dotenv
PAYMENT_CARD_NUMBER=BU_YERGA_16_XONALI_KARTA_RAQAMI
PAYMENT_CARD_HOLDER=KARTA_EGASINING_ISMI
PAYMENT_BANK_NAME=BANK_NOMI
PAYMENT_INSTRUCTIONS=To‘lovni shu kartaga yuboring va bank ilovasidagi tranzaksiya raqamini kiriting.
PAYMENT_SUPPORT=YORDAM_UCHUN_TELEGRAM_YOKI_TELEFON
```

Karta raqami 16 ta raqamdan iborat bo‘lsin. Bo‘sh joy va tire mumkin. Xato raqam yoki karta egasi yo‘qligida yangi bron qabul qilinmaydi. Karta maydonlari bo‘sh bo‘lsa, avvalgi PAYMENT_INSTRUCTIONS orqali qo‘lda to‘lov yo‘riqnomasi ishlayveradi. Eski SINOV yo‘riqnomasini haqiqiy qabul boshlanishidan oldin almashtiring.

## Ishga tushirish

Terminal 1, loyiha ildizida:

```sh
source .venv/bin/activate
python backend/manage.py runserver 127.0.0.1:8000
```

Terminal 2:

```sh
cd ~/Downloads/peermentor/frontend
npm run dev
```

Brauzerni yangilang yoki hisobdan chiqib, qayta kiring — yangi e’lon holati yuklanadi.

## To‘lov tartibi

1. Student 60 daqiqalik darsni band qiladi va platforma kartasini ko‘radi.
2. Bank ilovasidan pul yuborib, tranzaksiya raqamini kiritadi va **Pul yubordim** tugmasini bosadi.
3. Admin bankdan pul tushganini mustaqil tekshiradi. Admin → Bookings → kerakli dars → bankdagi receipt reference → **I independently verified receipt → confirm**.
4. Bron va to‘lov tekshiruvi uchun 60 daqiqalik rezervatsiya muddati amal qiladi. Kech tushgan pul tasdiqlanmaydi, to‘liq qaytarish uchun belgilanadi.
5. Dars yakunlangach student **Dars yakunlanganini tasdiqlash** tugmasini bosadi. Muammo bo‘lsa admin hal qiladi. Faqat soat tugashi yoki “Pul yubordim” tugmasi pulni chiqarishga asos bo‘lmaydi.
6. Admin mentorning 90% ulushini bank ilovasidan qo‘lda yuboradi va **Record mentor transfer already sent** orqali o‘tkazma raqamini qayd etadi. 10% platformada qoladi.

Bu avtomatik bank integratsiyasi emas. To‘lov olish, tekshirish, refund va mentor transferi qo‘lda; platforma holatlar va summalarni hisobga oladi.

## Google Meet

- Mentor to‘lovi tasdiqlangan darsini ochadi, **Meet ochish** orqali Google Meet’da uchrashuv yaratadi va standart `https://meet.google.com/abc-defg-hij` havolasini platformaga kiritadi.
- **Havolani studentga yuborish** havolani saqlaydi. Student platformada bo‘lsa, 20 soniyagacha kabinet bildirishnomasi chiqadi. Darslarim ro‘yxati 20 soniyada, dars sahifasi 15 soniyada yangilanadi.
- Student **Darsga qo‘shilish** orqali Google Meet’ni ochadi. Havola faqat dars ishtirokchilari va adminga ochiq.
- Platforma ochiq bo‘lmasa push, email yoki Telegram xabari yuborilmaydi. Qayta kirganda yaqinlashayotgan darsning tayyor havolasi ko‘rinadi.

## Mentor e’lonim

O‘z e’loningiz birinchi sahifadagi kartalar orasida **Sizning e’loningiz** yozuvi bilan ko‘rinadi. Pending/rejected/paused e’lon shu ko‘rinishda faqat egasiga ko‘rinadi. Qidiruv va narx/fan filtrlari o‘z e’loningizga ham amal qiladi — kerak bo‘lsa filtrlarni tozalang.

Boshqalarga chiqishi uchun: Admin → Mentor profiles → o‘z profilingiz → `approval=approved`, `is_paused=False` → Save. Mavjud user faol bo‘lsin. Bio/fan/tajriba o‘zgarsa qayta ko‘rib chiqish kerak bo‘ladi. Dars band qilish uchun haftalik jadval ham qo‘shing. O‘zingizdan dars band qila olmaysiz.
