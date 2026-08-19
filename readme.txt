GAME ALPI — BOT TEST V1

AKSES DEVELOPER MODE
- Tidak ada password.
- Dari homepage, tap logo/tulisan "Game Alpi" sebanyak 5 kali dalam sekitar 2,6 detik.
- Developer Mode langsung aktif di device/browser tersebut.
- Status disimpan di localStorage.
- Tap 5 kali lagi untuk menonaktifkan.
- Saat aktif akan muncul badge kecil "🧪 DEV".
- Ini fitur tersembunyi, BUKAN sistem keamanan. Orang yang mengetahui caranya juga dapat mengaktifkannya.

BOT YANG DITAMBAHKAN

1. UNO — DEVELOPER ONLY
- Test Tools hanya terlihat ketika Developer Mode aktif dan kamu adalah Host.
- +1 Bot
- +5 Bot
- Hapus semua Bot
- Kecepatan: Normal / Cepat / Instan
- Bot menggunakan pemain room sungguhan di Supabase sehingga bisa menguji multiplayer.
- Bot memainkan kartu legal.
- Bot mendukung Multi Action.
- Bot mendukung stacking +2/+4.
- Bot memilih warna Wild berdasarkan kartu tersisa.
- Bot memanggil UNO saat tinggal 1 kartu.
- Bot menerima / mencoba Challenge +4.
- Bot menangani 7–0 dasar.
- V1 belum membuat bot melakukan Jump-In saat giliran pemain lain.

2. IMPOSTOR — DEVELOPER ONLY
- Bot dapat ditambahkan sampai kapasitas 20 pemain.
- Bot ikut pembagian role.
- Bot otomatis menandai role sudah dilihat.
- Bot otomatis melakukan voting.
- Bot ikut eliminasi, skor, dan multi-round.
- Bot V1 tidak berbicara / memberi clue suara saat fase diskusi.
- Tujuannya terutama untuk menguji alur game ketika kamu sendirian.

3. WEREWOLF — DEVELOPER ONLY
- Bot dapat mengisi room sampai 20 pemain.
- Bot ikut pembagian role Werewolf/Warga/Seer/Doctor.
- Bot Werewolf otomatis memilih target.
- Bot Seer otomatis mengecek pemain.
- Bot Doctor otomatis melindungi pemain.
- Bot otomatis voting.
- Target bot V1 dipilih sederhana/random.
- Bot tidak melakukan percakapan saat fase diskusi.

4. CATUR — PUBLIC
- Mode baru "Lawan Bot" terlihat untuk semua pengguna.
- Tidak membutuhkan Supabase/room.
- Pilihan level:
  Mudah = langkah legal acak.
  Normal = memilih langkah berdasarkan evaluasi sederhana.
  Sulit = pencarian minimax ringan agar tetap nyaman di HP.
- Pilih warna: Acak / Putih / Hitam.
- Timer: Tanpa batas / 5 / 10 / 15 menit.
- Check, checkmate, castling, en passant, promotion tetap mengikuti chess.js.
- Rematch tersedia.
- Bot Catur V1 bukan Stockfish dan bukan engine turnamen. Fokusnya permainan santai + testing.

POKER & DOMINO
- Belum diberi bot karena gameplay Poker dan Domino sendiri belum dibuat.
- Saat gamenya dibuat, fondasi Developer Mode ini dapat dipakai kembali.

FILE DALAM ZIP
- developer.js
- index.html
- style.css
- uno/index.html
- uno/style.css
- uno/script.js
- impostor/multi.html
- impostor/style.css
- impostor/multi.js
- werewolf/index.html
- werewolf/style.css
- werewolf/script.js
- catur/index.html
- catur/style.css
- catur/script.js
- readme.txt

SQL TERPISAH
- SUPABASE_GAME_ALPI_BOT_TEST_V1.sql

URUTAN UPDATE
1. Pastikan SQL game sebelumnya sudah dijalankan, termasuk patch UNO V4.1 jika belum.
2. Jalankan SUPABASE_GAME_ALPI_BOT_TEST_V1.sql.
3. Pastikan Supabase menampilkan Success.
4. Ekstrak ZIP.
5. Replace hanya file yang ada di ZIP sesuai folder.
6. Commit GitHub.
7. Tunggu Vercel selesai deploy.
8. Buka homepage.
9. Tap "Game Alpi" 5 kali.
10. Masuk UNO / Impostor Multi HP / Werewolf dan buat room sebagai Host.
11. Test Tools bot akan muncul.

TES CEPAT YANG DISARANKAN

UNO
- Buat room sendiri.
- Aktifkan Developer Mode.
- Tambah 3–5 bot.
- Mulai game.
- Pastikan giliran bot berjalan otomatis.
- Test stacking, Wild, Multi Action, Challenge +4, UNO, dan kemenangan.

IMPOSTOR
- Buat room sendiri.
- Tambah minimal 2 bot sehingga total >=3 pemain.
- Mulai game.
- Bot harus otomatis melewati fase reveal.
- Saat Voting, bot harus mengirim vote sendiri.

WEREWOLF
- Buat room sendiri.
- Tambah minimal 4 bot sehingga total >=5.
- Mulai.
- Perhatikan fase Werewolf → Seer → Doctor berjalan dengan aksi bot.
- Saat Voting, bot harus mengirim vote.

CATUR
- Pilih Lawan Bot.
- Test sebagai Putih dan Hitam.
- Test level Mudah/Normal/Sulit.
- Test promotion, castling, checkmate, menyerah, timer, dan rematch.

CATATAN ARSITEKTUR
- Bot multiplayer dijalankan oleh browser Host, bukan server worker terpisah.
- Jadi saat semua pemain manusia menutup browser, bot juga tidak akan terus bermain sendiri.
- Untuk kebutuhanmu saat menguji sendirian, model ini lebih sederhana dan memakai logic game multiplayer yang sama.
