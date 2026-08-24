GAME ALPI — DARK 3D UI SHELL V1

Fokus update ini hanya tampilan luar / pre-game. Logic gameplay dan SQL tidak diubah.

HOME
- Grid game aktif menjadi 2 kolom di HP.
- Dark premium game hub.
- Depth / 3D CSS ringan.
- Featured UNO dengan kartu 3D ringan.
- Ambient glow, grid tipis, stagger animation, press effect.
- Upcoming games tetap 2 kolom dan lebih compact.

DEVELOPER MODE
- Cara tetap sama: tap logo atau tulisan "Game Alpi" 5x dalam sekitar 2,6 detik.
- Tidak ada password.
- Mulai tap ke-2 muncul progress DEV ACCESS 2/5, 3/5, 4/5.
- Tap ke-5 muncul animasi unlock.
- Saat aktif muncul badge DEV MODE di kiri bawah.
- Badge bisa ditekan untuk melihat status dan menonaktifkan Developer Mode.
- Tetap memakai localStorage dan body.developer-mode sehingga Test Tools lama tetap kompatibel.

IMPOSTOR
- Halaman pilih Multi HP / 1 HP dibuat lebih premium dan 3D ringan.
- Ringkasan aturan 2 kolom di HP normal.
- Logic dan link mode tidak diubah.

CATUR
- Halaman pilih Multi HP / Lawan Bot / 1 HP diperbarui.
- Lawan Bot tetap public dan menjadi mode featured.
- Logic bot tidak diubah.

WEREWOLF
- Hanya intro + setup diperbarui.
- Bulan, kabut ringan, depth card, rule card 2 kolom.
- Gameplay tidak disentuh.

UNO
- Hanya setup sebelum lobby diperbarui.
- Quick Rules 2 kolom + depth card.
- Gameplay/table/kartu tidak disentuh.

PERFORMA
- Tidak memakai Three.js/WebGL.
- Tidak menambah gambar besar.
- CSS animation ringan.
- prefers-reduced-motion didukung.

FILE YANG BERUBAH
- index.html
- style.css
- developer.js
- impostor/style.css
- catur/style.css
- werewolf/style.css
- uno/style.css
- readme.txt

TIDAK ADA SQL.

CARA UPDATE
1. Ekstrak ZIP.
2. Replace file sesuai folder.
3. Commit GitHub.
4. Tunggu Vercel deploy.
5. Hard refresh browser HP.
6. Test homepage dan tap Game Alpi 5x.
