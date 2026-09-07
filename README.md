# FinMS — Financial Management System

Aplikasi manajemen keuangan dan arus kas untuk perusahaan IT solution. Frontend vanilla
JavaScript tanpa framework dan tanpa proses build, dengan backend PHP dan database MySQL
yang dijalankan lewat XAMPP.

Data tersimpan di **MySQL**, bukan di browser — sehingga bisa diakses dari browser mana pun
dan perangkat mana pun yang bisa menjangkau server ini.

---

## 1. Kebutuhan

| Kebutuhan | Keterangan |
|---|---|
| XAMPP | Apache + PHP 8.x + MySQL/MariaDB |
| Browser modern | Chrome, Edge, atau Firefox |
| Koneksi internet | Hanya saat **pertama kali** dibuka, untuk Chart.js, Lucide, dan font Inter dari CDN |

Tidak ada `package.json`, tidak ada Composer, tidak ada dependensi yang perlu diunduh.
**Tidak perlu `npm install` maupun `composer install`.**

---

## 2. Pemasangan

### a. Hubungkan folder proyek ke Apache

Proyek ini berada di luar `htdocs`. Buat junction agar Apache bisa menyajikannya tanpa
memindahkan repo (jalankan PowerShell sebagai pengguna biasa, tidak perlu admin):

```powershell
New-Item -ItemType Junction -Path "C:\xampp\htdocs\finms" -Target "D:\keuangan"
```

### b. Siapkan konfigurasi database

```powershell
Copy-Item api\config.sample.php api\config.php
```

Buka `api/config.php` dan sesuaikan `DB_USER` / `DB_PASS` bila MySQL Anda memakai password.
File ini sengaja tidak masuk git.

### c. Buat database dan tabelnya

```powershell
& "C:\xampp\mysql\bin\mysql.exe" -u root -e "source D:/keuangan/api/schema.sql"
```

Perintah ini membuat database `finms` beserta 12 tabelnya.

### d. Isi data awal

Bila Anda punya file backup JSON dari versi IndexedDB sebelumnya:

```powershell
& "C:\xampp\php\php.exe" api\migrate.php "D:\backup-finms\finms-backup-2026-09-07.json"
```

Skrip ini aman dijalankan berulang — setiap baris diperbarui berdasarkan id, bukan
digandakan. Password berbentuk teks biasa otomatis diubah menjadi hash saat diimpor.

Bila tidak punya backup, aplikasi akan mengisi sendiri data demo saat pertama kali dibuka.

---

## 3. Menjalankan

Buka **XAMPP Control Panel**, jalankan **Apache** dan **MySQL** sampai keduanya hijau.
Lalu buka:

```
http://localhost/finms
```

MySQL yang mati membuat data tidak terbaca meskipun Apache hidup — keduanya harus jalan.

> Berbeda dari versi sebelumnya, `dev_server.js` **tidak lagi dipakai**. Server Node itu
> hanya menyajikan file statis dan tidak bisa menjalankan PHP.

---

## 4. Login

Autentikasi diverifikasi di server terhadap hash bcrypt. Password tidak pernah dikirim
kembali ke browser, dan sesi disimpan dalam cookie HttpOnly.

Bila database diisi dari data demo, akun bawaannya:

| Peran | Email | Password |
|---|---|---|
| Administrator | `admin@company.id` | `admin123` |
| CEO / Direktur | `ceo@company.id` | `ceo123` |
| Finance Manager | `finance@company.id` | `finance123` |
| Finance Staff | `staff@company.id` | `staff123` |
| Project Manager | `pm@company.id` | `pm123` |

Menu menyesuaikan peran — **Rekonsiliasi** hanya untuk Admin, Finance Manager, dan CEO;
**Pengguna** dan **Pengaturan** hanya untuk Admin.

---

## 5. Backup

Menu **Pengaturan → Unduh Backup** menyimpan seluruh isi database ke satu file JSON, dan
**Pulihkan dari File** mengembalikannya (mode gabungkan atau ganti total).

> File backup memuat seluruh baris pengguna. Simpan **di luar folder proyek** —
> `data backup/` dan `finms-backup-*.json` sudah dikecualikan dari git agar tidak pernah
> ikut ter-commit.

---

## 6. Struktur proyek

```
index.html            Kerangka SPA — halaman login dan shell aplikasi
manifest.json         Konfigurasi PWA
sw.js                 Service worker — cache aset, API tidak pernah di-cache
offline.html          Halaman cadangan saat Apache/MySQL mati
dev_server.js         Peninggalan versi statis; tidak dipakai lagi

api/schema.sql        Definisi 12 tabel MySQL
api/config.sample.php Contoh konfigurasi — salin jadi config.php
api/records.php       CRUD generik untuk semua tabel
api/auth.php          Login, logout, cek sesi
api/migrate.php       Impor backup JSON ke MySQL (CLI)

assets/css/main.css   Design system (dark, glassmorphism)
assets/js/db.js       Lapisan data — memanggil API, antarmuka sama dengan versi IndexedDB
assets/js/auth.js     Autentikasi sisi klien terhadap api/auth.php
assets/js/utils.js    Helper: format rupiah, tanggal, toast, modal, ekspor CSV
assets/js/app.js      Router SPA dan seluruh renderer halaman
```

Frontend memanggil data lewat satu lapisan tipis (`DB.getAll`, `DB.get`, `DB.put`,
`DB.delete`). Perpindahan dari IndexedDB ke MySQL hanya mengubah isi `db.js`; seluruh
halaman di `app.js` tidak berubah.

---

## 7. Keamanan

**Sudah diperbaiki dari versi IndexedDB.** Password disimpan sebagai hash bcrypt, login
diverifikasi di server, dan seluruh endpoint API menolak permintaan tanpa sesi dengan
HTTP 401. Nama kolom dibatasi whitelist di `api/config.php`, sehingga klien tidak bisa
menyebut kolom sendiri, dan semua nilai dikirim lewat prepared statement.

**Yang masih perlu diperhatikan.** Konfigurasi ini ditujukan untuk jaringan lokal. Sebelum
dipakai di jaringan yang lebih luas, minimal perlu: HTTPS, password MySQL yang bukan
default, dan pembatasan akses ke folder `api/`.

---

## 8. Bila ada kendala

**Halaman "Tidak Bisa Terhubung"** — Apache atau MySQL sedang mati. Hidupkan keduanya dari
XAMPP Control Panel.

**"Belum login" atau API menjawab 401** — sesi berakhir. Muat ulang halaman dan login lagi.

**Port 80 sudah terpakai** — biasanya bentrok dengan IIS, Skype, atau VMware. Ubah port
Apache lewat XAMPP Control Panel → Config → `httpd.conf`, atau matikan aplikasi yang
memakainya.

**Perubahan kode tidak muncul** — service worker menyimpan aset di cache. File JS dan CSS
memakai strategi network-first sehingga mestinya selalu segar. Bila masih tertahan:
DevTools → Application → Service Workers → *Unregister*, lalu muat ulang.

**Data demo muncul kembali** — terjadi bila baris `seeded` di tabel `settings` terhapus,
sehingga aplikasi menganggap database masih kosong. Jangan mengosongkan tabel `settings`
secara manual.

**Grafik atau ikon tidak tampil** — Chart.js dan Lucide diambil dari CDN. Pastikan ada
koneksi internet saat pertama kali membuka aplikasi.
