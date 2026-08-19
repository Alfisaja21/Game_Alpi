GAME ALPI — UPDATE WEREWOLF V1 + CATUR V1

DITAMBAHKAN
- Werewolf V1 dibuka di homepage.
- Catur V1 dibuka di homepage.
- Jumlah game aktif homepage menjadi 5.

WEREWOLF V1
- Multi HP 5–20 pemain.
- Moderator otomatis.
- Role dasar:
  Werewolf, Warga, Seer/Peramal, Doctor.
- Jumlah Werewolf otomatis:
  5–7 = 1 Werewolf
  8–11 = 2 Werewolf
  12–15 = 3 Werewolf
  16–20 = 4 Werewolf
- Alur otomatis:
  Malam Werewolf → Seer → Doctor → Pagi → Diskusi → Voting → Hasil.
- Timer:
  Aksi malam 30 detik.
  Diskusi 120 detik.
  Voting 30 detik.
- Host bisa mempercepat diskusi ke Voting.
- Pemain mati tetap menonton tetapi tidak bisa aksi/vote.
- Role pemain mati tidak dibuka sampai game selesai.
- Warga menang jika semua Werewolf mati.
- Werewolf menang jika jumlah Werewolf hidup >= pemain non-Werewolf.
- Host dapat berpindah jika Host keluar.

CATUR V1
- Multi HP 2 pemain.
- Mode 1 HP / pass-and-play.
- Mode 1 HP otomatis memutar papan mengikuti giliran.
- Menggunakan aturan legal chess.js:
  check, checkmate, stalemate, castling, en passant, promotion.
- Promotion dapat memilih Queen, Rook, Bishop, Knight.
- Warna putih/hitam Multi HP diacak.
- Timer:
  Tanpa batas, 5, 10, atau 15 menit.
- Menyerah.
- Tawarkan / terima / tolak seri.
- Riwayat langkah.
- Rematch; warna ditukar pada rematch.
- Reconnect Multi HP melalui session localStorage.

FILE DALAM ZIP
- index.html
- werewolf/index.html
- werewolf/style.css
- werewolf/script.js
- catur/index.html
- catur/style.css
- catur/script.js
- UPDATE.txt

SQL TIDAK ADA DI ZIP.
Jalankan terpisah:
1. SUPABASE_WEREWOLF_V1.sql
2. SUPABASE_CATUR_V1.sql

CARA UPDATE
1. Jalankan kedua SQL di Supabase.
2. Pastikan masing-masing menghasilkan Success.
3. Replace root index.html.
4. Tambahkan folder werewolf.
5. Tambahkan folder catur.
6. Commit GitHub.
7. Tunggu Vercel deploy.
8. Test Werewolf minimal 5 HP.
9. Test Catur Multi HP dengan 2 HP dan Catur 1 HP pada satu HP.

CATATAN V1
- Werewolf sengaja masih memakai role dan aturan dasar agar mudah diuji bersama teman.
- Catur Multi HP memvalidasi legal move di frontend menggunakan chess.js dan memakai update database atomik untuk sinkronisasi room. Ini cocok untuk permainan teman, tetapi belum ditujukan sebagai sistem turnamen anti-cheat.
