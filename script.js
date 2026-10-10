/* =========================================================
   Bengkulu Digital Heritage — Prototype Script
   SPA sederhana berbasis hash-routing, tanpa framework.
   Struktur file:
     1. Icons
     2. Mock Data
     3. Helpers (format & lookup)
     4. Component Renderers (kartu, chip, dsb)
     5. Page Templates
     6. Map Renderer
     7. App Shell (navbar, bottom nav, footer)
     8. Router
     9. Event Handlers
     10. Init
   ========================================================= */

/* Leaflet's library exposes itself on window.L — but this app
   already uses the name L for the locations data array below.
   Capture the library reference first, under its own name, so
   both can coexist without clashing. */
const Leaflet = window.L || null;

/* ============ 1. ICONS ============
   Path SVG disimpan sebagai string agar bisa dipakai ulang
   lewat helper I(name) → markup <svg>. */
const IC = {
  heart: 'M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z',
  search: 'M21 21l-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  arrow: 'M5 12h14M12 5l7 7-7 7',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  star: 'M12 2l3 7 7 .6-5.3 4.7 1.6 7.2-6.3-3.7-6.3 3.7 1.6-7.2L2 9.6 9 9z',
  scan: 'M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10',
  home: 'M3 11l9-8 9 8v10h-6v-6H9v6H3z',
  user: 'M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  cmp: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM16 8l-2 6-6 2 2-6z',
  x: 'M18 6L6 18M6 6l12 12',
  bag: 'M6 2L3 6v14h18V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0',
  chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
};

/** Render satu ikon SVG dari kamus IC. */
const I = (name) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="${IC[name]}"/></svg>`;

/** Bangun atribut inline style untuk gradasi dua warna (--a, --b).
 *  Style tambahan WAJIB lewat parameter `extra`. Jangan menulis atribut
 *  style="" kedua di elemen yang sama, karena browser mengabaikannya. */
const col = (a, b, extra = '') => `style="--a:${a};--b:${b};${extra}"`;

/**
 * Render satu blok .art: gradasi warna + foto asli (opsional) di
 * atasnya. Kalau `imgUrl` kosong, atau gambarnya gagal dimuat saat
 * runtime (mis. tidak ada koneksi, atau URL salah), `onerror`
 * langsung membuang elemen <img> sehingga yang tersisa hanyalah
 * gradasi — tidak pernah muncul ikon "gambar rusak".
 *
 * @param {string[]} colorArr - [warnaA, warnaB] untuk gradasi, mis. c.c
 * @param {string} [imgUrl] - URL foto, boleh kosong/undefined
 * @param {string} [alt] - teks alternatif untuk aksesibilitas
 */
function art(colorArr, imgUrl, alt = '') {
  const bg = col(...colorArr);
  const initials = monogramOf(alt);
  const monogram = initials ? `<span class="art-mono">${initials}</span>` : '';

  if (imgUrl) {
    // Foto asli disediakan: tampilkan. <template> di bawahnya menyimpan
    // monogram sebagai cadangan — kalau <img> gagal dimuat saat runtime,
    // artImgFallback() menggantinya dengan isi <template> itu.
    return `<div class="art" ${bg}>
      <img src="${imgUrl}" alt="${alt}" loading="lazy" decoding="async" onerror="artImgFallback(this)">
      <template class="art-fallback">${monogram}</template>
    </div>`;
  }

  // Tidak ada foto sama sekali: langsung pakai monogram inisial judul
  // di atas gradasi. Ini TIDAK memuat apa pun dari internet, jadi
  // selalu tampil — termasuk di pratinjau artifact yang memblokir
  // gambar eksternal.
  return `<div class="art" ${bg}>${monogram}</div>`;
}

/** Ambil 1–2 huruf inisial dari sebuah judul, mis. "Kain Besurek" → "KB". */
function monogramOf(text) {
  return (text || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase();
}

/**
 * Dipanggil lewat onerror="" sebuah <img> di dalam .art ketika foto
 * gagal dimuat. Mengganti <img> yang rusak dengan monogram cadangan
 * yang sudah disiapkan di <template class="art-fallback"> sebelahnya.
 */
function artImgFallback(img) {
  const wrap = img.closest('.art');
  const tpl = wrap && wrap.querySelector('template.art-fallback');
  img.remove();
  if (tpl) {
    wrap.insertAdjacentHTML('beforeend', tpl.innerHTML);
    tpl.remove();
  }
}


/* ============ 2. MOCK DATA ============
   Seluruh konten di bawah ini adalah CONTOH untuk prototipe,
   bukan data budaya/sejarah/UMKM resmi. */

// C = daftar objek budaya
const C = [
  { s: 'kain-besurek', img: 'https://i.pinimg.com/1200x/88/88/ad/8888ada11db583e5514f18a9291114ea.jpg', t: 'Kain Besurek', cat: 'Kain & Tekstil', loc: 'Kota Bengkulu', k: 'Kota Bengkulu',
    c: ['#7a1f2b', '#b8893b'], x: 38, y: 62,
    d: 'Kain bermotif kaligrafi dan flora yang menjadi identitas visual Bengkulu.',
    seller: 'batik-besurek-bengkulu', hist: 'h-besurek' },
  { s: 'tabot', img: 'https://www.djkn.kemenkeu.go.id/files/images/2023/08/night_of_tabot_besanding_.jpg', t: 'Tabot', cat: 'Tradisi', loc: 'Kota Bengkulu', k: 'Kota Bengkulu',
    c: ['#3a1a12', '#9a4a2a'], x: 44, y: 56,
    d: 'Tradisi tahunan masyarakat Bengkulu yang dirayakan lewat arak-arakan dan ritual.',
    seller: 'kriya-rejang', hist: 'h-tabot' },
  { s: 'dol', img: 'https://osccdn.medcom.id/images/content/2020/04/05/df7a984c5931eb2967248c9946a6b319.jpg', t: 'Dol Bengkulu', cat: 'Musik', loc: 'Kota Bengkulu', k: 'Kota Bengkulu',
    c: ['#2f3d2b', '#7a8a4a'], x: 41, y: 66,
    d: 'Musik perkusi dari bedug dan gendang yang mengiringi perayaan Tabot.',
    seller: 'kriya-rejang', hist: 'h-tabot' },
  { s: 'rumah-bubungan-lima', img: 'https://www.indonesia.travel/contentassets/5240721227e2480b8f4c6ed1f7608311/rumah-bubungan-lima2.jpg', t: 'Rumah Bubungan Lima', cat: 'Arsitektur', loc: 'Bengkulu Tengah', k: 'Bengkulu Tengah',
    c: ['#4a3020', '#a8783a'], x: 55, y: 45,
    d: 'Rumah adat panggung dengan atap bertingkat khas Bengkulu.',
    seller: 'kriya-rejang', hist: 'h-kolonial' },
  { s: 'tari-andun', img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSJqk9YOH8mYW7UpImrYMu5BLV_cNNYAdvYmdZYsnxTVAyTlTDp_vUXfhM&s=10', t: 'Tari Andun', cat: 'Seni', loc: 'Bengkulu Selatan', k: 'Bengkulu Selatan',
    c: ['#6a1f3a', '#d08a5a'], x: 62, y: 78,
    d: 'Tari pergaulan yang biasa ditampilkan pada acara adat dan hiburan rakyat.',
    seller: 'kriya-rejang', hist: 'h-tabot' },
  { s: 'tari-kejei', img: 'https://pariwisataindonesia.id/wp-content/uploads/2022/01/Tari-Kejei-1-e1611574605162.png', t: 'Tari Kejei', cat: 'Seni', loc: 'Rejang Lebong', k: 'Rejang Lebong',
    c: ['#1f3a3a', '#5f8a6a'], x: 72, y: 24,
    d: 'Tari tradisional suku Rejang yang lekat dengan upacara adat.',
    seller: 'kriya-rejang', hist: 'h-kolonial' },
  { s: 'pendap', img: 'https://karasantan.id/uploads/2021/07/26/257/thumb_PendapIkanNila-alisa.ummuzia.jpg', t: 'Pendap', cat: 'Kuliner', loc: 'Kota Bengkulu', k: 'Kota Bengkulu',
    c: ['#5a3a10', '#c99a3a'], x: 34, y: 52,
    d: 'Kudapan khas Bengkulu berbahan sagu dan ikan yang dibungkus daun.',
    seller: 'dapur-pesisir', hist: 'h-modern' },
  { s: 'kriya-lokal', img: 'https://curupekspress.disway.id/upload/7beea1420982182b5af6224cc494fd05.jpg', t: 'Kerajinan Lokal', cat: 'Kerajinan', loc: 'Kepahiang', k: 'Kepahiang',
    c: ['#3a2a1a', '#8a6a3a'], x: 66, y: 34,
    d: 'Anyaman dan ukiran dari bahan alam sekitar yang dibuat pengrajin setempat.',
    seller: 'kriya-rejang', hist: 'h-modern' },
];

// S = daftar penjual / pelaku UMKM
//
// Link sosial tiap toko diisi manual lewat dua field di bawah:
//   ig : link profil Instagram, harus diawali https://
//        contoh: 'https://www.instagram.com/namatoko'
//   tt : link profil TikTok, harus diawali https://
//        contoh: 'https://www.tiktok.com/@namatoko'
// Field yang dibiarkan '' akan memunculkan toast "belum diisi".
//
// NOMOR WHATSAPP TIDAK DISIMPAN DI SINI. Karena chat berjalan lewat
// server, nomor tiap toko diisi di chat-backend/sellers.json (nomor
// penjual tidak perlu terlihat oleh pengunjung website).
const S = [
  { s: 'batik-besurek-bengkulu', img: 'https://lh3.googleusercontent.com/gps-cs-s/ANWiy9SnJ_-jHs9svfLYatGs5LIpeMmcA3PXwgFHyFQB2JVCI7AvcYQRrr5-8jPcydGd9PF6N5g8jt8GVifZ7SWio8fdVT_srFTFXHhhFaCn03me5HbMEOvvsRyXMFXVmPxpPMJqD5aJv3KTJ3A=s1360-w1360-h1020-rw', t: 'Batik Besurek Bengkulu', loc: 'Kota Bengkulu', k: 'Kota Bengkulu',
    yrs: 12, fol: '2,4 rb', c: ['#7a1f2b', '#5a1420'],
    ig: '',
    tt: '',
    d: 'Sanggar dan toko yang memproduksi kain besurek dengan pewarna dan motif klasik.' },
  { s: 'kriya-rejang', img: 'https://picsum.photos/seed/kriya-rejang/800/500', t: 'Kriya Rejang Studio', loc: 'Rejang Lebong', k: 'Rejang Lebong',
    yrs: 7, fol: '860', c: ['#3a2a1a', '#8a6a3a'],
    ig: '',
    tt: '',
    d: 'Kelompok pengrajin anyaman dan souvenir bertema budaya Bengkulu.' },
  { s: 'dapur-pesisir', img: 'https://picsum.photos/seed/dapur-pesisir/800/500', t: 'Dapur Pesisir', loc: 'Kota Bengkulu', k: 'Kota Bengkulu',
    yrs: 5, fol: '1,1 rb', c: ['#5a3a10', '#c99a3a'],
    ig: '',
    tt: '',
    d: 'UMKM kuliner oleh-oleh khas pesisir Bengkulu.' },
];

// P = daftar produk ekonomi kreatif
const P = [
  { s: 'kain-besurek-premium', img: 'https://www.karyakreatifindonesia.co.id/download/cHJvZHVjdDpwcm9kdWN0cy9pbWFnZXMvaW1nLTIwMjQwNjExLXdhMDAxMV8xMXpvbi1LaTRWcVhRLTIwMjQwNzE1LmpwZw==', t: 'Kain Besurek Premium', pr: 185000, cat: 'Tekstil', r: 4.9,
    seller: 'batik-besurek-bengkulu', cu: 'kain-besurek', c: ['#7a1f2b', '#b8893b'],
    m: 'Katun primisima, pewarna tekstil',
    d: 'Kain besurek motif kaligrafi dengan warna maroon dan emas, siap dijahit.' },
  { s: 'tas-besurek', img: 'https://www.karyakreatifindonesia.co.id/en/download/cHJvZHVjdDpwcm9kdWN0cy9pbWFnZXMvaW1nLTIwMjQwNzE3LXdhMDA0OC1VQ0JRQVJlLTIwMjQwNzE4LmpwZw==', t: 'Tas Tote Besurek', pr: 95000, cat: 'Fashion', r: 4.7,
    seller: 'batik-besurek-bengkulu', cu: 'kain-besurek', c: ['#5a1420', '#c99a3a'],
    m: 'Kanvas dan kain besurek',
    d: 'Tote bag harian dengan panel motif besurek.' },
  { s: 'souvenir-besurek', img: 'https://filebroker-cdn.lazada.co.id/kf/S0556ea501bdf48bc9d86d28b100406a6a.jpg', t: 'Gantungan Kunci Besurek', pr: 25000, cat: 'Souvenir', r: 4.6,
    seller: 'batik-besurek-bengkulu', cu: 'kain-besurek', c: ['#8a2a3a', '#d8a85a'],
    m: 'Perca kain besurek',
    d: 'Souvenir kecil dari perca kain untuk buah tangan.' },
  { s: 'selendang-besurek', img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQmOfdqDnKkLo7GLHwt8x1kR1RGcaJIjU5-uI3yY5YGGeSdbmIKPY8-kbI&s=10', t: 'Selendang Besurek', pr: 120000, cat: 'Fashion', r: 4.8,
    seller: 'batik-besurek-bengkulu', cu: 'kain-besurek', c: ['#6a1f3a', '#b8893b'],
    m: 'Katun halus',
    d: 'Selendang ringan untuk acara adat maupun harian.' },
  { s: 'miniatur-dol', img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS5Xd9o3RXkqPxalqBfUn5pKOMV86qiBa2IUiWA3JmKOjtcN0h9kYC92svm&s=10', t: 'Miniatur Dol', pr: 150000, cat: 'Produk Budaya', r: 4.5,
    seller: 'kriya-rejang', cu: 'dol', c: ['#2f3d2b', '#7a8a4a'],
    m: 'Kayu dan kulit sintetis',
    d: 'Replika kecil alat musik dol untuk pajangan.' },
  { s: 'anyaman-rotan', img: 'https://rricoid-assets.obs.ap-southeast-4.myhuaweicloud.com/berita/Pontianak/o/1717823101178-WhatsApp_Image_2024-06-08_at_11.57.08/0eujdudf41z5rjf.jpeg', t: 'Keranjang Anyaman', pr: 85000, cat: 'Kriya', r: 4.6,
    seller: 'kriya-rejang', cu: 'kriya-lokal', c: ['#3a2a1a', '#8a6a3a'],
    m: 'Rotan alami',
    d: 'Keranjang serbaguna anyaman tangan.' },
  { s: 'miniatur-rumah', img: 'https://down-id.img.susercontent.com/file/96c9e1672fddc2c433fab5b068dafd73', t: 'Miniatur Rumah Adat', pr: 210000, cat: 'Dekorasi', r: 4.7,
    seller: 'kriya-rejang', cu: 'rumah-bubungan-lima', c: ['#4a3020', '#a8783a'],
    m: 'Kayu jati belanda',
    d: 'Miniatur rumah bubungan lima untuk dekorasi.' },
  { s: 'pendap-instan', img: 'https://www.finnafood.com/blog/wp-content/uploads/2024/10/cara-membuat-pendap.jpg', t: 'Pendap Siap Kukus', pr: 45000, cat: 'Kuliner', r: 4.8,
    seller: 'dapur-pesisir', cu: 'pendap', c: ['#5a3a10', '#c99a3a'],
    m: 'Sagu, ikan, rempah',
    d: 'Pendap dalam kemasan beku, tinggal dikukus.' },
];


// H = daftar peristiwa sejarah
const H = [
  { s: 'h-kerajaan', era: 'Masa awal', t: 'Komunitas dan kerajaan lokal pesisir', cat: 'Kerajaan',
    d: 'Wilayah Bengkulu dihuni komunitas lokal dengan tata adat sendiri jauh sebelum kedatangan bangsa Eropa.' },
  { s: 'h-besurek', era: 'Perkembangan budaya', t: 'Sejarah Kain Besurek', cat: 'Budaya',
    d: 'Motif kaligrafi pada kain ini dipahami sebagai perpaduan pengaruh budaya dan kreativitas setempat.' },
  { s: 'h-tabot', era: 'Tradisi', t: 'Sejarah Tabot', cat: 'Budaya',
    d: 'Tabot berkembang menjadi tradisi tahunan yang kini menjadi agenda budaya penting kota.' },
  { s: 'h-kolonial', era: 'Abad ke-18', t: 'Masa kolonial dan Benteng Marlborough', cat: 'Kolonial',
    d: 'Benteng Marlborough dibangun Inggris pada awal abad ke-18 dan kini menjadi cagar budaya.' },
  { s: 'h-pengasingan', era: '1938–1942', t: 'Pengasingan Bung Karno di Bengkulu', cat: 'Tokoh',
    d: 'Bung Karno pernah menjalani pengasingan di Bengkulu pada masa kolonial Belanda.' },
  { s: 'h-modern', era: '1968–kini', t: 'Bengkulu sebagai provinsi', cat: 'Modern',
    d: 'Bengkulu menjadi provinsi sendiri pada 1968 dan terus mengembangkan ekonomi kreatifnya.' },
];

// L = daftar lokasi (dipakai halaman peta / GIS)
// lat/lng adalah perkiraan kasar per kabupaten/kota untuk kebutuhan
// prototipe — bukan koordinat presisi objek budaya yang sebenarnya.
const L = [
  { s: 'kain-besurek', t: 'Sentra Kain Besurek', type: 'Warisan', lat: -3.796, lng: 102.258, dist: '1,2 km', cu: 'kain-besurek' },
  { s: 'tabot', t: 'Lokasi Perayaan Tabot', type: 'Warisan', lat: -3.791, lng: 102.253, dist: '2,6 km', cu: 'tabot' },
  { s: 'rumah-bubungan-lima', t: 'Rumah Bubungan Lima', type: 'Wisata', lat: -3.683, lng: 102.314, dist: '7,4 km', cu: 'rumah-bubungan-lima' },
  { s: 'pendap', t: 'Sentra Kuliner Pendap', type: 'UMKM', lat: -3.800, lng: 102.270, dist: '3,8 km', cu: 'pendap' },
  { s: 'kriya-lokal', t: 'Galeri Kriya Kepahiang', type: 'UMKM', lat: -3.656, lng: 102.613, dist: '54 km', cu: 'kriya-lokal' },
  { s: 'tari-kejei', t: 'Sanggar Tari Kejei', type: 'Wisata', lat: -3.483, lng: 102.543, dist: '88 km', cu: 'tari-kejei' },
];

// Titik tengah peta: Kota Bengkulu
const MAP_CENTER = [-3.792, 102.261];

// Warna marker peta berdasarkan tipe lokasi
const TC = { Warisan: '#7a1f2b', Wisata: '#4f6b4a', UMKM: '#b8893b' };


/* ============ 3. HELPERS ============ */

/** Cari satu entri dalam array berdasarkan slug (field `s`). */
const by = (arr, s) => arr.find((o) => o.s === s);

// Objek budaya yang ditampilkan di blok cerita "Di Balik Motif Besurek"
// pada beranda. Foto dan warna diambil dari data C, jadi cukup
// ubah data di sana kalau ingin mengganti gambarnya.
const STORY_FEATURE = by(C, 'kain-besurek');

/** Format angka menjadi Rupiah, mis. 185000 → "Rp185.000". */
const rp = (n) => 'Rp' + n.toLocaleString('id-ID');

// Daftar kategori budaya (dipakai filter di halaman Explore)
const CATS = ['Semua', ...new Set(C.map((c) => c.cat))];

/**
 * Render tumpukan foto yang saling fade (crossfade) satu sama lain.
 * Semua foto ditumpuk di posisi yang sama; CSS mengatur opacity dan
 * transition, lalu startFadeStacks() di bagian Router yang menukar
 * class "active" antar foto secara berkala. Kalau array kosong atau
 * cuma berisi satu URL, otomatis tidak ada animasi (aman, tidak
 * pernah error).
 *
 * @param {string[]} images - daftar URL foto (0, 1, atau lebih)
 * @param {string} [alt] - teks alternatif untuk aksesibilitas
 */
function fadeStack(images, alt = '') {
  if (!images || !images.length) return '';
  return `<div class="fade-stack">
    ${images.map((src, i) => `
      <img src="${src}" alt="${alt}" loading="lazy" decoding="async"
        class="${i === 0 ? 'active' : ''}" onerror="this.remove()">`).join('')}
  </div>`;
}

/**
 * Render <section class="hero"> dengan foto latar OPSIONAL (satu
 * atau beberapa, akan saling fade bila lebih dari satu). Kalau
 * `images` kosong atau semua gambarnya gagal dimuat, otomatis
 * jatuh kembali ke gradasi warna biasa — tidak pernah menyisakan
 * elemen rusak.
 *
 * Untuk mengganti foto latar sebuah halaman, cukup ubah nilainya
 * di objek HERO_IMG (tepat di bawah fungsi ini).
 *
 * @param {string} innerHtml - markup di dalam hero (biasanya <div class="w">...)
 * @param {string[]} [images] - daftar URL foto latar, boleh kosong
 */
function hero(innerHtml, images) {
  const photo = images && images.length
    ? `${fadeStack(images)}<div class="scrim"></div>`
    : '';
  return `<section class="hero">${photo}${innerHtml}</section>`;
}

// URL foto latar untuk tiap hero. Isi 2+ URL supaya foto saling
// fade bergantian; isi 1 URL untuk foto statis; kosongkan array
// ([]) untuk kembali ke gradasi warna polos — itulah kondisi
// sekarang, sampai foto dokumentasi asli tersedia (foto acak dari
// picsum.photos sebelumnya dihapus karena tidak relevan isinya dan
// tetap diblokir di pratinjau artifact yang di-host di claude.ai).
const HERO_IMG = {
  home: [
    'https://i.pinimg.com/1200x/88/88/ad/8888ada11db583e5514f18a9291114ea.jpg',
    'https://www.djkn.kemenkeu.go.id/files/images/2023/08/night_of_tabot_besanding_.jpg',
    'https://osccdn.medcom.id/images/content/2020/04/05/df7a984c5931eb2967248c9946a6b319.jpg',
    'https://www.indonesia.travel/contentassets/5240721227e2480b8f4c6ed1f7608311/rumah-bubungan-lima2.jpg',
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSJqk9YOH8mYW7UpImrYMu5BLV_cNNYAdvYmdZYsnxTVAyTlTDp_vUXfhM&s=10',
    'https://pariwisataindonesia.id/wp-content/uploads/2022/01/Tari-Kejei-1-e1611574605162.png',
    'https://karasantan.id/uploads/2021/07/26/257/thumb_PendapIkanNila-alisa.ummuzia.jpg',
    'https://curupekspress.disway.id/upload/7beea1420982182b5af6224cc494fd05.jpg',
  ],
  history: [
    'https://kemenpar.go.id/_next/image?url=https%3A%2F%2Fapi.kemenpar.go.id%2Fstorage%2Fapp%2Fuploads%2Fpublic%2F6a2%2F285%2F957%2F6a2285957330f739500306.jpg&w=3840&q=75',
    'https://cari-bkl.storage.googleapis.com/konten/konten-img_caribengkulu_20250730102048_8091-1753845648-7366.jpeg',
    'https://www.bengkulunews.co.id/wp-content/uploads/2022/11/WhatsApp-Image-2022-11-15-at-17.43.37.jpeg',
    'https://www.wartaprima.com/sites/default/files/inline-images/14bengkulu2.jpg',
  ],
  products: [
    'https://www.karyakreatifindonesia.co.id/download/cHJvZHVjdDpwcm9kdWN0cy9pbWFnZXMvaW1nLTIwMjQwNjExLXdhMDAxMV8xMXpvbi1LaTRWcVhRLTIwMjQwNzE1LmpwZw==',
    'https://www.finnafood.com/blog/wp-content/uploads/2024/10/cara-membuat-pendap.jpg',
    'https://filebroker-cdn.lazada.co.id/kf/S0556ea501bdf48bc9d86d28b100406a6a.jpg',
    
  ],
  arTeaser: [
    'https://upload.wikimedia.org/wikipedia/commons/5/59/Front_gate_of_Fort_Marlborough%2C_Bengkulu_2015-04-19_02.jpg?utm_source=id.wikipedia.org&utm_campaign=index&utm_content=original',
    'https://www.karyakreatifindonesia.co.id/download/cHJvZHVjdDpwcm9kdWN0cy9pbWFnZXMvaW1nLTIwMjQwNjExLXdhMDAxMV8xMXpvbi1LaTRWcVhRLTIwMjQwNzE1LmpwZw==',
    'https://osccdn.medcom.id/images/content/2021/05/25/3bf4fe667308d2feee4df158bf44a854.jpg',
  ],
};

// Foto GALERI di halaman detail budaya (#/culture/<slug>), cara isinya
// sama seperti HERO_IMG: tempel URL ke array milik slug yang diinginkan.
// Boleh berapa saja (3, 6, 9...). Array kosong [] = 3 kotak gradasi
// seperti sebelumnya. Klik foto membuka lightbox dengan tombol geser.
// Contoh:  'kain-besurek': ['img/besurek-1.jpg', 'img/besurek-2.jpg'],
const GALLERY_IMG = {
  'kain-besurek': [],
  'tabot': [],
  'dol': [],
  'rumah-bubungan-lima': [],
  'tari-andun': [],
  'tari-kejei': [],
  'pendap': [],
  'kriya-lokal': [],
};

// FOTO PROFIL toko di halaman penjual (#/seller/<slug>) dan chat.
// Cara ganti: isi URL foto di slug toko yang bersangkutan. Kosongkan ''
// untuk kembali ke lingkaran warna polos. Foto banner toko tetap diatur
// lewat field `img` di data S.
// Contoh:  'batik-besurek-bengkulu': 'img/logo-besurek.jpg',
const AVATAR_IMG = {
  'batik-besurek-bengkulu': '',
  'kriya-rejang': '',
  'dapur-pesisir': '',
};

/** Daftar foto galeri untuk satu objek budaya (3 slot kosong bila belum diisi). */
const galleryOf = (c) => {
  const g = GALLERY_IMG[c.s];
  return g && g.length ? g : [null, null, null];
};

/** Markup <img> foto profil toko, atau string kosong bila belum diisi. */
const avatarImg = (shop) => {
  const src = AVATAR_IMG[shop.s];
  return src
    ? `<img src="${src}" alt="${shop.t}" loading="lazy" decoding="async" onerror="this.remove()">`
    : '';
};

// Status "tersimpan" milik pengguna, disimpan ke localStorage
let sav = new Set();
try {
  sav = new Set(JSON.parse(localStorage.getItem('sv') || '[]'));
} catch (e) {
  /* localStorage tidak tersedia — lanjut dengan set kosong */
}

// State aplikasi (bukan React state, cukup objek biasa + re-render manual)
const st = {
  q: '',            // kata kunci pencarian aktif
  cat: 'Semua',      // filter kategori budaya
  view: 'grid',      // grid | list, untuk halaman Explore
  pc: 'Semua',       // filter kategori produk
  mx: 1e9,           // batas harga maksimum produk
  sort: 'pop',       // urutan produk: pop | lo | hi
  tab: 'Budaya',     // tab aktif di halaman Saved
  mf: { Warisan: 1, Wisata: 1, UMKM: 1 }, // filter jenis marker peta
  sel: null,         // slug lokasi peta yang sedang dipilih
  aq: '',
  ar: 0,             // status simulasi AR: 0 siap, 1 memindai, 2 terdeteksi
};

/** Tampilkan notifikasi toast singkat di bagian bawah layar. */
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 1800);
}

/** Toggle status favorit untuk id tertentu, mis. "c:kain-besurek". */
function fav(id) {
  if (sav.has(id)) {
    sav.delete(id);
    toast('Dihapus dari simpanan');
  } else {
    sav.add(id);
    toast('Disimpan');
  }
  try {
    localStorage.setItem('sv', JSON.stringify([...sav]));
  } catch (e) {
    /* abaikan jika localStorage penuh/tidak tersedia */
  }
  route(true); // re-render tanpa reset posisi scroll
}


/* ============ 3b. CHAT PENJUAL & KONTAK SOSIAL ============
   Chat dibuka di dalam website (#/chat/<slug-penjual>).

   Mode DEMO  (CHAT_CONFIG.apiUrl kosong): pesan hanya disimpan di browser
     dan balasan penjual disimulasikan. Berguna untuk mencoba tampilan.
   Mode NYATA (apiUrl diisi alamat server chat-backend): pesan pembeli
     dikirim ke server, server meneruskannya ke WhatsApp penjual, dan
     balasan penjual di WhatsApp muncul kembali di sini lewat polling.

   Website saja TIDAK bisa terhubung ke WhatsApp. Jembatannya adalah
   server di folder chat-backend (lihat README.md di dalamnya). */

const CHAT_CONFIG = {
  apiUrl: '',            // contoh: 'https://chat.namadomain.com' ('' = mode demo)
  pollMs: 3000,          // seberapa sering cek balasan saat halaman chat terbuka
  globalPollMs: 15000,   // cek balasan baru untuk chat lain (lencana angka)
  demoReplyMs: 1600,     // jeda balasan palsu di mode demo
};

const CHAT_STORE_KEY = 'bdh_chat_v1';

// Teks awal yang otomatis terisi di kolom ketik. Pembeli boleh mengubahnya.
const CHAT_TEXT = {
  seller: (shop) => `Halo ${shop.t}, saya melihat toko Anda di Bengkulu Digital Heritage dan ingin bertanya tentang produk Anda.`,
  product: (shop, product) => `Halo ${shop.t}, saya tertarik dengan produk "${product.t}" (${rp(product.pr)}). Apakah masih tersedia?`,
};

const DEMO_REPLIES = [
  'Halo kak, terima kasih sudah menghubungi kami. Ada yang bisa kami bantu?',
  'Untuk produk tersebut stoknya masih tersedia ya kak.',
  'Pengiriman bisa ke seluruh Indonesia. Mau kami hitungkan ongkirnya?',
];

const STATUS_LABEL = {
  sending: 'Mengirim…',
  sent: '✓ Terkirim',
  delivered: '✓✓ Diterima',
  read: '✓✓ Dibaca',
};

const STATUS_RANK = { sending: 0, sent: 1, delivered: 2, read: 3 };

const SOCIAL_LABEL = { ig: 'Instagram', tt: 'TikTok' };

// Status halaman chat yang sedang terbuka
const chat = {
  slug: null,
  draft: '',
  pendingProduct: null,
  timer: null,
  globalTimer: null,
  offline: false,
};

function escHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(text).replace(/[&<>"']/g, (ch) => map[ch]);
}

function newId(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

const chatApi = () => CHAT_CONFIG.apiUrl.replace(/\/+$/, '');

/* ---------- Penyimpanan lokal (riwayat chat di browser pembeli) ---------- */

function loadChatStore() {
  let data = null;
  try {
    data = JSON.parse(localStorage.getItem(CHAT_STORE_KEY));
  } catch (err) {
    data = null;
  }
  if (!data || !data.buyerId || !data.convos) {
    data = { buyerId: newId(24), convos: {} };
  }
  return data;
}

let chatStore = loadChatStore();

function saveChatStore() {
  try {
    localStorage.setItem(CHAT_STORE_KEY, JSON.stringify(chatStore));
  } catch (err) {
    // penyimpanan penuh / diblokir: chat tetap jalan tanpa riwayat lokal
  }
}

function convo(slug) {
  if (!chatStore.convos[slug]) {
    chatStore.convos[slug] = { msgs: [], lastId: 0, seen: 0, demoN: 0 };
  }
  return chatStore.convos[slug];
}

/* ---------- Status & penggabungan pesan dari server ---------- */

function bestStatus(current, incoming) {
  if (!incoming) return current;
  if (incoming == 'failed' || current == 'failed') return incoming;
  return STATUS_RANK[incoming] >= STATUS_RANK[current] ? incoming : current;
}

/** Gabungkan pesan dari server ke riwayat lokal. Return true bila ada perubahan. */
function mergeServerMessages(slug, list) {
  const c = convo(slug);
  let changed = false;

  list.forEach((sm) => {
    // Pesan pembeli dicocokkan lewat clientId. Pesan penjual tidak punya
    // clientId, jadi dicocokkan lewat id DAN pengirim yang sama (id saja
    // bisa bentrok bila server pernah restart).
    const local = c.msgs.find((m) => {
      if (sm.clientId) return m.clientId == sm.clientId;
      return m.id && m.id == sm.id && m.from == sm.from;
    });

    if (local) {
      const nextStatus = local.from == 'buyer' ? bestStatus(local.status, sm.status) : local.status;
      if (local.id != sm.id || local.status != nextStatus) changed = true;
      local.id = sm.id;
      local.ts = sm.ts;
      local.status = nextStatus;
    } else {
      c.msgs.push({
        id: sm.id,
        clientId: sm.clientId,
        from: sm.from,
        text: sm.text,
        ts: sm.ts,
        status: sm.status,
      });
      changed = true;
    }
    c.lastId = Math.max(c.lastId, sm.id);
  });

  c.msgs.sort((a, b) => a.ts - b.ts);
  if (c.msgs.length > 300) {
    c.msgs = c.msgs.slice(-300);
  }
  return changed;
}

/** Terapkan perubahan status (terkirim → diterima → dibaca) pada pesan lama. */
function applyStatuses(slug, statusMap) {
  const c = convo(slug);
  let changed = false;
  c.msgs.forEach((m) => {
    if (m.from == 'buyer' && m.id && statusMap[m.id]) {
      const next = bestStatus(m.status, statusMap[m.id]);
      if (next != m.status) {
        m.status = next;
        changed = true;
      }
    }
  });
  return changed;
}

/* ---------- Komunikasi dengan server ---------- */

/** Ambil pesan baru dari server untuk satu percakapan. */
async function syncConversation(slug) {
  if (!CHAT_CONFIG.apiUrl) return { ok: true, changed: false };

  const c = convo(slug);
  const query = new URLSearchParams({
    buyerId: chatStore.buyerId,
    sellerSlug: slug,
    after: String(c.lastId),
  });

  try {
    const res = await fetch(`${chatApi()}/api/messages?${query}`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    let changed = mergeServerMessages(slug, data.messages || []);
    changed = applyStatuses(slug, data.statuses || {}) || changed;
    if (changed) saveChatStore();
    return { ok: true, changed };
  } catch (err) {
    return { ok: false, changed: false };
  }
}

/** Kirim satu pesan buyer ke server (atau simulasikan di mode demo). */
async function deliverMessage(slug, msg) {
  if (!CHAT_CONFIG.apiUrl) {
    setTimeout(() => {
      msg.status = 'delivered';
      saveChatStore();
      refreshChatView(slug);
    }, 500);
    scheduleDemoReply(slug);
    return;
  }

  const product = msg.product ? by(P, msg.product) : null;

  try {
    const res = await fetch(`${chatApi()}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        buyerId: chatStore.buyerId,
        sellerSlug: slug,
        clientId: msg.clientId,
        text: msg.text,
        productName: product ? product.t : '',
      }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    mergeServerMessages(slug, [data.message]);
    chat.offline = false;
  } catch (err) {
    msg.status = 'failed';
  }

  saveChatStore();
  refreshChatView(slug);
}

/** Buat pesan baru dari pembeli lalu kirim. */
async function sendText(slug, text, productSlug) {
  const c = convo(slug);
  const msg = {
    clientId: newId(12),
    from: 'buyer',
    text,
    ts: Date.now(),
    status: 'sending',
    product: productSlug || null,
  };
  c.msgs.push(msg);
  saveChatStore();
  refreshChatView(slug, true);
  await deliverMessage(slug, msg);
}

function scheduleDemoReply(slug) {
  setTimeout(() => {
    const c = convo(slug);
    const text = DEMO_REPLIES[c.demoN % DEMO_REPLIES.length];
    c.demoN += 1;
    c.msgs.push({ clientId: newId(12), from: 'seller', text, ts: Date.now() });
    saveChatStore();
    refreshChatView(slug);
    refreshChatBadge();
  }, CHAT_CONFIG.demoReplyMs);
}

/* ---------- Pesan belum dibaca ---------- */

function unreadCount(slug) {
  const c = chatStore.convos[slug];
  if (!c) return 0;
  return c.msgs.filter((m) => m.from == 'seller' && m.ts > c.seen).length;
}

function totalUnread() {
  return Object.keys(chatStore.convos).reduce((sum, slug) => sum + unreadCount(slug), 0);
}

function chatBadgeHtml() {
  const n = totalUnread();
  return `<i class="nb"${n ? '' : ' hidden'}>${n > 9 ? '9+' : n}</i>`;
}

function refreshChatBadge() {
  const n = totalUnread();
  document.querySelectorAll('.nb').forEach((el) => {
    if (el.closest('.crow')) return; // lencana per-percakapan diurus renderInboxList
    el.textContent = n > 9 ? '9+' : n;
    el.hidden = n == 0;
  });
}

function markSeen() {
  if (!chat.slug) return;
  const c = convo(chat.slug);
  const lastTs = c.msgs.reduce((max, m) => Math.max(max, m.ts), 0);
  if (lastTs > c.seen) {
    c.seen = lastTs;
    saveChatStore();
  }
  refreshChatBadge();
}

/* ---------- Tampilan ---------- */

function chatTime(ts) {
  const d = new Date(ts);
  const sameDay = d.toDateString() == new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function bubbleHtml(m) {
  const mine = m.from == 'buyer';
  let status = '';
  if (mine && m.status == 'failed') {
    status = `<button class="cstat bad" data-a="chatretry" data-v="${m.clientId}">Gagal terkirim · Coba lagi</button>`;
  } else if (mine) {
    status = `<span class="cstat">${STATUS_LABEL[m.status] || ''}</span>`;
  }
  return `
    <div class="cm ${mine ? 'me' : 'them'}">
      <p>${escHtml(m.text)}</p>
      <span class="ct">${chatTime(m.ts)}${status}</span>
    </div>`;
}

function renderChatMessages(forceBottom) {
  const box = document.getElementById('cm');
  if (!box || !chat.slug) return;

  const c = convo(chat.slug);
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;

  box.innerHTML = c.msgs.length
    ? c.msgs.map(bubbleHtml).join('')
    : '<p class="mut small cempty">Belum ada pesan. Tulis pesan pertamamu di bawah.</p>';

  if (forceBottom || nearBottom) {
    box.scrollTop = box.scrollHeight;
  }
}

/** Gambar ulang pesan bila halaman chat untuk `slug` sedang terbuka. */
function refreshChatView(slug, forceBottom) {
  if (chat.slug != slug) return;
  renderChatMessages(forceBottom);
  markSeen();
}

function updateChatStatus() {
  const el = document.getElementById('cs');
  if (!el) return;
  if (!CHAT_CONFIG.apiUrl) {
    el.textContent = 'Mode demo · balasan penjual disimulasikan';
  } else {
    el.textContent = chat.offline ? 'Menyambungkan ulang…' : 'Terhubung ke WhatsApp penjual';
  }
}

function autosizeChatInput(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function renderInboxList() {
  const box = document.getElementById('cl');
  if (!box) return;

  const lastTsOf = (slug) => chatStore.convos[slug].msgs.reduce((max, m) => Math.max(max, m.ts), 0);
  const slugs = Object.keys(chatStore.convos)
    .filter((slug) => by(S, slug) && chatStore.convos[slug].msgs.length)
    .sort((a, b) => lastTsOf(b) - lastTsOf(a));

  if (!slugs.length) {
    box.innerHTML = empty('Belum ada percakapan', 'Lihat Produk', '#/products');
    return;
  }

  box.innerHTML = slugs.map((slug) => {
    const shop = by(S, slug);
    const msgs = chatStore.convos[slug].msgs;
    const last = msgs[msgs.length - 1];
    const unread = unreadCount(slug);
    return `
      <a class="crow" href="#/chat/${slug}">
        <div class="art cav" ${col(shop.c[1], shop.c[0])}>${avatarImg(shop)}</div>
        <div class="cinfo">
          <b>${shop.t}</b>
          <span class="cprev">${last.from == 'buyer' ? 'Kamu: ' : ''}${escHtml(last.text)}</span>
        </div>
        <div class="cmeta">
          <span>${chatTime(last.ts)}</span>
          ${unread ? `<i class="nb">${unread}</i>` : ''}
        </div>
      </a>`;
  }).join('');
}

/* ---------- Siklus hidup halaman chat ---------- */

function stopChat() {
  clearInterval(chat.timer);
  chat.timer = null;
  chat.slug = null;
}

async function pollChat() {
  const slug = chat.slug;
  if (!slug || document.hidden) return;
  const result = await syncConversation(slug);
  chat.offline = !result.ok;
  if (chat.slug != slug) return;
  updateChatStatus();
  if (result.changed) {
    refreshChatView(slug);
  }
}

/** Dipanggil router setelah halaman #/chat atau #/chat/<slug> dirender. */
function initChat(slug) {
  stopChat();

  // Daftar percakapan (tanpa slug)
  if (!slug) {
    renderInboxList();
    if (CHAT_CONFIG.apiUrl) {
      Promise.all(Object.keys(chatStore.convos).map(syncConversation)).then(() => {
        refreshChatBadge();
        if (!chat.slug) renderInboxList();
      });
    }
    return;
  }

  if (!by(S, slug)) return;
  chat.slug = slug;

  renderChatMessages(true);
  markSeen();
  updateChatStatus();

  const input = document.getElementById('ci');
  if (input) {
    autosizeChatInput(input);
    input.focus();
  }

  if (CHAT_CONFIG.apiUrl) {
    pollChat();
    chat.timer = setInterval(pollChat, CHAT_CONFIG.pollMs);
  }
}

/** Cek balasan baru untuk chat yang TIDAK sedang dibuka (untuk lencana angka). */
function startGlobalChatSync() {
  if (!CHAT_CONFIG.apiUrl || chat.globalTimer) return;
  chat.globalTimer = setInterval(async () => {
    if (document.hidden) return;
    const slugs = Object.keys(chatStore.convos).filter((slug) => slug != chat.slug);
    for (const slug of slugs) {
      await syncConversation(slug);
    }
    refreshChatBadge();
    if (!chat.slug) renderInboxList();
  }, CHAT_CONFIG.globalPollMs);
}

/* ---------- Aksi tombol ---------- */

function sendChat() {
  const input = document.getElementById('ci');
  if (!input || !chat.slug) return;

  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  chat.draft = '';
  autosizeChatInput(input);

  const productSlug = chat.pendingProduct;
  chat.pendingProduct = null;
  sendText(chat.slug, text, productSlug);
  input.focus();
}

function retryChat(clientId) {
  if (!chat.slug) return;
  const msg = convo(chat.slug).msgs.find((m) => m.clientId == clientId);
  if (!msg) return;
  msg.status = 'sending';
  refreshChatView(chat.slug);
  deliverMessage(chat.slug, msg);
}

/** Buka profil Instagram (kind 'ig') atau TikTok (kind 'tt') penjual. */
function openSocial(sellerSlug, kind) {
  const shop = by(S, sellerSlug);
  const url = shop ? extractUrl(shop[kind]) : null;
  if (!url) {
    toast(`Link ${SOCIAL_LABEL[kind]} penjual belum diisi`);
    return;
  }
  window.open(url, '_blank', 'noopener');
}


/* ============ 4. COMPONENT RENDERERS ============ */

/** Tombol favorit (hati) yang muncul di pojok kartu. */
const fb = (id) => `
  <button class="fav ${sav.has(id) ? 'on' : ''}" data-a="fav" data-v="${id}"
    aria-label="Simpan" aria-pressed="${sav.has(id)}">${I('heart')}</button>`;

/** Kartu untuk satu objek budaya. */
const cc = (c) => `
  <article class="card">
    <a href="#/culture/${c.s}" aria-label="${c.t}">
      ${art(c.c, c.img, c.t)}
      <div class="bd">
        <span class="badge">${c.cat}</span>
        <h3 style="margin:.4em 0 0">${c.t}</h3>
        <p>${c.d}</p>
        <p>${I('pin')} ${c.loc}</p>
      </div>
    </a>
    ${fb('c:' + c.s)}
  </article>`;

/** Kartu untuk satu produk ekonomi kreatif. */
const pc = (p) => `
  <article class="card">
    <a href="#/product/${p.s}">
      ${art(p.c, p.img, p.t)}
      <div class="bd">
        <span class="badge">${p.cat}</span>
        <h3 style="margin:.4em 0 0;font-size:1.05rem">${p.t}</h3>
        <p>${by(S, p.seller).t} · ${by(S, p.seller).k}</p>
        <p><b style="color:var(--pri)">${rp(p.pr)}</b> · ${I('star')} ${p.r}</p>
      </div>
    </a>
    ${fb('p:' + p.s)}
  </article>`;

/** Kartu ringkas untuk satu penjual/UMKM. */
const sc = (s) => `
  <a class="card" href="#/seller/${s.s}">
    ${art(s.c, s.img, s.t)}
    <div class="bd">
      <h3>${s.t}</h3>
      <p>${I('pin')} ${s.loc} · ${s.yrs} tahun</p>
    </div>
  </a>`;

/** Blok "empty state" generik dengan CTA opsional. */
const empty = (msg, btnLabel = 'Mulai Menjelajah', href = '#/explore') => `
  <div class="empty">
    <h3>${msg}</h3>
    <a class="btn" href="${href}">${btnLabel}</a>
  </div>`;

/** Breadcrumb navigasi, mis. crumb('Jelajah Budaya'). */
const crumb = (...parts) => `
  <div class="crumb"><a href="#/">Beranda</a>${parts.map((p) => ' / ' + p).join('')}</div>`;

/** Baris chip filter yang bisa diklik. */
const chips = (arr, current, action) => `
  <div class="chips">
    ${arr.map((x) => `<button class="chip ${x == current ? 'on' : ''}" data-a="${action}" data-v="${x}">${x}</button>`).join('')}
  </div>`;


/* ============ 5. PAGE TEMPLATES ============
   Setiap fungsi mengembalikan string HTML untuk #app.
   `slug` (bila ada) diambil dari segmen kedua hash, mis.
   #/culture/kain-besurek → slug = "kain-besurek". */
const pages = {

  home: () => `
    ${hero(`
      <div class="w">
        <h1>Menjelajahi Bengkulu, Melestarikan Cerita</h1>
        <p>Temukan warisan budaya, sejarah, lokasi, dan karya ekonomi kreatif Bengkulu dalam satu ruang digital.</p>
        <div class="chips" style="margin-top:28px">
          <a class="btn" href="#/explore">Mulai Menjelajah ${I('arrow')}</a>
          <a class="btn o" href="#/map">Lihat Peta</a>
        </div>
        <div class="stats">
          <div><b>50+</b>Warisan Budaya</div>
          <div><b>120+</b>Produk Lokal</div>
          <div><b>10</b>Kabupaten/Kota</div>
          <div><b>AR</b>Experience</div>
        </div>
        <p class="small" style="margin-top:22px;opacity:.8">Dokumentasi → AR → GIS → Promosi → Pasar</p>
      </div>`, HERO_IMG.home)}

    <section class="sec w">
      <h2>Warisan yang Masih Bercerita</h2>
      <p class="mut">Kenali budaya Bengkulu melalui sejarah, filosofi, dan visual.</p>
      <div class="grid">${C.slice(0, 6).map(cc).join('')}</div>
    </section>

    <section class="w">
      <h2>Jelajah berdasarkan kategori</h2>
      ${chips(CATS.slice(1), '', 'gocat')}
    </section>

    <section class="sec w">
      <div class="split">
        <div>
          <h2>Budaya Ada di Sekitarmu</h2>
          <p class="mut">Lihat sebaran warisan budaya, wisata, dan pelaku ekonomi kreatif. Jarak pada prototipe ini adalah contoh.</p>
          <a class="btn" href="#/map">Jelajahi Peta ${I('arrow')}</a>
        </div>
        ${mapHtml()}
      </div>
    </section>

    <section class="sec" style="background:var(--surf)">
      <div class="w split">
        <div class="ar" style="max-width:300px">
          <div class="cam"></div>
          <div class="obj">${
            HERO_IMG.arTeaser.length
              ? fadeStack(HERO_IMG.arTeaser, 'Contoh objek budaya')
              : `<div class="art" ${col('#7a1f2b', '#b8893b', 'position:absolute;inset:0')}></div>`
          }</div>
          <div class="frame"></div>
          <div class="ln"></div>
        </div>
        <div>
          <h2>Lihat Warisan Budaya dari Sudut yang Berbeda</h2>
          <p class="mut">Arahkan ke penanda budaya untuk memindai, menjelajah, lalu mempelajari ceritanya. Ini simulasi antarmuka, bukan kamera AR sungguhan.</p>
          <a class="btn g" href="#/ar">Coba AR Experience</a>
        </div>
      </div>
    </section>

    <section class="sec w">
      <h2>Karya Lokal, Cerita Lokal</h2>
      <div class="grid">${P.slice(0, 4).map(pc).join('')}</div>
      <p><a class="btn o" href="#/products">Lihat Semua Produk</a></p>
    </section>

    <section class="w">
      <div class="story">
        ${art(STORY_FEATURE.c, STORY_FEATURE.img, STORY_FEATURE.t)}
        <div>
          <h2>Di Balik Motif Besurek</h2>
          <p class="mut">Setiap garis pada besurek membawa cerita tentang pertemuan budaya, tangan pengrajin, dan cara masyarakat Bengkulu menjaga identitasnya.</p>
          <a class="btn" href="#/culture/kain-besurek">Baca Ceritanya</a>
        </div>
      </div>
    </section>`,

  explore: () => {
    const r = C.filter((c) =>
      (st.cat == 'Semua' || c.cat == st.cat) &&
      (c.t + c.d + c.loc + c.cat).toLowerCase().includes(st.q.toLowerCase())
    );
    return `
      <div class="w sec">
        ${crumb('Jelajah Budaya')}
        <h1 style="font-size:clamp(2rem,5vw,3.4rem)">Jelajah Budaya Bengkulu</h1>
        <div class="bar">
          <input class="inp" id="eq" placeholder="Cari budaya, tradisi, lokasi..." value="${st.q}" aria-label="Cari budaya">
          <button class="chip ${st.view == 'grid' ? 'on' : ''}" data-a="view" data-v="grid">Grid</button>
          <button class="chip ${st.view == 'list' ? 'on' : ''}" data-a="view" data-v="list">List</button>
        </div>
        ${chips(CATS, st.cat, 'cat')}
        <p class="mut small" style="margin:18px 0">${r.length} hasil</p>
        <div id="res" class="grid ${st.view == 'list' ? 'list' : ''}" ${st.view == 'list' ? 'style="grid-template-columns:1fr"' : ''}>
          ${r.length ? r.map(cc).join('') : ''}
        </div>
        ${r.length ? '' : empty('Konten belum tersedia untuk pencarian ini', 'Reset filter', '#/explore')}
      </div>`;
  },

  culture: (s) => {
    const c = by(C, s);
    if (!c) return `<div class="w sec">${empty('Konten belum tersedia')}</div>`;
    const se = by(S, c.seller);
    const ps = P.filter((p) => p.cu == c.s);
    const h = by(H, c.hist);
    return `
      <section class="art" ${col(...c.c, 'margin-top:calc(-1 * var(--nav-h));padding:150px 0 60px;color:#fff')}>
        ${c.img ? `<img src="${c.img}" alt="${c.t}" onerror="this.remove()"><div class="scrim"></div>` : ''}
        <div class="w" style="position:relative;z-index:2">
          <span class="badge">${c.cat}</span>
          <h1>${c.t}</h1>
          <p>${I('pin')} ${c.loc}</p>
          <div class="chips">
            <a class="btn g" href="#/ar">Experience AR</a>
            <a class="btn o" style="color:#fff;border-color:#fff8" href="#/map">Lihat di Peta</a>
            <button class="btn o" style="color:#fff;border-color:#fff8" data-a="fav" data-v="c:${c.s}">
              ${I('heart')} ${sav.has('c:' + c.s) ? 'Tersimpan' : 'Simpan'}
            </button>
          </div>
        </div>
      </section>

      <div class="w sec">
        ${crumb('<a href="#/explore">Jelajah</a>', c.t)}

        <div class="meta">
          <div><span class="small mut">Asal</span><br><b>${c.k}</b></div>
          <div><span class="small mut">Kategori</span><br><b>${c.cat}</b></div>
          <div><span class="small mut">Status</span><br><b>Terdokumentasi</b></div>
          <div><span class="small mut">Data</span><br><b>Contoh (mock)</b></div>
        </div>

        <div class="split" style="align-items:start">
          <div>
            <h2>Tentang</h2>
            <p>${c.d}</p>
            ${['Sejarah', 'Filosofi', 'Ciri khas', 'Proses & pelestarian'].map((x) => `
              <details>
                <summary>${x}</summary>
                <p class="mut">Ringkasan ${x.toLowerCase()} ${c.t} akan diisi kurator budaya. Konten pada prototipe ini bersifat contoh.</p>
              </details>`).join('')}

            <h3 style="margin-top:32px">Galeri</h3>
            <div class="grid" style="grid-template-columns:repeat(3,1fr);gap:8px">
              ${galleryOf(c).map((src, i) => `
                <button class="art" ${col(c.c[i % 2], c.c[(i + 1) % 2], 'aspect-ratio:1;border:0;border-radius:8px;padding:0')}
                  data-a="lb" data-v="${c.s}:${i}" aria-label="Buka foto ${i + 1}">
                  ${src ? `<img src="${src}" alt="${c.t} — foto ${i + 1}" loading="lazy" decoding="async" onerror="this.remove()">` : ''}
                </button>`).join('')}
            </div>
          </div>

          <div>
            <h3>Jejak waktu</h3>
            ${h ? `
              <div class="tl">
                <div class="it">
                  <b>${h.era}</b><br>${h.t}<br>
                  <span class="mut small">${h.d}</span><br>
                  <a href="#/history" style="color:var(--pri)">Lihat sejarah</a>
                </div>
              </div>` : ''}

            <h3>Penjual terkait</h3>
            <div class="grid" style="grid-template-columns:1fr">${sc(se)}</div>
          </div>
        </div>

        <h2 style="margin-top:56px">Produk Lokal Terkait</h2>
        ${ps.length ? `<div class="grid">${ps.map(pc).join('')}</div>` : empty('Belum ada produk di kategori ini', 'Lihat semua produk', '#/products')}

        <h2 style="margin-top:56px">Budaya yang Berkaitan</h2>
        <div class="grid">
          ${C.filter((x) => (x.cat == c.cat || x.loc == c.loc) && x.s != c.s).slice(0, 3).map(cc).join('')}
        </div>
      </div>`;
  },

  history: () => `
    ${hero(`
      <div class="w">
        <h1>Jejak Sejarah Bengkulu</h1>
        <p>Gulir untuk menyusuri era, peristiwa, tokoh, dan warisan. Ringkasan bersifat contoh untuk prototipe.</p>
      </div>`, HERO_IMG.history)}
    <div class="w sec" style="max-width:820px">
      ${crumb('Sejarah')}
      <div class="tl">
        ${H.map((h) => `
          <div class="it">
            <b>${h.era}</b> <span class="badge">${h.cat}</span>
            <h3 style="margin:.2em 0">${h.t}</h3>
            <p class="mut" style="margin:0">${h.d}</p>
          </div>`).join('')}
      </div>
    </div>`,

  map: () => `
    <div class="w sec" style="padding-top:24px">
      ${crumb('Peta')}
      <h1 style="font-size:clamp(1.8rem,4vw,3rem)">Peta Warisan &amp; Ekonomi Kreatif Bengkulu</h1>
      <div class="mapl">
        <aside class="side">
          <b>Filter</b>
          ${Object.keys(TC).map((k) => `
            <label>
              <input type="checkbox" data-a="mf" data-v="${k}" ${st.mf[k] ? 'checked' : ''}>
              <span style="color:${TC[k]}">●</span> ${k}
            </label>`).join('')}
          <hr style="border:0;border-top:1px solid var(--line)">
          <button class="btn o" style="width:100%;margin-bottom:8px" data-a="toast" data-v="Menampilkan lokasi terdekat (contoh)">Di Sekitar Saya</button>
          <button class="btn o" style="width:100%" data-a="toast" data-v="Rute rekomendasi (contoh)">Recommended Route</button>
          <p class="small mut">Peta dan jarak adalah simulasi visual tanpa GPS/API.</p>
        </aside>
        ${mapHtml()}
      </div>
    </div>`,

  ar: () => {
    const c = C[0];
    const statusLabel = st.ar == 0 ? 'Siap memindai' : st.ar == 1 ? 'Memindai…' : 'Objek terdeteksi';
    const subtitle = arStream
      ? 'Kamera aktif — arahkan ke kode QR budaya. Kode berisi tautan akan otomatis terbuka.'
      : 'Tekan "Scan Marker" untuk mengaktifkan kamera, atau "Gallery" untuk membaca QR dari foto.';

    return `
      <div class="w sec">
        ${crumb('AR Experience')}
        <h1 style="text-align:center;font-size:clamp(1.8rem,4vw,3rem)">AR Cultural Experience</h1>
        <p class="mut" style="text-align:center">${subtitle}</p>

        <div class="ar">
          <div class="cam"></div>
          <video id="arVideo" class="ar-video ${arStream ? 'on' : ''}" autoplay playsinline muted></video>
          <div class="top">
            <a class="ic" style="color:#fff" href="#/" aria-label="Kembali">${I('x')}</a>
            <span class="badge">${statusLabel}</span>
          </div>

          ${st.ar == 0 ? '<div class="frame"></div>' : ''}
          ${st.ar == 1 ? '<div class="frame"></div><div class="ln"></div>' : ''}
          ${st.ar == 2 ? `
            <div class="obj art" ${col(...c.c)}>${galleryImg
              ? `<img src="${galleryImg}" alt="Foto dari galeri" onerror="this.remove()">`
              : fadeStack(c.img ? [c.img] : [], c.t)}</div>
            <div class="info">
              <span class="badge">${galleryImg ? 'Gambar dikenali (simulasi)' : 'AR Object Detected'}</span>
              <h3 style="margin:.3em 0">${c.t}</h3>
              <p class="mut small" style="margin:0 0 .6em">Pengenalan objek bersifat simulasi, bukan computer vision sungguhan.</p>
              <div class="chips">
                <a class="btn" style="padding:8px 14px" href="#/culture/${c.s}">Learn More</a>
                <a class="btn o" style="padding:8px 14px" href="#/history">View History</a>
                <a class="btn o" style="padding:8px 14px" href="#/map">Open Map</a>
              </div>
            </div>` : ''}

          <div class="bot">
            <button class="btn g" data-a="scan">${I('scan')} Scan Marker</button>
            <button class="btn o" style="color:#fff" data-a="gallery">Gallery</button>
          </div>
        </div>
      </div>`;
  },

  products: () => {
    const PC = ['Semua', ...new Set(P.map((p) => p.cat))];
    let r = P.filter((p) =>
      (st.pc == 'Semua' || p.cat == st.pc) &&
      p.pr <= st.mx &&
      (p.t + by(S, p.seller).t).toLowerCase().includes(st.q.toLowerCase())
    );
    r.sort((a, b) => (st.sort == 'lo' ? a.pr - b.pr : st.sort == 'hi' ? b.pr - a.pr : b.r - a.r));

    return `
      ${hero(`
        <div class="w">
          <h1 style="font-size:clamp(2rem,5vw,3.4rem)">Temukan Produk Lokal Bengkulu</h1>
          <p>Jelajahi karya UMKM dan pelaku ekonomi kreatif Bengkulu, dari kain, kriya, hingga kuliner.</p>
        </div>`, HERO_IMG.products)}

      <div class="w sec">
        ${crumb('Produk Lokal')}
        <div class="bar">
          <input class="inp" id="eq" placeholder="Cari produk atau penjual" value="${st.q}" aria-label="Cari produk">
          <select class="inp" data-a="sort" aria-label="Urutkan">
            <option value="pop">Terpopuler</option>
            <option value="lo" ${st.sort == 'lo' ? 'selected' : ''}>Harga terendah</option>
            <option value="hi" ${st.sort == 'hi' ? 'selected' : ''}>Harga tertinggi</option>
          </select>
          <select class="inp" data-a="mx" aria-label="Harga maksimum">
            <option value="1e9">Semua harga</option>
            <option value="100000" ${st.mx == 1e5 ? 'selected' : ''}>&lt; Rp100.000</option>
          </select>
        </div>
        ${chips(PC, st.pc, 'pc')}
        <div class="grid" style="margin-top:22px">${r.map(pc).join('')}</div>
        ${r.length ? '' : empty('Belum ada produk di kategori ini', 'Reset filter', '#/products')}
      </div>`;
  },

  product: (s) => {
    const p = by(P, s);
    if (!p) return `<div class="w sec">${empty('Konten belum tersedia')}</div>`;
    const se = by(S, p.seller);
    const cu = by(C, p.cu);
    return `
      <div class="w sec">
        ${crumb('<a href="#/products">Produk</a>', p.t)}
        <div class="split" style="align-items:start">
          <div class="art" ${col(...p.c, 'aspect-ratio:1;border-radius:var(--r)')}>${p.img ? `<img src="${p.img}" alt="${p.t}" onerror="this.remove()">` : ''}</div>
          <div>
            <span class="badge">${p.cat}</span>
            <h1 style="font-size:2.4rem;margin-top:.3em">${p.t}</h1>
            <p>${I('star')} ${p.r} · <a href="#/seller/${se.s}" style="color:var(--pri)">${se.t}</a> · ${se.k}</p>
            <h2 style="color:var(--pri)">${rp(p.pr)}</h2>
            <p>${p.d}</p>
            <div class="meta">
              <div><span class="small mut">Material</span><br>${p.m}</div>
              <div><span class="small mut">Asal</span><br>${se.k}</div>
            </div>
            <div class="chips">
              <button class="btn" data-a="chat" data-v="${se.s}" data-p="${p.s}">${I('chat')} Chat Penjual</button>
              <button class="btn o" data-a="toast" data-v="Tautan disalin">Bagikan</button>
              <button class="btn o" data-a="fav" data-v="p:${p.s}">${I('heart')} Simpan</button>
            </div>
            ${cu ? `<p style="margin-top:24px">Terkait budaya: <a style="color:var(--pri);font-weight:700" href="#/culture/${cu.s}">${cu.t}</a></p>` : ''}
          </div>
        </div>

        <h2 style="margin-top:56px">Produk Serupa</h2>
        <div class="grid">
          ${P.filter((x) => x.s != p.s && (x.seller == p.seller || x.cat == p.cat)).slice(0, 4).map(pc).join('')}
        </div>
      </div>`;
  },

  seller: (s) => {
    const se = by(S, s);
    if (!se) return `<div class="w sec">${empty('Konten belum tersedia')}</div>`;
    return `
      <div class="art seller-banner" ${col(...se.c)}>${se.img ? `<img src="${se.img}" alt="${se.t}" onerror="this.remove()">` : ''}</div>
      <div class="w">
        <div class="seller-head">
          <div class="art seller-avatar" ${col(se.c[1], se.c[0])}>${avatarImg(se)}</div>
          <div class="seller-name">
            <h1>${se.t} <span class="badge" style="background:var(--grn);color:#fff">Terverifikasi</span></h1>
            <span class="mut">${I('pin')} ${se.loc}</span>
          </div>
        </div>

        <div class="meta">
          <div><b>${P.filter((p) => p.seller == s).length}</b><br>Produk</div>
          <div><b>${se.fol}</b><br>Pengikut</div>
          <div><b>${se.yrs} tahun</b><br>Aktif</div>
        </div>

        <p style="max-width:60ch">${se.d}</p>

        <div class="chips">
          <button class="btn" data-a="chat" data-v="${se.s}">${I('chat')} Chat Penjual</button>
          <button class="btn o" data-a="social" data-v="${se.s}" data-k="ig">Instagram</button>
          <button class="btn o" data-a="social" data-v="${se.s}" data-k="tt">TikTok</button>
        </div>

        <h2 style="margin-top:48px">Katalog</h2>
        <div class="grid">${P.filter((p) => p.seller == s).map(pc).join('')}</div>

        <h2 style="margin-top:48px">Budaya terkait</h2>
        <div class="grid">${C.filter((c) => c.seller == s).map(cc).join('')}</div>
      </div>`;
  },

  search: () => {
    const q = st.q.toLowerCase();
    const match = (...fields) => fields.join(' ').toLowerCase().includes(q);

    const groups = [
      ['Budaya', C.filter((c) => match(c.t, c.d)), (c) => `#/culture/${c.s}`],
      ['Sejarah', H.filter((h) => match(h.t, h.d)), () => '#/history'],
      ['Produk', P.filter((p) => match(p.t, p.d)), (p) => `#/product/${p.s}`],
      ['UMKM', S.filter((s) => match(s.t, s.d)), (s) => `#/seller/${s.s}`],
      ['Lokasi', L.filter((l) => match(l.t)), () => '#/map'],
    ];

    if (!q) {
      return `
        <div class="w sec" style="max-width:820px">
          ${crumb('Cari')}
          <input class="inp" id="gq" placeholder="Cari, contoh: besurek" value="${st.q}" aria-label="Pencarian global" autofocus>
          <p class="mut" style="margin-top:22px">Pencarian terakhir</p>
          <div class="chips" style="margin-bottom:22px">
            ${['besurek', 'tabot', 'dol'].map((x) => `<button class="chip" data-a="q" data-v="${x}">${x}</button>`).join('')}
          </div>
          <p class="mut">Kategori populer</p>
          ${chips(CATS.slice(1), '', 'gocat')}
        </div>`;
    }

    const results = groups
      .map(([name, items, hrefFn]) => (items.length ? `
        <h3 style="margin-top:28px">${name}</h3>
        ${items.map((o) => `
          <a class="card" href="${hrefFn(o)}" style="padding:14px 16px;margin-bottom:8px">
            <span class="badge">${name}</span> <b>${o.t}</b>
          </a>`).join('')}` : ''))
      .join('');

    return `
      <div class="w sec" style="max-width:820px">
        ${crumb('Cari')}
        <input class="inp" id="gq" placeholder="Cari, contoh: besurek" value="${st.q}" aria-label="Pencarian global" autofocus>
        ${results || empty('Tidak ada hasil', 'Reset', '#/search')}
      </div>`;
  },

  saved: () => {
    const tabs = ['Budaya', 'Produk', 'Lokasi', 'Cerita'];
    const items =
      st.tab == 'Budaya' ? C.filter((c) => sav.has('c:' + c.s)).map(cc) :
      st.tab == 'Produk' ? P.filter((p) => sav.has('p:' + p.s)).map(pc) :
      [];
    return `
      <div class="w sec">
        ${crumb('Tersimpan')}
        <h1 style="font-size:clamp(2rem,5vw,3.4rem)">Tersimpan</h1>
        <div class="tabs" role="tablist">
          ${tabs.map((t) => `<button role="tab" class="${t == st.tab ? 'on' : ''}" data-a="tab" data-v="${t}">${t}</button>`).join('')}
        </div>
        ${items.length ? `<div class="grid">${items.join('')}</div>` : empty('Belum ada yang disimpan')}
      </div>`;
  },

  profile: () => `
    <div class="w sec">
      ${crumb('Profil')}
      <div style="display:flex;gap:18px;align-items:center">
        <div class="art" ${col('#7a1f2b', '#b8893b', 'width:84px;height:84px;border-radius:50%')}></div>
        <h1 style="margin:0;font-size:2.2rem">Explorer</h1>
      </div>
      <div class="meta">
        <div><b>${sav.size}</b><br>Tersimpan</div>
        <div><b>3</b><br>Dikunjungi</div>
        <div><b>${C.length}</b><br>Dijelajahi</div>
      </div>
      <h3>Preferensi</h3>
      <button class="btn o" data-a="theme">Ganti tema terang/gelap</button>
      <p class="mut small">Masuk/daftar tidak tersedia pada prototipe ini.</p>
    </div>`,

  about: () => `
    <div class="w sec" style="max-width:860px">
      ${crumb('Tentang')}
      <h1>Digitalisasi untuk Pelestarian</h1>
      <p>Platform ini menghubungkan dokumentasi budaya, AR, pemetaan GIS, promosi, dan pasar dalam satu ekosistem bagi Provinsi Bengkulu.</p>
      <div class="grid">
        ${['Pelestarian budaya', 'Edukasi', 'Ekonomi kreatif', 'Akses digital'].map((t) => `
          <div class="card">
            <div class="bd">
              <h3>${t}</h3>
              <p>Mendukung tujuan proyek melalui pengalaman yang mudah diakses semua kalangan.</p>
            </div>
          </div>`).join('')}
      </div>
      <p class="small mut" style="margin-top:24px">Prototipe UI/UX fidelitas tinggi. Seluruh data adalah contoh; belum ada backend, GIS, atau AR sungguhan.</p>
    </div>`,
};


/* ---------- Halaman chat: #/chat (daftar) dan #/chat/<slug-penjual> ---------- */

pages.chat = (slug) => {
  // Daftar percakapan
  if (!slug) {
    return `
      <div class="w sec">
        <h1>Pesan</h1>
        <p class="mut">Percakapanmu dengan penjual UMKM.</p>
        <div class="clist" id="cl"></div>
      </div>`;
  }

  const shop = by(S, slug);
  if (!shop) {
    return `<div class="w sec">${empty('Penjual tidak ditemukan', 'Lihat Produk', '#/products')}</div>`;
  }

  // Isi awal kolom ketik: pesan tentang produk (bila dibuka dari halaman
  // produk) atau sapaan umum bila percakapan masih kosong.
  const product = st.chatProduct ? by(P, st.chatProduct) : null;
  st.chatProduct = null;
  chat.draft = '';
  chat.pendingProduct = product ? product.s : null;
  if (product) {
    chat.draft = CHAT_TEXT.product(shop, product);
  } else if (!convo(slug).msgs.length) {
    chat.draft = CHAT_TEXT.seller(shop);
  }

  return `
    <div class="chatpage">
      <header class="chead">
        <a class="ic back" href="#/chat" aria-label="Kembali ke daftar pesan">${I('arrow')}</a>
        <div class="art cav" ${col(shop.c[1], shop.c[0])}>${avatarImg(shop)}</div>
        <div class="cinfo">
          <a href="#/seller/${shop.s}"><b>${shop.t}</b></a>
          <span class="small mut" id="cs"></span>
        </div>
      </header>
      <div class="cmsgs" id="cm" aria-live="polite"></div>
      <div class="cinput">
        <textarea id="ci" rows="1" maxlength="1000" placeholder="Tulis pesan…" aria-label="Pesan untuk penjual">${escHtml(chat.draft)}</textarea>
        <button class="btn" data-a="chatsend" aria-label="Kirim pesan">${I('arrow')}</button>
      </div>
    </div>`;
};


/* ============ 6. MAP RENDERER (Leaflet) ============
   Dipakai baik oleh section "Map Preview" di Home maupun
   halaman penuh #/map. mapHtml() hanya menghasilkan markup
   kontainer kosong (#appMap) + kartu lokasi terapung; peta
   sesungguhnya diisi oleh initMap() setelah markup ini
   disisipkan ke DOM (lihat bagian 8. ROUTER). */
function mapHtml() {
  const selected = st.sel && by(L, st.sel);

  return `
    <div class="map" role="group" aria-label="Peta Bengkulu">
      <div id="appMap"></div>

      ${selected ? `
        <div class="loc">
          <span class="badge">${selected.type}</span> <b>${selected.t}</b>
          <p class="mut small" style="margin:.3em 0">${I('pin')} ${selected.dist} dari lokasimu (contoh)</p>
          <div class="chips">
            <a class="btn" style="padding:8px 16px" href="#/culture/${selected.cu}">Detail</a>
            <button class="btn o" style="padding:8px 16px" data-a="toast" data-v="Membuka rute (contoh)">Directions</button>
          </div>
        </div>` : ''}
    </div>`;
}

// Instance peta Leaflet yang sedang aktif (null bila tidak ada
// halaman dengan peta yang sedang ditampilkan).
let gisMap = null;

// Posisi/zoom terakhir, dipertahankan antar render agar peta
// tidak "lompat" ke tengah setiap kali sebuah marker diklik.
let mapView = { center: MAP_CENTER, zoom: 9 };

// Pilihan jenis peta dasar (basemap), semuanya gratis dan tidak
// butuh API key. "Peta" dipakai sebagai default.
const BASEMAPS = {
  Peta: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  Satelit: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri — Sumber: Esri, Maxar, Earthstar Geographics, dan komunitas GIS',
    maxZoom: 19,
  },
  Topografi: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Data peta: &copy; OpenStreetMap contributors, SRTM | Gaya peta: &copy; <a href="https://opentopomap.org" target="_blank" rel="noopener">OpenTopoMap</a> (CC-BY-SA)',
    maxZoom: 17,
  },
};

/**
 * Buat/segarkan peta Leaflet di dalam #appMap.
 * @param {boolean} interactive - true di halaman /map (bisa di-drag,
 *   zoom, ganti basemap, dsb). false di preview beranda (tampilan
 *   statis, basemap tunggal saja).
 */
function initMap(interactive) {
  if (gisMap) {
    gisMap.remove();
    gisMap = null;
  }

  const el = document.getElementById('appMap');
  if (!el || !Leaflet) return; // Leaflet belum termuat

  gisMap = Leaflet.map('appMap', {
    center: mapView.center,
    zoom: interactive ? mapView.zoom : Math.min(mapView.zoom, 9),
    zoomControl: interactive,
    dragging: interactive,
    scrollWheelZoom: false,
    doubleClickZoom: interactive,
    boxZoom: interactive,
    keyboard: interactive,
    tap: interactive,
    attributionControl: interactive,
  });

  // Siapkan semua pilihan basemap, lalu pasang "Peta" sebagai default.
  const baseLayers = {};
  Object.entries(BASEMAPS).forEach(([name, cfg]) => {
    baseLayers[name] = Leaflet.tileLayer(cfg.url, { maxZoom: cfg.maxZoom, attribution: cfg.attribution });
  });
  baseLayers.Peta.addTo(gisMap);

  // Kontrol ganti basemap (ikon lapisan di pojok kanan atas) hanya
  // ditampilkan di halaman /map penuh, bukan di preview beranda.
  if (interactive) {
    Leaflet.control.layers(baseLayers, null, { position: 'topright', collapsed: true }).addTo(gisMap);
  }

  // Ingat posisi/zoom terakhir supaya render berikutnya konsisten
  gisMap.on('moveend', () => {
    mapView = { center: gisMap.getCenter(), zoom: gisMap.getZoom() };
  });

  const visible = L.filter((loc) => st.mf[loc.type]);
  visible.forEach((loc) => {
    const icon = Leaflet.divIcon({
      className: '',
      html: `<div class="mk-pin ${st.sel == loc.s ? 'on' : ''}" data-a="mk" data-v="${loc.s}"
               style="background:${TC[loc.type]};color:${TC[loc.type]}"
               role="button" tabindex="0" aria-label="${loc.t}">${I('pin')}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
    Leaflet.marker([loc.lat, loc.lng], { icon, keyboard: false }).addTo(gisMap);
  });

  // Di mobile, bottom nav bersifat fixed dan menutupi bagian bawah
  // layar — sesuaikan tinggi peta agar tidak tertimpa olehnya, lalu
  // minta Leaflet menghitung ulang ukuran tile-nya.
  fitMobileMapHeight();
  gisMap.invalidateSize();
}

/**
 * Hitung ulang tinggi kontainer peta penuh (#/map) di mobile agar
 * pas di ruang yang tersisa di atas bottom navigation (yang fixed
 * di layar). Tidak berlaku di desktop/tablet (bottom nav tersembunyi,
 * tinggi peta mengikuti CSS min-height seperti biasa), dan tidak
 * berlaku di preview beranda (tidak memakai layout .mapl).
 */
function fitMobileMapHeight() {
  const wrap = document.querySelector('.mapl .map');
  if (!wrap) return; // bukan sedang di halaman /map penuh

  const bn = document.querySelector('.bn');
  const bnVisible = bn && getComputedStyle(bn).display !== 'none';
  if (!bnVisible) {
    wrap.style.height = ''; // kembalikan ke CSS min-height bawaan
    return;
  }

  const top = wrap.getBoundingClientRect().top;
  const gutter = 12;
  const available = window.innerHeight - top - bn.offsetHeight - gutter;
  wrap.style.height = Math.max(available, 320) + 'px';
}


/* ============ 6b. AR: KAMERA & GALERI ============
   Halaman AR bisa meminta izin kamera sungguhan (lewat getUserMedia)
   dan membuka galeri foto perangkat lewat <input type="file">. Hasil
   "pengenalan objek" tetap simulasi (bukan computer vision asli) —
   ini cuma mengaktifkan APINYA, sesuai batasan prototipe di awal. */

// MediaStream kamera yang sedang aktif, atau null kalau belum/tidak
// ada akses. Disimpan di luar fungsi supaya bisa dipakai lagi tanpa
// minta izin berulang kali selama masih di halaman AR.
let arStream = null;

// Data URL foto yang dipilih dari galeri, dipakai sebagai "hasil
// pindai" di kartu objek terdeteksi. null berarti belum ada yang dipilih.
let galleryImg = null;

// id setInterval dari loop pembacaan QR dari video kamera yang
// sedang berjalan, atau null kalau tidak ada yang aktif.
let qrScanTimer = null;

/**
 * Ambil URL dari hasil baca QR, kalau isinya memang sebuah tautan.
 * Menerima URL dengan skema eksplisit (http://, https://) maupun QR
 * yang isinya diawali "www." tanpa skema (ditambahkan https:// secara
 * otomatis). Isi lain (teks biasa, nomor WhatsApp, dsb.) dianggap
 * "tidak dikenali" dan jatuh ke alur simulasi deteksi objek biasa.
 */
function extractUrl(text) {
  const t = (text || '').trim();
  if (/^https?:\/\//i.test(t)) return t;
  if (/^www\./i.test(t)) return 'https://' + t;
  return null;
}

/**
 * Dipanggil begitu jsQR berhasil membaca sebuah kode, baik dari
 * video kamera maupun dari foto galeri. Kalau isinya URL, langsung
 * buka di tab baru (redirect sementara, sesuai permintaan — nanti
 * bisa diganti alur AR yang lebih lengkap). Kalau bukan URL, jatuh
 * ke kartu "objek terdeteksi" simulasi seperti sebelumnya.
 */
function handleQrResult(rawText) {
  stopQrScanLoop();
  const url = extractUrl(rawText);

  if (url) {
    toast('QR terdeteksi — membuka tautan…');
    window.open(url, '_blank', 'noopener');
    st.ar = 0; // kembali siap memindai lagi
    galleryImg = null;
  } else {
    // Tampilkan isi QR apa adanya (dipotong bila panjang) supaya
    // mudah dicek — mis. untuk tahu kenapa suatu QR tidak dianggap tautan.
    const preview = rawText.length > 60 ? rawText.slice(0, 57) + '…' : rawText;
    toast(`QR terbaca, bukan tautan: "${preview}"`);
    st.ar = 2; // tampilkan kartu objek simulasi seperti biasa
  }
  if (location.hash == '#/ar') route(true);
}

/**
 * Jalankan loop pembacaan QR dari video kamera yang sedang aktif.
 * Setiap ~350ms, satu frame video digambar ke <canvas> tersembunyi
 * lalu dibaca lewat jsQR. Semua berjalan di perangkat pengguna
 * sendiri (tidak ada data yang dikirim ke server mana pun).
 */
function startQrScanLoop() {
  stopQrScanLoop();
  if (typeof jsQR !== 'function') return; // pustaka belum/gagal termuat

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  qrScanTimer = setInterval(() => {
    const video = document.getElementById('arVideo');
    if (!video || video.readyState < 2 || !video.videoWidth) return; // video belum siap

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    let imageData;
    try {
      imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (e) {
      return; // sangat jarang terjadi untuk stream kamera lokal
    }

    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code && code.data) handleQrResult(code.data);
  }, 350);
}

/** Hentikan loop pembacaan QR dari kamera (bila sedang berjalan). */
function stopQrScanLoop() {
  if (qrScanTimer) {
    clearInterval(qrScanTimer);
    qrScanTimer = null;
  }
}

/**
 * Baca kode QR dari sebuah foto statis (data URL), mis. hasil
 * pilihan dari galeri. Memanggil `callback(url)` dengan url (string)
 * bila ditemukan dan berupa tautan, atau `callback(null)` bila tidak.
 */
function decodeImageForQr(dataUrl, callback) {
  if (typeof jsQR !== 'function') {
    callback(null);
    return;
  }
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      callback(code && code.data ? extractUrl(code.data) : null);
    } catch (e) {
      callback(null);
    }
  };
  img.onerror = () => callback(null);
  img.src = dataUrl;
}

/**
 * Lekatkan `arStream` (bila ada) ke elemen <video id="arVideo"> yang
 * baru saja dirender. Dipanggil setiap kali halaman AR di-render
 * ulang, karena innerHTML diganti total setiap kali (elemen video
 * lama hilang, perlu dilekatkan ulang ke yang baru).
 */
function syncArVideo() {
  const video = document.getElementById('arVideo');
  if (!video) return;
  if (arStream) {
    video.srcObject = arStream;
    video.classList.add('on');
    // Melekatkan srcObject ke elemen <video> yang BARU (hasil render
    // ulang) tidak selalu otomatis memutar videonya di semua browser
    // — panggil play() secara eksplisit. Kegagalannya diabaikan
    // (mis. race condition biasa saat elemen baru saja dipasang).
    video.play().catch(() => {});
  } else {
    video.classList.remove('on');
  }
}

/**
 * Matikan kamera sepenuhnya (lepaskan perangkat kamera). Dipanggil
 * saat meninggalkan halaman AR, supaya lampu indikator kamera di
 * perangkat ikut mati dan tidak terus memakai baterai/privasi.
 */
function stopArCamera() {
  stopQrScanLoop();
  if (arStream) {
    arStream.getTracks().forEach((track) => track.stop());
    arStream = null;
  }
}

/**
 * Dipicu oleh tombol "Scan Marker". Minta izin kamera asli lewat
 * dialog native browser; kalau berhasil, video kamera tampil live di
 * balik bingkai pemindaian DAN mulai membaca kode QR dari video
 * tersebut terus-menerus (lihat startQrScanLoop). Kode QR berisi
 * tautan akan langsung membuka tab baru ke tautan itu.
 *
 * Kalau kamera ditolak/tidak tersedia (mis. di pratinjau artifact
 * yang disandbox, atau browser tanpa dukungan), turun otomatis ke
 * animasi simulasi deteksi objek seperti sebelumnya — tetap bisa
 * dipakai tanpa kamera sama sekali.
 */
async function scanMarker() {
  galleryImg = null; // pindaian kamera menggantikan hasil galeri sebelumnya
  st.ar = 1; // "Memindai…"
  route(true);

  if (!arStream) {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        arStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        syncArVideo();
      } catch (err) {
        // Di pratinjau artifact yang di-host (dibuka di dalam iframe),
        // akses kamera sering diblokir oleh kebijakan sandbox-nya —
        // beri petunjuk itu secara spesifik dibanding alasan lain
        // (mis. izin ditolak manual oleh pengguna).
        const sandboxed = window.self !== window.top;
        toast(
          sandboxed
            ? 'Kamera diblokir oleh pratinjau ini — coba buka file-nya sendiri di luar, atau pakai tombol Gallery'
            : 'Izin kamera ditolak/tidak tersedia — memakai mode simulasi'
        );
      }
    } else {
      toast('Kamera tidak didukung di pratinjau ini — memakai mode simulasi');
    }
  } else {
    syncArVideo();
  }

  if (arStream && typeof jsQR === 'function') {
    // Kamera aktif & pembaca QR siap: pindai terus-menerus, tidak
    // ada batas waktu — berhenti sendiri begitu kode QR terbaca
    // (lihat handleQrResult) atau saat halaman AR ditinggalkan.
    startQrScanLoop();
  } else {
    // Tidak ada kamera dan/atau jsQR gagal termuat: jatuh ke alur
    // simulasi lama (kartu objek budaya contoh muncul otomatis).
    setTimeout(() => {
      st.ar = 2;
      if (location.hash == '#/ar') route(true);
    }, 2200);
  }
}

/**
 * Dipicu oleh tombol "Gallery". Membuka pemilih foto bawaan
 * perangkat (bukan kamera) lewat <input type="file">, lalu foto yang
 * dipilih dicoba dibaca sebagai kode QR (mis. foto kode budaya yang
 * sudah difoto sebelumnya). Kalau ditemukan tautan, langsung dibuka;
 * kalau tidak, jatuh ke kartu "objek terdeteksi" simulasi seperti biasa.
 */
function openGallery() {
  let input = document.getElementById('galleryInput');
  if (!input) {
    input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.id = 'galleryInput';
    input.style.display = 'none';
    input.addEventListener('change', onGalleryPicked);
    document.body.appendChild(input);
  }
  input.value = ''; // reset, supaya memilih file yang sama lagi tetap memicu 'change'
  input.click();
}

/** Baca file yang dipilih dari galeri: coba sebagai QR dulu, baru simulasi. */
function onGalleryPicked(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    galleryImg = reader.result; // data URL
    toast('Menganalisis gambar…');
    st.ar = 1;
    route(true);

    decodeImageForQr(galleryImg, (url) => {
      if (url) {
        toast('QR terdeteksi di foto — membuka tautan…');
        window.open(url, '_blank', 'noopener');
        st.ar = 0;
        galleryImg = null;
        if (location.hash == '#/ar') route(true);
      } else {
        // Bukan QR (atau isinya bukan tautan): tetap tampilkan foto
        // yang dipilih di kartu "objek terdeteksi" simulasi.
        st.ar = 2;
        if (location.hash == '#/ar') route(true);
      }
    });
  };
  reader.readAsDataURL(file);
}


/* ============ 7. APP SHELL ============
   Navbar desktop, bottom navigation mobile, dan footer.
   Dirender ulang setiap kali route berubah agar status
   "aktif" pada tautan selalu tepat. */

const NAV = [
  ['#/', 'Beranda'],
  ['#/explore', 'Jelajah Budaya'],
  ['#/history', 'Sejarah'],
  ['#/map', 'Peta'],
  ['#/ar', 'AR Experience'],
  ['#/products', 'Produk Lokal'],
];

const BOTTOM_NAV = [
  ['#/', 'home', 'Home'],
  ['#/explore', 'cmp', 'Explore'],
  ['#/map', 'pin', 'Map'],
  ['#/chat', 'chat', 'Pesan'],
  ['#/saved', 'heart', 'Saved'],
  ['#/profile', 'user', 'Profile'],
];

function shell(activeHash) {
  document.getElementById('nav').innerHTML = `
    <nav class="top" id="tn" aria-label="Utama">
      <div class="w">
        <a class="logo" href="#/"><b>BENGKULU</b><span>Culture • Heritage • Creative Economy</span></a>
        <div class="links">
          ${NAV.map(([href, label]) => `<a href="${href}" class="${activeHash == href ? 'on' : ''}">${label}</a>`).join('')}
        </div>
        <a class="ic sp" href="#/search" aria-label="Cari">${I('search')}</a>
        <a class="ic" href="#/chat" aria-label="Pesan">${I('chat')}${chatBadgeHtml()}</a>
        <a class="ic" href="#/saved" aria-label="Tersimpan">${I('heart')}</a>
        <a class="ic" href="#/profile" aria-label="Profil">${I('user')}</a>
        <a class="btn cta" href="#/explore">Jelajahi Sekarang</a>
      </div>
    </nav>`;

  document.getElementById('bn').innerHTML = `
    <div class="bn" role="navigation" aria-label="Seluler">
      ${BOTTOM_NAV.map(([href, icon, label]) => `
        <a href="${href}" class="${activeHash == href ? 'on' : ''}">${I(icon)}${label}${href == '#/chat' ? chatBadgeHtml() : ''}</a>`).join('')}
    </div>`;

  document.getElementById('ft').innerHTML = `
    <footer>
      <div class="w">
        <div>
          <b style="font:700 1.4rem 'Playfair Display',serif">Bengkulu Digital Heritage</b>
          <p class="small" style="opacity:.8">Platform Digital untuk Pelestarian Warisan Budaya dan Ekonomi Kreatif Bengkulu</p>
          <a href="#/about">Tentang</a>
        </div>
        <div>
          <b>Jelajah</b>
          <a href="#/explore">Budaya</a>
          <a href="#/map">Peta</a>
          <a href="#/products">Produk Lokal</a>
        </div>
        <div>
          <b>Pengalaman</b>
          <a href="#/ar">AR</a>
          <a href="#/history">Sejarah</a>
        </div>
        <div>
          <b>Sosial</b>
          <a href="#/about">Instagram</a>
          <a href="#/about">TikTok</a>
        </div>
      </div>
    </footer>`;
}


/* ============ 7b. FADE STACK TIMERS ============
   Mengelola interval yang menukar class "active" antar foto di
   dalam setiap .fade-stack yang sedang ada di halaman (lihat
   fadeStack() di bagian 5 untuk markup-nya). */

// id setInterval yang sedang berjalan, supaya bisa dibersihkan saat
// halaman berganti (kalau tidak, akan terus berjalan menunjuk ke
// elemen yang sudah dihapus dari DOM — kebocoran memori).
let fadeTimers = [];

/** Hentikan semua interval crossfade yang sedang berjalan. */
function stopFadeStacks() {
  fadeTimers.forEach(clearInterval);
  fadeTimers = [];
}

/** Mulai interval crossfade untuk setiap .fade-stack di halaman saat ini. */
function startFadeStacks(intervalMs = 4500) {
  document.querySelectorAll('.fade-stack').forEach((stack) => {
    const id = setInterval(() => {
      const imgs = Array.from(stack.querySelectorAll('img'));
      if (imgs.length < 2) return; // cukup 0/1 foto, tidak perlu fade
      const current = imgs.findIndex((img) => img.classList.contains('active'));
      const next = (current + 1) % imgs.length;
      imgs.forEach((img, i) => img.classList.toggle('active', i === next));
    }, intervalMs);
    fadeTimers.push(id);
  });
}

/* ============ 8. ROUTER ============
   Hash sederhana: #/nama-halaman/slug-opsional
   Contoh: #/culture/kain-besurek → page="culture", slug="kain-besurek" */

function route(keepScroll) {
  const parts = (location.hash || '#/').slice(2).split('/');
  const pageName = parts[0] || 'home';
  const render = pages[pageName] || pages.home;
  const prevScrollY = scrollY;

  stopFadeStacks(); // hentikan timer halaman sebelumnya sebelum DOM-nya diganti

  const activeHash = pageName == 'home' ? '#/' : '#/' + pageName;
  shell(activeHash);

  const app = document.getElementById('app');
  app.className = 'pv';
  app.innerHTML = render(parts[1]);
  startFadeStacks(); // mulai timer untuk .fade-stack di halaman baru

  const pageTitle = pageName == 'home' ? '' : pageName[0].toUpperCase() + pageName.slice(1) + ' · ';
  document.title = pageTitle + 'Bengkulu Digital Heritage';

  // Posisi scroll HARUS diset sebelum initMap(), karena initMap()
  // mengukur posisi peta relatif terhadap viewport (fitMobileMapHeight).
  // Mengukur sebelum scroll selesai menghasilkan tinggi yang salah.
  if (!keepScroll) {
    scrollTo(0, 0);
  } else {
    scrollTo(0, prevScrollY);
  }
  onScroll();

  // Halaman beranda (preview) dan /map (penuh) menampilkan peta
  // Leaflet sungguhan; halaman lain tidak butuh peta sama sekali.
  if (pageName == 'home' || pageName == 'map') {
    initMap(pageName == 'map');
    // Pengukuran kedua pada frame berikutnya, untuk berjaga-jaga bila
    // browser belum selesai melakukan reflow/scroll saat initMap()
    // pertama kali berjalan (terutama di perangkat yang lebih lambat).
    requestAnimationFrame(() => {
      fitMobileMapHeight();
      gisMap && gisMap.invalidateSize();
    });
  } else if (gisMap) {
    gisMap.remove();
    gisMap = null;
  }

  // Halaman chat: isi pesan, mulai polling. Di halaman lain, hentikan polling.
  // Pada chat satu percakapan, footer dan bottom nav disembunyikan
  // (tampilan seperti aplikasi pesan) lewat class body.chat-open.
  if (pageName == 'chat') {
    initChat(parts[1]);
  } else {
    stopChat();
  }
  document.body.classList.toggle('chat-open', pageName == 'chat' && !!parts[1]);

  // Halaman AR: lekatkan kembali stream kamera (bila sedang aktif) ke
  // elemen <video> yang baru dirender. Di halaman LAIN, matikan kamera
  // sepenuhnya supaya perangkat tidak terus memakainya di latar belakang.
  if (pageName == 'ar') {
    syncArVideo();
  } else if (arStream || qrScanTimer) {
    stopArCamera(); // juga menghentikan qrScanTimer bila masih berjalan
    st.ar = 0;
    galleryImg = null;
  }
}

/** Navbar berubah semi-transparan/solid saat halaman di-scroll. */
function onScroll() {
  const nav = document.getElementById('tn');
  nav && nav.classList.toggle('s', scrollY > 20);
}


/* ============ 9. EVENT HANDLERS ============ */

addEventListener('scroll', onScroll, { passive: true });

addEventListener('hashchange', () => {
  st.q = '';
  route();
});

// Delegasi klik untuk semua elemen ber-atribut data-a (data-action)
document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-a]');
  if (!target || target.tagName == 'SELECT' || target.type == 'checkbox') return;

  const action = target.dataset.a;
  const value = target.dataset.v;

  if (action == 'fav') {
    e.preventDefault();
    e.stopPropagation();
    fav(value);
  } else if (action == 'cat') {
    st.cat = value;
    route(true);
  } else if (action == 'gocat') {
    st.cat = value;
    location.hash = '#/explore';
  } else if (action == 'pc') {
    st.pc = value;
    route(true);
  } else if (action == 'view') {
    st.view = value;
    route(true);
  } else if (action == 'tab') {
    st.tab = value;
    route(true);
  } else if (action == 'q') {
    st.q = value;
    route(true);
  } else if (action == 'mk') {
    st.sel = value;
    route(true);
  } else if (action == 'toast') {
    toast(value);
  } else if (action == 'scan') {
    scanMarker();
  } else if (action == 'gallery') {
    openGallery();
  } else if (action == 'theme') {
    const root = document.documentElement;
    root.dataset.theme = root.dataset.theme == 'dark' ? 'light' : 'dark';
  } else if (action == 'lb') {
    // value = "<slug-budaya>:<nomor-foto>"
    const [slug, idxStr] = value.split(':');
    const c = by(C, slug);
    const list = c ? galleryOf(c) : [];
    const n = list.length;
    const i = ((+idxStr % n) + n) % n; // putar balik di ujung galeri
    const src = list[i];
    modal(`
      <h3>${c ? c.t : ''} — foto ${i + 1}/${n}</h3>
      <div class="art" ${col(...(c ? c.c : ['#7a1f2b', '#b8893b']), 'aspect-ratio:4/3;border-radius:8px')}>
        ${src ? `<img src="${src}" alt="${c.t} — foto ${i + 1}" style="object-fit:contain" onerror="this.remove()">` : ''}
      </div>
      ${src ? '' : '<p class="mut small">Foto belum tersedia (gambar contoh)</p>'}
      <div class="chips" style="margin-top:14px">
        ${n > 1 ? `<button class="btn o" data-a="lb" data-v="${slug}:${i - 1}" aria-label="Foto sebelumnya">‹</button>
        <button class="btn o" data-a="lb" data-v="${slug}:${i + 1}" aria-label="Foto berikutnya">›</button>` : ''}
        <button class="btn" data-a="close">Tutup</button>
      </div>`);
  } else if (action == 'chat') {
    st.chatProduct = target.dataset.p || null;
    location.hash = '#/chat/' + value;
  } else if (action == 'chatsend') {
    sendChat();
  } else if (action == 'chatretry') {
    retryChat(value);
  } else if (action == 'social') {
    openSocial(value, target.dataset.k);
  } else if (action == 'close') {
    close();
  }
});

/** Tampilkan modal generik dengan konten HTML `inner`.
 *  Panel dalam diberi data-a="noop" (bukan stopPropagation) supaya klik di
 *  dalam panel tidak menutup modal, tetapi tombol di dalamnya tetap sampai
 *  ke delegasi klik di document. */
function modal(inner) {
  document.getElementById('ov').innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" data-a="close">
      <div data-a="noop">${inner}</div>
    </div>`;
}

/** Tutup modal yang sedang terbuka. */
function close() {
  document.getElementById('ov').innerHTML = '';
}

addEventListener('keydown', (e) => {
  if (e.key == 'Escape') close();

  // Chat: Enter mengirim, Shift+Enter membuat baris baru
  if (e.target.id == 'ci' && e.key == 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    sendChat();
    return;
  }

  // Marker peta adalah <div role="button" tabindex="0">, bukan
  // elemen native, jadi Enter/Space perlu dipicu secara manual.
  if (e.key == 'Enter' || e.key == ' ') {
    const el = e.target.closest('[data-a][role="button"]');
    if (el) {
      e.preventDefault();
      el.click();
    }
  }
});

// Leaflet perlu tahu saat ukuran kontainernya berubah (mis. putar
// layar di ponsel), kalau tidak tile akan terpotong. Tinggi peta di
// mobile juga dihitung ulang supaya tetap tidak tertimpa bottom nav.
addEventListener('resize', () => {
  if (!gisMap) return;
  fitMobileMapHeight();
  gisMap.invalidateSize();
});

// Input pencarian: pertahankan posisi kursor saat re-render terjadi
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id == 'ci') {
    chat.draft = t.value;
    autosizeChatInput(t);
    return;
  }
  if (t.id == 'eq' || t.id == 'gq') {
    st.q = t.value;
    const cursorPos = t.selectionStart;
    const inputId = t.id;
    route(true);
    const newInput = document.getElementById(inputId);
    newInput.focus();
    newInput.setSelectionRange(cursorPos, cursorPos);
  }
});

// Perubahan pada <select> (urutkan, harga) dan checkbox filter peta
document.addEventListener('change', (e) => {
  const t = e.target;
  const action = t.dataset.a;
  if (action == 'sort') {
    st.sort = t.value;
    route(true);
  } else if (action == 'mx') {
    st.mx = +t.value;
    route(true);
  } else if (action == 'mf') {
    st.mf[t.dataset.v] = t.checked ? 1 : 0;
    route(true);
  }
});


/* ============ 10. INIT ============ */
route();
startGlobalChatSync();