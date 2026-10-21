# Tekshiruv — 2026-10-21

- Django/SQLite: 42 ta test topildi; 39 ta o‘tdi, PostgreSQL row lock talab qiladigan 3 ta concurrency testi skip qilindi.
- Yangi testlar: platforma kartasi rekvizitlari, noto‘g‘ri konfiguratsiyada bron bloklanishi, egasining pending/paused e’loni, approved e’lonni ikki marta ko‘rsatmaslik, studentga tegishli Meet alertlari maxfiyligi va dars tugashining o‘zi payout yaratmasligi.
- TypeScript tekshiruvi va Next.js production build o‘tdi.
- Patch installer eski ZIP’dan ochilgan loyiha nusxasida tekshirildi: 12 fayl o‘rnatildi; settings.py, .env va db.sqlite3 aynan saqlandi; eski fayllar zaxiralandi; takroriy o‘rnatish 0 faylni o‘zgartirdi.
- Haqiqiy bank to‘lovi/tekshiruvi, mentor transferi va Meet qo‘ng‘irog‘i bajarilmadi. Brauzer orqali vizual va notification timer tekshiruvi bu muhitda bajarilmadi; API notification filtri test bilan tekshirildi.
- SQLite bilan parallel production bron himoyasi tasdiqlanmagan. Bu patch siz tanlagan local SQLite sozlamasini almashtirmaydi.
