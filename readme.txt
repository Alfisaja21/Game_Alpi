GAME ALPI — WEREWOLF V2 NARRATOR FLOW UPDATE

Update ini melanjutkan:
Werewolf V2 Narrator Fix.

Tidak ada SQL.

AUDIO BARU
1. wolf-done.mp3
2. seer-done.mp3
3. doctor-done.mp3
4. morning-saved.mp3
5. discussion-warning.mp3
6. vote-result.mp3

File asli wolf-done(1).mp3 sudah dirapikan menjadi:
wolf-done.mp3

Semua audio baru dinormalisasi sama seperti narrator sebelumnya:
- Target -16 LUFS
- True peak target -1.5 dBTP
- Mono
- 44.1 kHz
- MP3 128 kbps

FLOW NARATOR

MULAI GAME
game-start.mp3
↓
game baru benar-benar dimulai

MALAM
night-start.mp3
↓
wolf-wake.mp3
↓
Werewolf memilih korban
↓
wolf-done.mp3
↓
seer-wake.mp3
↓
Seer memilih
↓
seer-done.mp3
↓
doctor-wake.mp3
↓
Doctor memilih
↓
doctor-done.mp3

PAGI — ADA KORBAN
doctor-done.mp3
↓
morning-death.mp3
↓
nama korban tampil di layar

PAGI — TIDAK ADA KORBAN
doctor-done.mp3
↓
morning-saved.mp3

DISKUSI
discussion-start.mp3

Saat waktu tinggal 10 detik:
discussion-warning.mp3
- hanya sekali per ronde
- hanya dari HP Host
- tidak mengubah timer server

VOTING
voting-start.mp3

HASIL VOTING — ADA YANG TERELIMINASI
vote-result.mp3
↓
nama pemain ditampilkan di layar

HASIL VOTING — SERI
vote-result.mp3 TIDAK diputar.
Untuk seri masih menggunakan teks moderator.
Nanti bisa ditambah vote-tie.mp3 jika diinginkan.

ENDING
town-win.mp3 atau wolf-win.mp3

KENAPA WOLF-DONE DIPUTAR SAAT FASE SEER?
RPC Werewolf langsung memindahkan room ke fase berikutnya setelah aksi selesai.
Karena itu browser Host menerima fase night_seer setelah pilihan Werewolf tersimpan.
Game kemudian memainkan:
wolf-done -> seer-wake.
Secara pengalaman pemain hasilnya tetap berurutan dengan benar.

ANTI REPEAT
Semua sequence tetap memakai key:
room + match + ronde + fase.
Realtime render fase yang sama tidak mengulang audio.

FILE DALAM ZIP
- werewolf/script.js
- werewolf/audio/narrator/wolf-done.mp3
- werewolf/audio/narrator/seer-done.mp3
- werewolf/audio/narrator/doctor-done.mp3
- werewolf/audio/narrator/morning-saved.mp3
- werewolf/audio/narrator/discussion-warning.mp3
- werewolf/audio/narrator/vote-result.mp3
- readme.txt

TIDAK ADA SQL.
HTML DAN CSS TIDAK BERUBAH.

CARA UPDATE
1. Ekstrak ZIP.
2. Replace werewolf/script.js.
3. Upload 6 MP3 baru ke werewolf/audio/narrator/.
4. Commit GitHub.
5. Tunggu Vercel.
6. Hard refresh HP Host.

TES DENGAN BOT
- Dengarkan urutan Werewolf -> Seer -> Doctor.
- Cek pagi ada korban.
- Cek pagi tanpa korban.
- Biarkan diskusi sampai 10 detik terakhir.
- Cek hasil voting.
- Pastikan audio tidak dobel saat Realtime update.

TES DENGAN TEMAN NANTI
Bot cukup untuk mengecek flow dasar.
Tetap lakukan satu tes Multi HP bersama beberapa teman sebelum Werewolf dianggap final,
khususnya sinkronisasi suara Host, role-reveal privat, dan timing diskusi.
