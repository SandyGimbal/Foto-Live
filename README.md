# 📸 Foto-Live (Live Photo Camera PWA)

Aplikasi kamera web modern berbasis Progressive Web App (PWA) yang menghadirkan pengalaman pengambilan **Live Photo** (foto gerak) mirip iOS / Google Motion Photos langsung dari browser ponsel atau desktop. Dilengkapi fitur instalasi instan sebagai pintasan di layar utama (homescreen) dengan nama **Foto-Live**.

---

## ✨ Fitur Utama

- **PWA Ready (Pintasan Layar Utama)**:
  - Terintegrasi penuh dengan `manifest.json` dan Service Worker (`sw.js`).
  - Ikon resolusi tinggi (`192x192`, `512x512`, maskable) yang kompatibel dengan instalasi WebAPK di Google Chrome / Poco X6 / Xiaomi HyperOS / iOS Safari.
  - Nama pintasan yang tampil di homescreen: **Foto-Live**.
  - Buka secara standalone fullscreen layaknya aplikasi kamera bawaan tanpa bilah URL browser.

- **Tangkapan Live Photo Interaktif**:
  - Mengambil foto diam beresolusi tinggi (JPG) sekaligus merekam klip gerak 1.8 detik (WebM/MP4) dan audio.
  - Indikator amber glowing **[◎ LIVE]** yang dapat diaktifkan atau dinonaktifkan kapan saja.
  - Shutter button melingkar dengan 3 cincin konsentris (concentric rings) bergaya flagship camera.

- **Efek Suara Sintetis Realistis (Web Audio API)**:
  - Suara mekanik shutter kamera dan nada lonceng dua nada khas Live Photo tanpa jeda download audio eksternal.

- **Mode Simulasi Zero-Gravity (Anti-Gravitasi)**:
  - Tombol `🌌` untuk mengaktifkan pemandangan anti-gravitasi (kucing, buku, dan tetesan kopi melayang weightlessly di udara).
  - Berfungsi sebagai mode pratinjau sekaligus fallback jika kamera fisik tidak diizinkan atau diuji pada perangkat desktop.

- **Galeri & Pemutar Live Photo**:
  - Sentuh dan tahan (*touch and hold*) pada foto untuk memutar klip gerak secara mulus (*Apple/Google Live Photo gesture*).
  - Unduh foto dalam format JPG atau klip video gerak WebM/MP4.
  - Integrasi Web Share API untuk membagikan foto secara langsung.

---

## 🚀 Struktur Direktori

```text
├── assets/
│   └── anti_gravity_preview.jpg  # Aset visual simulasi Zero-G
├── icons/
│   ├── icon-192.png              # Ikon PWA standar 192x192
│   ├── icon-512.png              # Ikon PWA standar 512x512
│   ├── icon-maskable-192.png     # Ikon maskable Android 192x192
│   ├── icon-maskable-512.png     # Ikon maskable Android 512x512
│   ├── apple-touch-icon.png      # Ikon iOS Safari 180x180
│   └── icon-32.png               # Favicon 32x32
├── index.html                    # Antarmuka utama aplikasi
├── style.css                     # Gaya tema OLED Dark & Glassmorphism
├── app.js                        # Mesin kamera, rekaman MediaRecorder, dan gesture
├── manifest.json                 # Konfigurasi PWA (Foto-Live)
├── sw.js                         # Service Worker untuk offline caching
└── server.js                     # Server lokal Node.js
```

---

## 🛠️ Menjalankan Secara Lokal

1. Pastikan Node.js telah terpasang.
2. Jalankan server:
   ```bash
   node server.js
   ```
3. Buka di browser:
   ```
   http://localhost:3000
   ```
4. Di ponsel dalam satu jaringan Wi-Fi yang sama, akses melalui `http://<IP-KOMPUTER>:3000`.
