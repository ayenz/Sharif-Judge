# Rewrite: CodeIgniter 3 → Nuxt

Status (22 Okt 2026): **selesai**. Versi Nuxt menjadi `main`; kode PHP dihapus dan versi PHP terakhir
disimpan sebagai tag `archive/php-final` (dipakai tes regresi).

## Tujuan
Menulis ulang aplikasi web SharIF Judge dengan Nuxt (Vue) tanpa mengubah perilaku penilaian,
dan tetap bisa memakai database serta folder tugas dari instalasi lama.

## Struktur repo (target)
```
web/      aplikasi Nuxt (tampilan + API + worker antrian + cheat detection)
tester/   mesin penilai Bash (pindahan dari restricted/tester, isi tidak diubah)
docker/   image dan compose untuk development dan produksi
tests/    regresi terhadap versi lama dan tes end-to-end
docs/     dokumentasi fitur (cheat detection)
```

## Keputusan teknis
| Kebutuhan | Pilihan | Alasan |
|---|---|---|
| Framework | Nuxt 4 (SSR, Nitro node-server) | Satu proyek untuk tampilan dan API |
| Komponen UI | Nuxt UI 4 + Tailwind 4 | Modern, mode gelap, hanya komponen yang dipakai ikut di-bundle |
| Database | Drizzle ORM + mysql2, MariaDB/MySQL | Skema sama persis dengan versi lama (prefix `shj_`) |
| Sesi login | nuxt-auth-utils (cookie terenkripsi) | Tanpa tabel sesi, ringan |
| Password | bcryptjs | Hash lama dari PHP `password_hash` tetap valid |
| LDAP / RADIUS | ldapts / radius | Pengganti adldap2 dan dapphp/radius |
| Antrian penilaian | Worker di dalam server Nitro, membaca tabel `shj_queue` | Tidak perlu `shell_exec("php ... &")` lagi; `tester.sh` dipanggil tanpa shell |
| Aturan nilai telat | Ekspresi JavaScript dijalankan di `node:vm` dengan batas waktu | Aturan PHP lama dikonversi otomatis (lihat di bawah) |
| Editor kode | Ace (ace-builds), dimuat hanya di halaman editor | Format rekaman ketikan lama tetap bisa diputar ulang |
| Excel | exceljs | Pengganti PhpSpreadsheet |
| Zip | fflate | Ekstrak test case dan unduh kumpulan submission |
| Markdown | markdown-it | Pengganti Parsedown |
| Email | nodemailer | Reset password, kirim akun baru |
| Deteksi kecurangan | JPlag 6.3 + Java 25 (terpisah dari Java 17 tester) | Lokal, sadar bahasa, hasil tersimpan |
| PDF soal | Penampil PDF bawaan browser | Tidak perlu pdf.js (±300 file) |

## Kompatibilitas data lama
- **Tabel**: nama dan kolom tidak berubah. Instalasi lama bisa langsung dipakai.
- **Folder tugas**: struktur `assignment_X/pY/<username>/...` tidak berubah.
- **Aturan nilai telat**: kode PHP lama (`$coefficient = ...`, `elseif`, variabel `$delay`, `$extra_time`)
  diterjemahkan ke JavaScript saat pertama kali dibaca. Aturan yang gagal diterjemahkan ditandai
  dan admin diminta memperbaikinya; nilai submission tidak diubah sampai aturan valid.
- **Scoreboard**: dihitung ulang dari tabel submission, isi HTML lama di `shj_scoreboard` diabaikan.

## Dokumentasi
- [docs/guide/migration-from-php.md](docs/guide/migration-from-php.md): panduan migrasi instalasi PHP ke Nuxt (diuji ujung-ke-ujung)
- [README.md](README.md): instalasi, konfigurasi, upgrade dari versi PHP
- [docker/README.md](docker/README.md), [web/README.md](web/README.md), [tests/README.md](tests/README.md)
- [docs/guide/cheat-detection.md](docs/guide/cheat-detection.md)

## Tahapan
0. Fondasi: kerangka Nuxt, Docker, skema database, login/logout/instalasi, layout.
1. Pengguna, profil, pengaturan, notifikasi, log login.
2. Tugas dan soal: tambah/ubah, unggah zip test case dan PDF, deskripsi Markdown/HTML.
3. Submit (unggah file dan editor), worker antrian + tester, daftar submission, rejudge.
4. Scoreboard, Hall of Fame, dashboard, Moss, rekaman ketikan, unduhan Excel/zip.
5. Pengujian regresi terhadap versi lama (port 8401), uji end-to-end, cek ukuran bundle.
6. Bersih-bersih (selesai 22 Okt 2026): kode PHP dihapus (2.989 file), `main` dimajukan ke versi Nuxt.

## Pengujian regresi
Tampilan berbeda total, jadi yang dibandingkan adalah **perilaku**:
kumpulan kode uji (benar, salah, compile error, time limit, runtime error; C, C++, Java, Python 3)
dikirim ke versi lama dan versi baru dengan tugas yang sama, lalu status, nilai, koefisien
keterlambatan, dan urutan scoreboard harus identik.

## Hasil pengujian (21 Okt 2026)
| Tes | Skrip | Hasil |
|---|---|---|
| Regresi lama vs baru: 19 submission (C, C++, Java, Python 3, upload), scoreboard, Hall of Fame, Excel | `tests/regression/run.py` | identik |
| Semua halaman (admin & mahasiswa), akses ditolak untuk mahasiswa | `tests/e2e/smoke.py` | lulus |
| Akses kode orang lain, path traversal, endpoint admin, instal ulang | `tests/e2e/security.py` | lulus |
| Editor: simpan, jalankan, submit, rekaman, rejudge | `tests/e2e/editor-flow.py` | lulus |
| Browser (Chromium): error JavaScript, hidrasi, layar HP 390px | `tests/e2e/browser.py` | lulus |
| Cheat detection: salinan diganti nama/diurutkan ulang, solusi berbeda, sinyal paste | `tests/e2e/cheat-flow.py` | lulus |

## Perbedaan perilaku yang disengaja
- **Keamanan**: semua query memakai parameter (versi lama punya SQL injection di Hall of Fame dan log login);
  tidak ada lagi perintah shell yang dirangkai dari input (Moss, hapus user, ekstrak zip, antrian);
  zip-slip dan path traversal ditolak; Moss user id harus angka; HTML notifikasi dibersihkan dari script.
- **Akses**: instruktur boleh membuka PDF soal kapan saja; halaman rekaman minimal head instructor
  (sesuai menu lama); admin tetap bisa mengubah nama tampilan saat nama dikunci.
- **Validasi lebih ketat**: aturan nilai telat yang tidak bisa dikompilasi ditolak saat disimpan;
  minimal satu bahasa per soal; batas waktu/memori ≥ 0; file diunggah dicek isinya (zip/PDF).
- **Scoreboard** dihitung langsung, tidak disimpan sebagai HTML.
- **Dashboard**: widget yang bisa digeser diganti tata letak tetap; notifikasi baru dicek tiap 30 detik.
- **Metrik rekaman**: CCT bernilai 0 (bukan tak hingga) bila kode tidak berubah.

## Fitur baru: cheat detection (JPlag)
- **Mesin lokal JPlag 6.3** (Java 25 tersendiri di image; tester tetap Java 17). Kode tidak keluar dari server.
  Per soal dan per bahasa (C, C++, Java, Python), dijalankan di background satu per satu.
- **Kode template** per soal (diabaikan saat membandingkan) dan **pembanding tugas lain** (submission lama).
- **Sensitivitas adaptif**: program pendek (tugas dasar) otomatis memakai ambang lebih kecil
  (median token ÷ 6, minimal 4). Diuji: salinan dengan urutan fungsi ditukar naik dari 52% ke 88%,
  solusi yang benar-benar berbeda tetap 0%.
- **Penyaring noise**: kemiripan dengan kode lama milik sendiri tidak dihitung; pasangan yang hanya cocok
  pada potongan < 6 token (dan kemiripan < 60%) tidak disimpan.
- **Skor indikasi per mahasiswa**: kemiripan kode + paste besar + sering keluar halaman + menulis sangat cepat,
  dengan alasan tertulis. Ini petunjuk untuk diperiksa, bukan vonis.
- **Moss** tetap tersedia; bug lama diperbaiki: bahasa kini dikirim (`-l`, sebelumnya semua dianggap C),
  satu permintaan per bahasa, kode template ikut dikirim (`-b`).
- Tes: `tests/e2e/cheat-flow.py`. Dokumentasi lengkap: [docs/guide/cheat-detection.md](docs/guide/cheat-detection.md).

## Catatan keamanan yang belum diselesaikan
- **EasySandbox tidak berfungsi** di glibc modern dan instalasi lama tidak pernah meng-compile-nya.
  Perannya kini digantikan container `judge` terisolasi (lihat di bawah).
- Kolom `shj_logins.ip_address` hanya 15 karakter, alamat IPv6 terpotong.
- **Diperbaiki 22 Okt 2026**: program mahasiswa sempat bisa membaca variabel environment server
  (password database, kunci sesi) karena tester mewarisi environment Node. Sekarang tester dijalankan
  dengan environment minimal (`PATH`, `LANG`, `HOME`), dan `tests/e2e/security.py` mengeceknya.
- **Diperbaiki 22 Okt 2026 — isolasi eksekusi**: kode mahasiswa kini jalan di container `judge` terpisah
  tanpa jaringan dan tanpa rahasia, di-compile dan dijalankan sebagai user `shjrun` yang tidak bisa
  membaca test case, jawaban, atau kode mahasiswa lain (termasuk trik `#include` saat compile).
  Diuji dengan shield dimatikan: semua percobaan diblokir (`tests/e2e/isolation.py`).
- **Diperbaiki 22 Okt 2026 — bug lama tester**: file jawaban test sebelumnya (`correctout`) tertinggal
  di folder kerja saat program dijalankan untuk test berikutnya; kini dihapus sebelum tiap test.
- **Diperbaiki 22 Okt 2026 — login RADIUS**: diuji terhadap FreeRADIUS 3.2. Klien kini mengirim
  Message-Authenticator (perlindungan BlastRADIUS, CVE-2024-3596), **memverifikasi tanda tangan
  jawaban** (sebelumnya Access-Accept palsu dari jaringan diterima tanpa cek), mengulang kirim sampai
  3 kali (UDP), dan mencatat alasan gagal di log. Prosedur tes: `tests/radius/README.md`.
- **Ditambahkan 22 Okt 2026 — batas login**: 8 gagal per alamat+akun, 30 per alamat, 50 per akun
  dalam 15 menit; juga batas untuk lupa password dan registrasi. `X-Forwarded-For` hanya dipercaya
  bila `NUXT_TRUST_PROXY=true` (sebelumnya selalu dipercaya, bisa dipalsukan).

## Tambahan 22 Okt 2026
- **Python 2 opsional, default mati** (`enable_python2`): Python 2 sudah EOL dan tidak terpasang di image
  (versi PHP lama pun tidak). Saat mati, Python 2 disembunyikan dari form tugas, halaman soal dan submit,
  dan submission Python 2 ditolak. Instalasi lama mendapat pengaturan ini otomatis (nilai 0).
- **Backup otomatis** harian (database + folder tugas, simpan 14 hari) lewat service `backup`;
  restore sudah diuji: semua tabel dan 199 file kembali utuh. Dashboard admin memberi peringatan.
- **Hasil penilaian real-time** lewat server-sent events (`/api/events`); polling hanya cadangan.
- **Riwayat cheat detection lintas tugas** (`/cheat/history`): pasangan yang mirip berulang kali.
- **Kompresi**: halaman pertama turun dari ±1–1,4 MB menjadi ±250–320 KB (Brotli untuk aset, HTML, JSON).
- **Bahasa JavaScript dan Go** (Node.js 24, Go 1.27). Go memakai batas waktu C/C++, JavaScript batas waktu
  Java. Batas memori diukur dari memori yang benar-benar dipakai (plus jatah runtime ±64 MB untuk Node.js,
  ±10 MB untuk Go). Bahasa lama tidak berubah, jadi hasil regresi tetap identik. Moss tidak mendukung Go;
  JPlag mendukung keduanya. Diuji di `tests/e2e/languages.py`.
- **Kotlin dan Swift**: Kotlin 2.4 ada di image standar (jalan di Java 17 seperti Java, compile ±4 detik).
  Swift 6.4 opsional karena toolchain-nya ±1,2 GB: aktifkan dengan `WITH_SWIFT=1` di `docker/.env`, lalu
  build ulang. Tanpa itu Swift disembunyikan dan ditolak, dengan mekanisme yang sama seperti Python 2.
- **Java (zip) dan JAR**: proyek Java multi-file dikirim sebagai zip berisi `.java` (di-compile oleh judge,
  ikut deteksi kecurangan) atau sebagai JAR runnable (tidak bisa dicek kecurangannya). Tidak dicentang
  default untuk soal baru. Diuji di `tests/e2e/java-archives.py`.
- **Perbaikan deteksi kecurangan Java**: runtime Java 25 untuk JPlag sebelumnya JRE tanpa modul
  `jdk.compiler`, sehingga semua submission Java gagal di-parse ("terlalu pendek"). Sekarang runtime
  dibuat dengan jlink dari JDK, dan `cheat-flow.py` ikut menguji Java.
