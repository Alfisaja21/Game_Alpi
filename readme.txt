GAME ALPI — WEREWOLF V2 REVISION

BASELINE
Update ini dibuat di atas Werewolf terbaru + UI Dark 3D yang sudah disetujui.
Hanya bagian Werewolf yang diubah.

FITUR V2

1. MODERATOR OTOMATIS
- Narasi teks otomatis di setiap fase.
- Overlay horor saat fase berubah.
- Narasi berbeda untuk:
  Malam Werewolf
  Malam Seer
  Malam Doctor
  Pagi
  Diskusi
  Voting
  Hasil voting
  Kemenangan
- Audio hanya diputar dari HP Host agar 5–20 HP tidak berbicara bersamaan.
- Host memiliki tombol Audio ON/OFF.
- Pemain lain tetap melihat teks narasi.

PENTING TENTANG SUARA NARATOR
- Paket ini SUDAH berisi efek audio lokal:
  ambience-night.mp3
  howl.mp3
  morning.mp3
  vote.mp3
  role-reveal.mp3
  death.mp3
- File tersebut bukan TTS dan dipakai untuk atmosfer/efek game.
- Coding spoken narrator juga sudah siap memakai file MP3 manusia di:
  werewolf/audio/narrator/
- Nama file voice pack yang didukung:
  night-wolf.mp3
  night-seer.mp3
  night-doctor.mp3
  morning.mp3
  discussion.mp3
  voting.mp3
  vote-result.mp3
  town-win.mp3
  wolf-win.mp3
- Voice manusia tidak dimasukkan karena ChatGPT di sesi ini tidak memiliki alat perekam suara manusia. Saya sengaja TIDAK menggantinya dengan suara TTS/AI karena sebelumnya diminta suara yang tidak terdengar seperti AI.
- Jika file voice manusia tersebut ditambahkan nanti, coding akan memutarnya otomatis tanpa perlu mengubah script.js.

2. VISUAL / 3D RINGAN
- Mini scene desa di atas gameplay.
- Bulan / matahari.
- Siluet desa.
- Gunung.
- Kabut bergerak.
- Bintang.
- Transisi malam ke siang.
- Semua menggunakan CSS ringan, tidak memakai Three.js/WebGL.
- Aman untuk target HP.

3. PHASE TRACKER
Fase sekarang terlihat jelas:
Malam → Pagi → Diskusi → Voting.
Fase aktif diberi highlight.

4. KARTU ROLE BARU
- Tombol KARTU ROLE dibuat jauh lebih terlihat.
- Tombol memberi pulse sampai role pernah dilihat.
- Role tidak langsung terbuka ketika tombol ditekan.
- Pemain harus TAHAN tombol "Tahan untuk melihat role".
- Kartu berputar 3D.
- Saat jari dilepas, role otomatis tertutup kembali.
- Lebih aman ketika pemain duduk berdekatan.

5. ANTI ROLE STREAK
Membutuhkan SQL V2.
- Pembagian role tetap random.
- Jika pemain baru mendapat Werewolf, peluang Werewolf pada match berikutnya turun drastis.
- Jika pemain mendapat Werewolf dua kali berturut-turut, peluang ketiga menjadi sangat kecil.
- Seer dan Doctor juga memakai anti-repeat.
- Pemain yang sebelumnya Warga mendapat sedikit prioritas untuk role spesial.
- Sistem TIDAK mengunci role 100%, jadi hasil masih tetap random.

Contoh:
Match 1: A = Werewolf
Match 2: A masih mungkin Werewolf, tetapi peluangnya jauh lebih kecil.
Jika Match 2 A kembali Werewolf, peluang Match 3 menjadi Werewolf turun jauh lagi.

6. PEMBICARA PERTAMA
- Saat fase Diskusi dimulai, server memilih satu pemain hidup secara acak.
- Moderator menampilkan:
  "Mulai dari: [Nama]"
- Setelah pemain tersebut mulai, diskusi tetap bebas.

7. RIWAYAT PERTANDINGAN
Membutuhkan SQL V2.
- Match diberi nomor.
- Pemenang disimpan.
- Jumlah ronde disimpan.
- Semua role disimpan setelah match.
- Riwayat dapat dilihat dari lobby/finish/menu.
- Menampilkan hingga 8 match terakhir selama room masih ada.
- Riwayat tidak membocorkan role sebelum game selesai.

8. CONNECTION INDICATOR
- Gamebar menampilkan Online / Menghubungkan...
- Menggunakan status Realtime Supabase.

9. BOT TEST
- Bot Developer Mode lama tetap dipertahankan.
- +1 Bot / +5 Bot / Hapus Bot tetap ada.
- Bot tetap menjalankan aksi malam dan voting.
- Tidak perlu mengubah cara aktivasi Developer Mode 5x.

10. SPECTATOR
- Sistem pemain mati tetap menonton dipertahankan.
- Pemain mati tidak bisa aksi malam/voting.

FILE DALAM ZIP
- werewolf/index.html
- werewolf/style.css
- werewolf/script.js
- werewolf/audio/ambience-night.mp3
- werewolf/audio/howl.mp3
- werewolf/audio/morning.mp3
- werewolf/audio/vote.mp3
- werewolf/audio/role-reveal.mp3
- werewolf/audio/death.mp3
- werewolf/audio/narrator/.keep
- readme.txt

SQL TERPISAH
- SUPABASE_WEREWOLF_V2_REVISION_PATCH.sql

URUTAN UPDATE
1. Pastikan SUPABASE_WEREWOLF_V1.sql sudah pernah dijalankan.
2. Jika memakai bot Developer, pastikan SUPABASE_GAME_ALPI_BOT_TEST_V1.sql juga sudah pernah dijalankan.
3. Jalankan SUPABASE_WEREWOLF_V2_REVISION_PATCH.sql.
4. Pastikan Supabase menampilkan Success.
5. Ekstrak ZIP update Werewolf.
6. Replace folder/file sesuai struktur.
7. Commit GitHub.
8. Tunggu Vercel selesai deploy.
9. Hard refresh browser HP.

TES YANG DISARANKAN
A. Lobby
- Buat room.
- Tambahkan bot jika Developer Mode aktif.
- Pastikan minimal 5 pemain.
- Pastikan Audio Host dapat ON/OFF.

B. Role
- Mulai game.
- KARTU ROLE harus terlihat jelas.
- Tekan kartu.
- Role belum terbuka.
- Tahan tombol untuk melihat role.
- Lepas jari → role tertutup kembali.

C. Moderator
- Cek overlay narasi pada setiap perubahan fase.
- HP Host memutar efek suara.
- HP pemain lain tidak memutar audio moderator sehingga suara tidak bertumpuk.

D. Anti streak
- Selesaikan game lalu Main Lagi tanpa membuat room baru.
- Lakukan beberapa match.
- Werewolf seharusnya jauh lebih tersebar dibanding sistem V1.

E. History
- Setelah match selesai buka Riwayat Match.
- Pemenang, ronde, dan role harus tampil.

F. Diskusi
- Saat masuk diskusi, harus muncul satu nama "Mulai dari".

CATATAN
Hunter/Witch/Guardian belum ditambahkan pada V2 ini.
Alasannya: V2 difokuskan lebih dulu pada pengalaman dasar, moderator, fairness pembagian role, UI, dan stabilitas game sebelum role lanjutan ditambahkan.
