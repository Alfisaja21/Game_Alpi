GAME ALPI — POKER + DOMINO + AUDIT BUG

CATATAN FILE
- Mulai update ini nama file catatan permanen adalah: readme.txt
- SQL tetap dipisahkan dari ZIP.
- ZIP hanya berisi file yang benar-benar berubah.

HOMEPAGE
DITAMBAHKAN:
- Poker sebagai game terkunci / Segera.
- Domino sebagai game terkunci / Segera.

DIPERBAIKI:
- Jumlah calon game menjadi 11 konsep.
- "Tebak" diperjelas menjadi "Tebak Angka".
- Tile "Game Baru" di area 5 game aktif dihapus karena membuat jumlah "5 aktif" terlihat tidak konsisten.
- Indikator hijau Online yang sebenarnya hanya dekorasi diganti badge MOBILE agar tidak memberi status koneksi palsu.
- Warna tile Werewolf dan Catur dibuat lebih berbeda.
- Section game mendatang dibuat sedikit lebih ringkas untuk HP.
- Teks bantuan homepage dibuat lebih akurat.

TEBAK ANGKA
- Label lama "GAME KEDUA" diganti "SOLO • 1 PEMAIN".
- Kalimat pembuka dibuat lebih natural dan tidak memakai gaya seolah AI memilih angka.

IMPOSTOR 1 HP
- Maksimal pemain sekarang benar-benar 20.
- Nama kosong / duplikat memberi pesan yang jelas.
- Tombol Tambah nonaktif saat sudah 20 pemain.
- Save lama yang berisi >20 pemain dibatasi ke 20 saat dimuat.
- Nama pemain yang bicara pertama sekarang tampil pada fase diskusi. Sebelumnya logic sudah memilih pemain, tetapi elemen tampilannya belum ada.

UNO
- Notifikasi mengambil kartu tampil sedikit lebih lama.
- Jika hanya mengambil 1 kartu, kartu yang didapat ditulis lebih jelas bila dapat dikenali dari hand baru.
- Draw Until Playable sekarang jelas menulis bahwa giliran tetap pada pemain tersebut.
- Bug reconnect 30 detik diperbaiki:
  sebelumnya client menghitung 30 detik, tetapi database masih mengikuti timer turn. Timer 60 detik atau Tanpa Batas menyebabkan pemain offline tidak benar-benar dilewati setelah 30 detik.
- Bug Multi +4 diperbaiki:
  timeout Challenge sebelumnya tetap mengambil +4 walaupun batch sebenarnya +8 / +12 / dst.
- Kedua bug database ini membutuhkan SUPABASE_UNO_V4_1_FIX.sql.

CATUR
- BUG timer mode 1 HP diperbaiki. Sebelumnya setelah sebuah langkah, waktu yang dipotong justru milik pemain berikutnya.
- Mode 1 HP tidak lagi memakai browser prompt untuk memilih timer; sekarang memakai panel Game Alpi.
- Jika lawan Multi HP benar-benar keluar, tombol Rematch disembunyikan.
- Tombol keluar saat pertandingan meminta konfirmasi.
- Interval timer dihentikan saat partai selesai.

WEREWOLF
- Hasil Seer sekarang muncul sebagai notifikasi rahasia yang tetap terlihat beberapa detik walaupun fase realtime langsung berpindah.
- Werewolf mendapat konfirmasi target tersimpan.
- Doctor mendapat konfirmasi target perlindungan tersimpan.

HASIL KROSCEK UMUM
- JavaScript file yang diubah lolos syntax check.
- ID HTML yang dipanggil JavaScript sudah dicek tersedia.
- Duplicate ID pada HTML yang diubah sudah dicek.
- Color Clash lama tetap hanya redirect ke /uno/, sehingga script Color Clash lama tidak dipakai.
- Impostor Multi HP tetap memakai batas 3–20 dari revisi backend sebelumnya.
- Werewolf V1 tetap memakai role dasar dan kondisi kemenangan yang sudah disepakati.
- Catur Multi HP tetap memakai chess.js untuk langkah legal. Cocok untuk game teman, belum ditujukan sebagai sistem anti-cheat turnamen.

FILE DALAM ZIP
- index.html
- style.css
- tebak-angka/index.html
- impostor/single.html
- impostor/single.js
- uno/script.js
- catur/index.html
- catur/style.css
- catur/script.js
- werewolf/style.css
- werewolf/script.js
- readme.txt

SQL TERPISAH
- SUPABASE_UNO_V4_1_FIX.sql

CARA UPDATE
1. Jalankan SUPABASE_UNO_V4_1_FIX.sql di Supabase SQL Editor.
2. Pastikan hasilnya Success.
3. Ekstrak ZIP.
4. Replace hanya file yang terdapat di ZIP sesuai folder.
5. Commit ke GitHub.
6. Tunggu Vercel redeploy.
7. Refresh dari HP.

TES PALING PENTING
UNO:
- Timer 60 detik → pemain yang sedang giliran kehilangan koneksi → setelah ±30 detik harus otomatis ambil kartu / penalti dan giliran pindah.
- Timer Tanpa Batas → ulangi test offline 30 detik.
- Buang dua +4 → biarkan target timeout pada Challenge → penalti harus mengikuti total batch.
- Test Draw Until Playable → notifikasi harus menulis bahwa giliran tetap pada pemain tersebut.

CATUR:
- Mode 1 HP timer 5 menit → Putih menunggu beberapa detik lalu bergerak → waktu Putih yang berkurang, bukan Hitam.
- Test promotion, castling, checkmate, menyerah, dan rematch.
- Multi HP → satu pemain keluar → pemain tersisa tidak ditawari rematch room yang kehilangan lawan.

IMPOSTOR:
- Mode 1 HP → tambah sampai 20 pemain.
- Mulai game → nama pemain pertama yang harus bicara harus tampil di diskusi.

WEREWOLF:
- Role Seer → pilih pemain → hasil cek harus tetap terlihat beberapa detik.
