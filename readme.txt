GAME ALPI — WEREWOLF V2 NARRATOR AUDIO UPDATE

Melanjutkan Werewolf V2 Revision. Tidak ada SQL baru.

11 audio narrator:
game-start.mp3
role-reveal.mp3
night-start.mp3
wolf-wake.mp3
seer-wake.mp3
doctor-wake.mp3
morning-death.mp3
discussion-start.mp3
voting-start.mp3
town-win.mp3
wolf-win.mp3

NORMALISASI
- Target -16 LUFS
- True peak target -1.5 dBTP
- Mono, 44.1 kHz
- MP3 128 kbps

ALUR
- Host menekan MULAI GAME -> game-start diputar -> setelah selesai RPC start dijalankan.
- Kartu Role pertama kali dibuka pada match -> role-reveal diputar satu kali di HP pemain.
- Werewolf -> night-start -> jeda 0,7 detik -> wolf-wake.
- Seer -> seer-wake.
- Doctor -> doctor-wake.
- Pagi ada korban -> morning-death.
- Diskusi -> discussion-start.
- Voting -> voting-start.
- Warga menang -> town-win.
- Werewolf menang -> wolf-win.

HOST CONTROL
- AUDIO ON/OFF
- TEST NARATOR
- Volume 20%–100%
- Test memakai night-start.mp3.

ANTI REPEAT
- Narasi fase memakai key room + match + ronde + fase + hasil.
- Realtime update pada fase sama tidak memutar ulang narrator.
- Saat fase berubah, narrator sebelumnya dihentikan.
- Winner narrator juga dilindungi dari render ulang.

AUDIO MIX
- Ambience malam diturunkan saat narrator berbicara.
- Setelah narrator selesai, ambience kembali.
- Wave Moderator bergerak saat suara narrator aktif.

TIMER
Tombol aksi tidak dikunci menunggu narrator karena timer server fase tetap berjalan.
Ini menghindari pemain kehilangan terlalu banyak waktu aksi.

FILE DALAM ZIP
werewolf/index.html
werewolf/style.css
werewolf/script.js
werewolf/audio/narrator/ (11 MP3)
readme.txt

TIDAK ADA SQL.

CARA PASANG
1. Ekstrak ZIP.
2. Replace 3 file Werewolf.
3. Upload folder werewolf/audio/narrator dengan 11 MP3.
4. Commit GitHub.
5. Tunggu Vercel.
6. Hard refresh HP.

TES
- Lobby: Test Narator, volume, Audio ON/OFF.
- Mulai Game: game-start selesai dahulu lalu game berjalan.
- Kartu Role: role-reveal hanya sekali per match/player.
- Cek semua fase audio.
- Coba update Realtime/pemain: audio fase tidak boleh berulang.
