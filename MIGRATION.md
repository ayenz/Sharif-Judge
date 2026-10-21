# Rewrite: CodeIgniter 3 → Nuxt

Status: fase 0–5 selesai di branch `nuxt-rewrite` (21 Okt 2026). Fase 6 (hapus kode PHP, merge) menunggu persetujuan.

## Tujuan
Menulis ulang aplikasi web SharIF Judge dengan Nuxt (Vue) tanpa mengubah perilaku penilaian,
dan tetap bisa memakai database serta folder tugas dari instalasi lama.

## Struktur repo (target)
```
web/      aplikasi Nuxt (tampilan + API + worker antrian)
tester/   mesin penilai Bash (pindahan dari restricted/tester, isi tidak diubah)
docker/   image dan compose untuk development dan produksi
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
| PDF soal | Penampil PDF bawaan browser | Tidak perlu pdf.js (±300 file) |

## Kompatibilitas data lama
- **Tabel**: nama dan kolom tidak berubah. Instalasi lama bisa langsung dipakai.
- **Folder tugas**: struktur `assignment_X/pY/<username>/...` tidak berubah.
- **Aturan nilai telat**: kode PHP lama (`$coefficient = ...`, `elseif`, variabel `$delay`, `$extra_time`)
  diterjemahkan ke JavaScript saat pertama kali dibaca. Aturan yang gagal diterjemahkan ditandai
  dan admin diminta memperbaikinya; nilai submission tidak diubah sampai aturan valid.
- **Scoreboard**: dihitung ulang dari tabel submission, isi HTML lama di `shj_scoreboard` diabaikan.

## Tahapan
0. Fondasi: kerangka Nuxt, Docker, skema database, login/logout/instalasi, layout.
1. Pengguna, profil, pengaturan, notifikasi, log login.
2. Tugas dan soal: tambah/ubah, unggah zip test case dan PDF, deskripsi Markdown/HTML.
3. Submit (unggah file dan editor), worker antrian + tester, daftar submission, rejudge.
4. Scoreboard, Hall of Fame, dashboard, Moss, rekaman ketikan, unduhan Excel/zip.
5. Pengujian regresi terhadap versi lama (port 8401), uji end-to-end, cek ukuran bundle.
6. Bersih-bersih: hapus kode PHP, perbarui README, merge ke `main`.

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

## Catatan keamanan yang belum diselesaikan
- **EasySandbox tidak berfungsi** di glibc modern (semua program dimatikan), dan instalasi lama ternyata
  tidak pernah meng-compile-nya. Jadi kode C/C++ berjalan tanpa sandbox, hanya dibatasi shield dan
  container. Python juga tidak di-sandbox (sudah begitu sejak versi lama). Perlu pengganti (mis. nsjail
  atau bubblewrap) sebelum dipakai untuk peserta yang tidak dipercaya.
- Kolom `shj_logins.ip_address` hanya 15 karakter, alamat IPv6 terpotong.
