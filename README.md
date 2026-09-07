# FinMS — Financial Management System

Aplikasi manajemen keuangan dan arus kas untuk perusahaan IT solution. Berjalan sebagai PWA
offline-first dengan vanilla JavaScript — tanpa framework, tanpa proses build, tanpa backend.

Seluruh data tersimpan di **IndexedDB browser**. Tidak ada server database dan tidak ada
sinkronisasi antar perangkat.

---

## 1. Kebutuhan

| Kebutuhan | Keterangan |
|---|---|
| Node.js | Versi 18 atau lebih baru (hanya untuk menyajikan file statis) |
| Browser modern | Chrome, Edge, atau Firefox — butuh dukungan IndexedDB & Service Worker |
| Koneksi internet | Hanya saat **pertama kali** dibuka, untuk mengunduh Chart.js, Lucide, dan font Inter dari CDN |

Tidak ada `package.json` dan tidak ada dependensi npm. **Tidak perlu menjalankan `npm install`.**

---

## 2. Menjalankan aplikasi

Dari folder proyek:

```bash
node dev_server.js
```

Server akan berjalan di:

```
http://127.0.0.1:5173
```

Buka alamat tersebut di browser. Untuk menghentikan server, tekan `Ctrl + C` di terminal.

> ### ⚠️ Selalu gunakan alamat yang sama setiap kali
>
> Data disimpan di IndexedDB, yang **terikat pada origin** — kombinasi skema, host, dan port.
> `http://localhost:5173` dan `http://127.0.0.1:5173` dianggap **dua origin berbeda** oleh
> browser, meskipun keduanya menunjuk ke server dan file yang sama persis.
>
> Artinya masing-masing punya database sendiri. Membuka lewat alamat yang berbeda dari
> biasanya akan menampilkan aplikasi yang seolah kosong dan terisi ulang data demo —
> **data lama tidak hilang**, hanya tersimpan di origin yang satunya. Kembali ke alamat semula
> akan memunculkannya lagi.
>
> Hal yang sama berlaku bila membuka lewat port lain, misalnya Live Server di `:5500`.
> Pilih satu alamat, lalu gunakan itu terus.

> **Jangan membuka `index.html` langsung lewat klik dua kali (`file://`).**
> Service worker dan seluruh path aset menggunakan path absolut dari root domain, sehingga
> aplikasi hanya berfungsi penuh bila disajikan lewat HTTP.

---

## 3. Login

Aplikasi terisi lima akun demo saat pertama kali dijalankan:

| Peran | Email | Password |
|---|---|---|
| Administrator | `admin@company.id` | `admin123` |
| CEO / Direktur | `ceo@company.id` | `ceo123` |
| Finance Manager | `finance@company.id` | `finance123` |
| Finance Staff | `staff@company.id` | `staff123` |
| Project Manager | `pm@company.id` | `pm123` |

Empat akun pertama tersedia sebagai tombol pintasan di halaman login. Akun Project Manager
harus diketik manual.

Menu yang tampil menyesuaikan peran — misalnya **Rekonsiliasi** hanya untuk Admin, Finance
Manager, dan CEO; **Pengguna** dan **Pengaturan** hanya untuk Admin.

---

## 4. Mulai dengan data sendiri

Aplikasi sengaja terisi data demo agar setiap menu langsung bisa dilihat. Untuk mulai
mencatat keuangan yang sebenarnya, ikuti urutan ini:

1. **Login sebagai Administrator** — hanya peran ini yang bisa mereset data.
2. **Buka menu Pengaturan → Hapus Data Demo.**
   Halaman menampilkan pratinjau jumlah data yang akan dihapus. Centang
   *"Hapus seluruh rekening bank"* bila ingin memulai benar-benar kosong.
   Kategori dan pengguna tidak ikut terhapus.
3. **Buat rekening di menu Rekening Bank** — masukkan nama bank, nomor, dan saldo awal
   yang sebenarnya. Minimal satu rekening harus ada sebelum transaksi bisa dicatat.
4. **Sesuaikan kategori di menu Kategori** bila perlu. Perhatikan arah tiap kategori:
   laporan Arus Kas mengelompokkan transaksi berdasarkan `flow_type` kategori (masuk ↑ /
   keluar ↓), bukan berdasarkan tipe transaksinya.
5. **Catat transaksi di menu Transaksi** lewat tombol *Tambah Transaksi*. Saldo rekening
   ikut menyesuaikan secara otomatis.
6. **Lihat hasilnya di menu Arus Kas dan Dashboard.**

> Penghapusan data demo bersifat **permanen dan tidak bisa dibatalkan**. Belum ada fitur
> backup otomatis.

---

## 5. Memasang sebagai aplikasi (opsional)

Saat dibuka di Chrome atau Edge, tombol **Install App** muncul di kanan atas. Setelah
dipasang, FinMS berjalan di jendela sendiri seperti aplikasi desktop.

Kemampuan membuka aplikasi tanpa koneksi bergantung pada service worker yang berhasil
terdaftar. Untuk memeriksanya, buka DevTools → Application → Service Workers dan pastikan
`sw.js` berstatus *activated*. Bila tidak muncul, lihat bagian Kendala di bawah.

---

## 6. Struktur proyek

```
index.html            Kerangka SPA — halaman login dan shell aplikasi
dev_server.js         Server statis sederhana (Node http), port 5173
manifest.json         Konfigurasi PWA
sw.js                 Service worker — strategi cache
offline.html          Halaman cadangan saat offline

assets/css/main.css   Design system (dark, glassmorphism)
assets/js/db.js       Engine IndexedDB, data seed, migrasi, reset data demo
assets/js/auth.js     Autentikasi dan hak akses per peran
assets/js/utils.js    Helper: format rupiah, tanggal, toast, modal, ekspor CSV
assets/js/app.js      Router SPA dan seluruh renderer halaman
```

---

## 7. Hal yang perlu diketahui

**Data terikat pada satu browser dan satu origin.** IndexedDB bersifat per-browser,
per-perangkat, dan per-origin. Data yang diinput di Chrome tidak akan terlihat di Firefox,
di komputer lain, maupun saat aplikasi dibuka lewat alamat berbeda (`localhost` vs
`127.0.0.1` vs port lain). Menghapus data situs (*clear browsing data*) akan **menghapus
seluruh isi aplikasi**.

**Bila data terlihat hilang, periksa origin lain dulu.** Buka DevTools → Application →
IndexedDB pada tiap alamat yang pernah dipakai (`http://localhost:5173`,
`http://127.0.0.1:5173`, atau port lain). Database bernama `finms_db` akan muncul di origin
tempat data itu sebenarnya tersimpan.

**Belum ada backup.** Tidak ada ekspor menyeluruh maupun sinkronisasi server. Ekspor CSV
per halaman tersedia, tetapi bukan cadangan lengkap.

**Bukan untuk produksi apa adanya.** Password tersimpan sebagai teks biasa di IndexedDB dan
dibandingkan langsung saat login ([`auth.js`](assets/js/auth.js)). Otentikasi berjalan
sepenuhnya di sisi klien, sehingga siapa pun yang memiliki akses ke browser dapat membaca
seluruh data. Untuk penggunaan nyata dengan data keuangan sungguhan, diperlukan backend
dengan autentikasi dan penyimpanan yang aman.

---

## 8. Bila ada kendala

**Port 5173 sudah terpakai** — hentikan proses lain yang memakai port tersebut, atau ubah
angka port di baris terakhir `dev_server.js`.

**Perubahan kode tidak muncul di browser** — service worker menyimpan aset di cache. File
JS dan CSS aplikasi sudah memakai strategi *network-first* sehingga mestinya selalu segar.
Bila masih tertahan, buka DevTools → Application → Service Workers → *Unregister*, lalu
muat ulang halaman.

**Data demo muncul kembali setelah reset** — ini terjadi bila penanda `seeded` di object
store `settings` ikut terhapus. Fitur reset bawaan sudah menjaga penanda tersebut; hindari
menghapus store `settings` secara manual lewat DevTools.

**Grafik atau ikon tidak tampil** — Chart.js dan Lucide diambil dari CDN. Pastikan ada
koneksi internet saat pertama kali membuka aplikasi.
