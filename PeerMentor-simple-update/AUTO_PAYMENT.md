# Avtomatik to‘lov tasdig‘i: tavsiya etilgan yechim

## Tanlov: Payme Merchant API

Bu patchda avtomatik bank integratsiyasi YO‘Q. Hozirgi kartaga qo‘lda to‘lov va admin tekshiruvi saqlangan. Quyidagi reja keyingi integratsiya uchun; hech qanday tugma yoki student yuborgan tranzaksiya raqami o‘zicha payment_status=verified qilmaydi.

Tavsiya etilgan oqim:

1. Student darsni band qiladi. Narx va 20%/80% snapshot backendda hisoblanadi.
2. “Payme orqali to‘lash” checkout’i aynan shu booking bilan bog‘lanadi.
3. Payme backendga Merchant API so‘rovlarini yuboradi. Auth serverda tekshiriladi; booking, summa, tranzaksiya identifikatori va ruxsat etilgan holatlar mos bo‘lishi shart.
4. Tasdiqlangan PerformTransaction bajarilganda booking `confirmed`, payment `verified` bo‘ladi. Qayta kelgan so‘rov yangi tasdiq/to‘lov yaratmaydi.
5. 60 daqiqalik rezervatsiya muddati, bandlik, ikki ishtirokchi konflikti va kech tushgan pul/refund qoidalari saqlanadi.
6. Dars yakunini student yoki admin tasdiqlagandan so‘ng mentorning 80% ulushi payout uchun tayyor bo‘ladi. Mentor kartasiga avtomatik o‘tkazish alohida integratsiya; bu yechim faqat kiruvchi to‘lovni avtomatik tekshiradi.

Oddiy shaxsiy kartaga o‘tkazma bo‘lganini sayt mustaqil ravishda bilmaydi. Buning uchun bank/to‘lov provayderi bergan tekshiriladigan API xabari kerak. “Pul yubordim” bosilishi va foydalanuvchi bergan chek/tranzaksiya raqami bu API xabari o‘rnini bosa olmaydi.

## Ulanish uchun kerak

- Payme Business’dan ulanishi tasdiqlangan merchant/kassa ID va API kalit.
- Provayder yetib bora oladigan HTTPS backend endpoint. Oddiy localhost provayder uchun ochiq emas; sandbox uchun xavfsiz HTTPS tunnel yoki test server kerak.
- Sandbox’da rasmiy Merchant API metodlarini tekshirish, tranzaksiya holatlarini doimiy bazada saqlash, retry/idempotency, xato summa/auth, expired reservation, provider cancellation/refund va reconciliation testlari.
- Kalitlarni faqat backend muhit sozlamalariga joylash. Git, React yoki chatga kiritmaslik.

Faqat `PerformTransaction` nomli ochiq endpoint qo‘shish yetarli emas: auth tekshiruvisiz soxta to‘lov yuborish mumkin. To‘liq rasmiy protokol va sandbox tekshiruvi talab qilinadi. Ushbu hujjatdagi Merchant API tavsiyasi joriy kodda ulangan to‘lov tizimi sifatida ko‘rsatilmagan.

## Rasmiy manbalar

- [Payme Merchant API metodlari](https://developer.help.paycom.uz/metody-merchant-api/)
- [PerformTransaction — to‘lovni o‘tkazish](https://developer.help.paycom.uz/metody-merchant-api/performtransaction/)
- [Request formati va Authorization](https://developer.help.paycom.uz/protokol-merchant-api/format-zaprosa/)
- [Protokol va HTTPS](https://developer.help.paycom.uz/protokol-merchant-api/)
- [Kassa ID va kalit](https://developer.help.paycom.uz/poisk-klyucha-i-id-kassy-v-lichnom-kabinete/)
- [Ulash va sandbox tartibi](https://developer.help.paycom.uz/nastroyka-vzaimodeystviya/)
