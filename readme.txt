GAME ALPI — WEREWOLF V2 NARRATOR FIX

BUG 1 — GAME START TERPOTONG
Masalah:
- game-start.mp3 mulai berbunyi.
- Fungsi audio unlock lama masih memiliki Promise aktif.
- Promise tersebut dapat selesai beberapa saat kemudian dan mem-pause elemen audio.
- Akibatnya game-start terpotong lalu fase "Malam telah tiba" mengambil alih.

Perbaikan:
- Tombol MULAI GAME sekarang langsung memutar game-start.mp3 sebagai user gesture.
- Tidak ada unlockAudio() lain sebelum game-start.
- RPC werewolf_start_game baru dijalankan SETELAH game-start selesai.
- Jadi night-start / "Malam telah tiba" baru dapat masuk sesudah pembuka selesai.

BUG 2 — ROLE REVEAL
role-reveal.mp3 BUKAN hanya untuk Host.

Desain yang benar:
- game-start / night / Seer / Doctor / pagi / diskusi / voting / ending:
  diputar dari HP HOST.
- role-reveal:
  diputar PRIVAT dari HP MASING-MASING PEMAIN saat pemain membuka Kartu Role.

Perbaikan:
- showRole tidak lagi memanggil unlockAudio sebelum role-reveal.
- Klik/tahan Kartu Role sendiri menjadi user gesture untuk memainkan audio.
- role-reveal hanya satu kali per pemain per match.
- Jika browser gagal memainkan audio, status tidak ditandai selesai sehingga dapat dicoba lagi.

TEST NARATOR
- Juga tidak lagi menjalankan unlock audio terpisah.
- Tombol TEST NARATOR langsung memutar audio.

FILE YANG BERUBAH
- werewolf/script.js
- readme.txt

TIDAK ADA SQL.
TIDAK ADA AUDIO YANG PERLU DIGANTI.
TIDAK ADA CSS/HTML YANG BERUBAH.

CARA UPDATE
1. Ekstrak ZIP.
2. Replace werewolf/script.js.
3. Commit GitHub.
4. Tunggu Vercel.
5. Hard refresh semua HP.

TES
1. Host buat room.
2. Tekan TEST NARATOR: audio harus selesai normal.
3. Tekan MULAI GAME:
   game-start.mp3 harus selesai penuh.
   baru setelah itu masuk night-start / "Malam telah tiba".
4. Di HP Host buka Kartu Role: role-reveal terdengar.
5. Di HP pemain non-Host buka Kartu Role: role-reveal juga harus terdengar di HP tersebut.
6. Tutup dan buka Kartu Role lagi pada match yang sama:
   role-reveal tidak berulang.
