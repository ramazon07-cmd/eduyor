# PeerMentor · soddalashtirilgan profil va to‘lov

Jamlangan patch: oldingi dizayn, filtrlar, 30–60 ming so‘mlik narx, 20% komissiya, Google Meet va ushbu o‘zgarishlar kiritilgan. Faqat shu ZIPni o‘rnatish kifoya.

## O‘rnatish

Ikkala serverni Ctrl+C bilan to‘xtating. Faol `.venv` terminalida:

```sh
cd ~/Downloads/peermentor
unzip -o ~/Downloads/PeerMentor-simple-update.zip -d .
python3 PeerMentor-simple-update/apply_patch.py ~/Downloads/peermentor
python3 backend/manage.py migrate
python3 backend/manage.py runserver
```

Agar virtual muhit faol bo‘lmasa, loyiha ildizidan `source .venv/bin/activate`.

Ikkinchi terminal:

```sh
cd ~/Downloads/peermentor/frontend
npm run dev
```

Yangi paketlar kerak emas. `.env`, `settings.py`, `.env.local`, SQLite baza fayli almashtirilmaydi. Eski kod `backups/simple-update-*` ichiga nusxalanadi. Migratsiya mavjud profil matnlarini birlashtiradi; bronning eski moliyaviy nusxalarini o‘zgartirmaydi.

## Mentor formasi

- Bio va “Tajriba va yutuqlar” — bitta 3000 belgilik matn maydoni.
- Eski matnlar avtomatik birlashadi. Bio/yutuqlar aynan bir xil bo‘lsa, qayta ko‘rsatilmaydi. Mentor tasdig‘i migratsiyaning o‘zidan bekor bo‘lmaydi.
- Ta’lim tili: O‘zbekcha / Inglizcha / Ruscha; bir nechta tanlanadi. Mavjud boshqa til nomlari ham yo‘qotilmaydi.
- Narx: 30 / 35 / 40 / 45 / 50 / 55 / 60 ming so‘mlik ro‘yxat. Avval kiritilgan diapazon ichidagi boshqa narx saqlanadi.
- Public profil ham bitta umumiy matnni ko‘rsatadi. Legacy experience ustuni va oldingi API inputi moslik uchun saqlangan.

## Student to‘lovi

1. Student platforma kartasiga pul yuboradi.
2. **Pul yubordim** tugmasini bosadi. Tranzaksiya raqami ixtiyoriy, alohida ochiladigan bo‘limda.
3. “To‘lov xabaringiz yuborildi” holati ko‘rinadi. Admin tekshiradi; sahifa avtomatik yangilanadi.

Bu tugma faqat xabar yuboradi. Bank tushumi tasdiqlanmaguncha dars confirmed bo‘lmaydi. 60 daqiqalik rezervatsiya muddati tekshiruv paytida ham amal qiladi.

## Admin tekshiruvi

Django Admin → Bookings → **To‘lov xabarlari** → kerakli darsning **Tekshirish** havolasi.

Student/mentor, to‘liq summa, student xabari va rezervatsiya muddati bitta sahifada. Admin bank ilovasida tushumni mustaqil solishtiradi, bankdagi haqiqiy tranzaksiya raqamini kiritadi, “tekshirdim” belgisini qo‘yib **To‘lovni va darsni tasdiqlash** tugmasini bosadi.

- Forma student yozgan raqamni bank isboti sifatida avtomatik to‘ldirmaydi.
- Staff bo‘lishning o‘zi yetmaydi: booking change permission yoki superuser kerak.
- Muddati o‘tgan bron tasdiqlanmaydi. Bank tushumi qayd etilsa refund_required bo‘ladi; to‘liq pul qo‘lda qaytariladi.
- Takror bosish tasdiq yoki to‘lovni ko‘paytirmaydi. Server foydalanuvchi qatorlarini deterministik tartibda lock qilib, mavjud bronni qayta tekshiradi.
- Eski admin operatsiyalar sahifasi ham saqlangan. Mentor to‘lovi dars yakuni tasdiqlangach qo‘lda o‘tkaziladi.

Agar `.env`dagi eski `PAYMENT_INSTRUCTIONS` matnida tranzaksiya raqami majburiy deyilgan bo‘lsa, uni moslang: `To‘lovni shu kartaga yuboring va “Pul yubordim” tugmasini bosing.`

## Tekshirish

```sh
python3 backend/manage.py makemigrations --check --dry-run
python3 backend/manage.py test core
cd frontend
npm run typecheck
npm run build
```
