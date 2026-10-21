# EduYor — logotip asosidagi yangi dizayn

Yuborilgan logotipning o‘zi header, footer, bosh sahifa va kabinetda ishlatiladi. Asosiy ranglar: to‘q ko‘k, yorqin ko‘k va to‘q sariq. EduYor nomining oxirida nuqta yo‘q.

Kabinet 3-rasm uslubida qayta qurildi: yon menyu, yumshoq binafsha/pushti dars kartalari, o‘ng tomonda kalendar. Bosh sahifa, mentor katalogi, bron, to‘lov va dars sahifalari umumiy yangi uslubda. Reyting yoki soxta foydalanuvchi sonlari qo‘shilmagan.

- Barcha mentorlarning yangi darslari aniq 50 daqiqa. Masalan, 18:00–18:50. Narx bir dars uchun; 50/60 ga kamaytirilmaydi.
- Narx 30 000–60 000 so‘m; 20% platformaga, 80% mentorga.
- Bronni to‘lov davomida saqlash muddati alohida: 60 daqiqa.
- Oldin band qilingan darslarning saqlangan vaqti va summasi o‘zgarmaydi. Kabinetda ularning haqiqiy davomiyligi ko‘rinadi.
- Kabinetda “O‘rganaman / Dars beraman”, holat va sana filtrlari ishlaydi. Kalendar nuqtalari yuklangan ro‘yxatdagi darslar sanasini ko‘rsatadi; sana tanlanganda barcha shaxsiy darslardan izlaydi.
- Mentor vaqti uchun alohida forma va foydalanuvchi uchun darsni bekor qilish tugmasi yo‘q.
- “Pul yubordim” — to‘lov xabari. Tranzaksiya raqami ixtiyoriy. Admin bank tushumini tekshiradi; xabarning o‘zi to‘lovni tasdiqlamaydi.
- Mentor tasdiqlangan darsga Google Meet havolasini qo‘shadi, student uni kabinet va dars sahifasida ko‘radi.

## O‘rnatish — mavjud mahalliy loyihaga

Backend va frontend serverlarini Ctrl+C bilan to‘xtating. Terminalda `backend/` va `frontend/` joylashgan asosiy loyiha papkasini oching. Mavjud Python virtual muhitingizni faollashtiring.

```sh
unzip -o ~/Downloads/EduYor-redesign.zip -d .
python3 EduYor-redesign/apply_patch.py
python3 backend/manage.py migrate
python3 backend/manage.py runserver 127.0.0.1:8000
```

Ikkinchi terminalda, shu asosiy loyiha papkasidan:

```sh
cd frontend
npm run dev
```

http://localhost:3000 ni oching. Ochiq eski sahifani Cmd+Shift+R / Ctrl+Shift+R bilan yangilang. Agar frontend production rejimida ishlasa, `npm run build` va keyin `npm start` qiling.

Installer `settings.py`, `.env`, SQLite bazasi va media fayllarini almashtirmaydi. Hozir ishlayotgan SQLite sozlamangiz qoladi. Almashtirilgan kod `backups/eduyor-redesign-*` ichiga nusxalanadi. Takror ishga tushirish xavfsiz. Ushbu patch uchun yangi npm/pip paket talab qilinmaydi.

ZIP avvalgi nom, filtrlar, birlashtirilgan bio, til/narx tanlash va qo‘lda to‘lov tekshiruvi o‘zgarishlarini ham o‘z ichiga oladi. Avvalgi 0002/0003 migratsiyalar hali bajarilmagan bo‘lsa, migrate ularni bajaradi; eski bron narxlarini o‘zgartirmaydi.

## Tekshirish

Loyihaning mavjud virtual muhitida:

```sh
python3 backend/manage.py check
python3 backend/manage.py test core
cd frontend
npm run typecheck
npm run build
```

Bu muhitda 80 test, typecheck va production build o‘tdi; 3 PostgreSQL parallel so‘rov testi SQLite’da o‘tkazilmadi. Brauzer preview serveri ochilmadi, shuning uchun desktop/mobil vizual tekshiruv tugallanmagan. Tafsilotlar VERIFICATION.md ichida.
