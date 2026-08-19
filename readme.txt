GAME ALPI — IMPOSTOR MULTI HP SESSION FIX

BUG
- Setelah pertandingan Impostor Multi HP selesai, browser menyimpan session room lama.
- Saat kembali ke Pilih Mode lalu menekan Multi HP lagi, session lama otomatis direstore.
- Karena room lama berstatus "finished", layar langsung membuka "Hasil Akhir".

DIPERBAIKI
- Tombol Multi HP sekarang masuk melalui marker ?from=mode.
- Jika session tersimpan masih berupa pertandingan AKTIF:
  game tetap resume seperti sebelumnya.
- Jika session tersimpan sudah FINISHED:
  session lama otomatis dibersihkan.
  pemain langsung masuk halaman Buat / Gabung Room.
- Jika room lama sudah dihapus oleh cleanup:
  session lokal juga otomatis dibersihkan.
- Tombol "Kembali ke Pilih Mode" pada Hasil Akhir sekarang benar-benar menghapus session Multi HP sebelum kembali.

FILE YANG BERUBAH
- impostor/index.html
- impostor/multi.html
- impostor/multi.js
- readme.txt

TIDAK ADA SQL.
TIDAK ADA CSS YANG BERUBAH.

CARA UPDATE
1. Ekstrak ZIP.
2. Replace 3 file Impostor sesuai folder.
3. Commit ke GitHub.
4. Tunggu Vercel deploy.
5. Refresh halaman di HP.

TES
1. Buka Impostor → Multi HP.
2. Jika sebelumnya ada match yang sudah selesai, sekarang harus masuk ke Buat / Gabung Room.
3. Buat pertandingan baru.
4. Saat pertandingan masih aktif, keluar ke menu lalu masuk Multi HP lagi:
   pertandingan aktif harus tetap bisa dilanjutkan.
5. Selesaikan pertandingan.
6. Tekan "Kembali ke Pilih Mode".
7. Tekan Multi HP lagi:
   harus membuka setup baru, bukan Hasil Akhir lama.

CATATAN
- Badge "🧪 DEV" pada screenshot bukan bug. Itu berarti Developer Mode sedang aktif di device tersebut.
