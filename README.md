# Queue Display

Pemanggilan nomor antrean real-time.

## Fitur utama

- Pengambilan nomor harian atomik, daftar tunggu, panggil ulang, selesai dan lewati.
- Monitor Socket.IO terpisah dari operator; SQLite menyimpan antrean dan sesi.
- Kata sandi operator tersimpan sebagai hash scrypt; tindakan operator memakai sesi dan token CSRF.

## Teknologi

Node.js 22.13 atau lebih baru, Express, Socket.IO, SQLite, HTML5, CSS3, JavaScript.

## Cara instalasi

~~~powershell
cd C:\laragon\www\queue-display
npm install
npm run setup
~~~

Masukkan kata sandi operator minimal 12 karakter. Pengaturan awal tidak mengubah operator yang sudah dibuat.

## Cara menjalankan

~~~powershell
npm start
~~~

Ambil nomor: http://127.0.0.1:5331. Operator: /operator. Monitor: /display. Waktu harian menggunakan WIB; antrean aktif kemarin harus diselesaikan sebelum memanggil antrean hari ini. Nomor tunggu hari sebelumnya tetap tersimpan dan tidak dipanggil otomatis.

Database otomatis di data/queue.sqlite. Variabel opsional tercantum di .env.example; berikan melalui environment atau gunakan node --env-file=.env src/server.js. Untuk HTTPS, set SECURE_COOKIE=1. Pengujian: npm test.
