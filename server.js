'use strict';

/* =========================================================
   Server chat Bengkulu Digital Heritage
   Jembatan antara website dan WhatsApp (Meta Cloud API).

   Alur:
   1. Pembeli menulis di website  → POST /api/messages
   2. Server meneruskan ke WhatsApp penjual lewat nomor bisnis platform
   3. Penjual membalas di WhatsApp → Meta memanggil POST /webhook
   4. Server mencocokkan balasan ke pembeli yang tepat
   5. Website mengambil balasan lewat GET /api/messages (polling)

   Tanpa library tambahan. Butuh Node.js 18 atau lebih baru.
   ========================================================= */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CONFIG = {
  port: Number(process.env.PORT) || 3000,
  allowedOrigin: process.env.ALLOWED_ORIGIN || '*',
  mock: process.env.WA_MOCK == '1',
  token: process.env.WA_TOKEN || '',
  phoneId: process.env.WA_PHONE_ID || '',
  verifyToken: process.env.WA_VERIFY_TOKEN || '',
  appSecret: process.env.WA_APP_SECRET || '',
  templateName: process.env.WA_TEMPLATE_NAME || '',
  graphVersion: process.env.WA_GRAPH_VERSION || 'v21.0',
  dataFile: process.env.DATA_FILE || path.join(__dirname, 'data.json'),
  sellersFile: process.env.SELLERS_FILE || path.join(__dirname, 'sellers.json'),
};

const MAX_TEXT = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const BUYER_ID_PATTERN = /^[a-z0-9]{16,64}$/;
const STATUS_RANK = { sending: 0, sent: 1, delivered: 2, read: 3 };

/* ---------- Data penjual ---------- */

function normalizeNumber(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('0')) {
    digits = '62' + digits.slice(1);
  }
  return digits;
}

const SELLERS = {};
const rawSellers = JSON.parse(fs.readFileSync(CONFIG.sellersFile, 'utf8'));
Object.keys(rawSellers).forEach((slug) => {
  SELLERS[slug] = {
    slug,
    name: rawSellers[slug].name || slug,
    wa: normalizeNumber(rawSellers[slug].wa),
  };
});

function sellerByNumber(number) {
  const digits = normalizeNumber(number);
  return Object.values(SELLERS).find((s) => s.wa && s.wa == digits);
}

/* ---------- Penyimpanan (file JSON sederhana) ---------- */

let db = { nextId: 1, messages: [] };

try {
  db = JSON.parse(fs.readFileSync(CONFIG.dataFile, 'utf8'));
} catch (err) {
  // file belum ada: mulai dari kosong
}

let saveTimer = null;

function saveDb() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = CONFIG.dataFile + '.tmp';
    fs.writeFile(tmp, JSON.stringify(db), (err) => {
      if (!err) fs.rename(tmp, CONFIG.dataFile, () => {});
    });
  }, 200);
}

function addMessage(fields) {
  const msg = {
    id: db.nextId,
    ts: Date.now(),
    clientId: null,
    waId: null,
    status: null,
    ...fields,
  };
  db.nextId += 1;
  db.messages.push(msg);
  saveDb();
  return msg;
}

const publicMessage = (m) => ({
  id: m.id,
  clientId: m.clientId,
  from: m.from,
  text: m.text,
  ts: m.ts,
  status: m.status,
});

/* ---------- Pembatas laju (anti spam) ---------- */

const hits = new Map();

function limited(key, max, windowMs) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > max;
}

setInterval(() => {
  const now = Date.now();
  hits.forEach((list, key) => {
    if (!list.some((t) => now - t < 120000)) hits.delete(key);
  });
}, 60000).unref();

/* ---------- WhatsApp Cloud API ---------- */

async function waSend(body) {
  const url = `https://graph.facebook.com/${CONFIG.graphVersion}/${CONFIG.phoneId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CONFIG.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data.error && data.error.message) || 'HTTP ' + res.status);
    err.code = data.error && data.error.code;
    throw err;
  }
  return data.messages && data.messages[0] && data.messages[0].id;
}

/** Kirim teks bebas. Return id pesan WhatsApp (dipakai untuk status & balasan). */
async function sendText(to, text) {
  if (CONFIG.mock) {
    console.log(`[mock] ke ${to}:\n${text}\n`);
    return 'mock-' + crypto.randomUUID();
  }
  return waSend({ to, type: 'text', text: { body: text, preview_url: false } });
}

function shortCode(buyerId) {
  return buyerId.slice(0, 4);
}

function formatForSeller(msg, isFirst) {
  const code = shortCode(msg.buyerId);
  const lines = [`*Pembeli #${code}* · Bengkulu Digital Heritage`];
  if (msg.productName) {
    lines.push(`Produk: ${msg.productName}`);
  }
  lines.push('', msg.text);
  if (isFirst) {
    lines.push(
      '',
      `_Balas dengan fitur "Balas" (Reply) WhatsApp pada pesan ini agar jawabanmu sampai ke pembeli. ` +
      `Alternatif: awali balasan dengan #${code}_`
    );
  }
  return lines.join('\n');
}

/** Teruskan pesan pembeli ke WhatsApp penjual. */
async function deliverToSeller(msg, isFirst) {
  const seller = SELLERS[msg.sellerSlug];
  const text = formatForSeller(msg, isFirst);

  try {
    return await sendText(seller.wa, text);
  } catch (err) {
    // Kode 131047 = di luar jendela 24 jam: hanya template yang boleh dikirim.
    if (err.code == 131047 && CONFIG.templateName && !CONFIG.mock) {
      return waSend({
        to: seller.wa,
        type: 'template',
        template: {
          name: CONFIG.templateName,
          language: { code: 'id' },
          components: [{
            type: 'body',
            parameters: [
              { type: 'text', text: shortCode(msg.buyerId) },
              { type: 'text', text: msg.text.replace(/\s+/g, ' ').slice(0, 900) },
            ],
          }],
        },
      });
    }
    throw err;
  }
}

/* ---------- Mencocokkan balasan penjual ke pembeli ---------- */

/** Cari buyerId tujuan untuk balasan penjual. Return { buyerId, text } atau { error }. */
function resolveBuyer(seller, incoming) {
  const sellerMsgs = db.messages.filter((m) => m.sellerSlug == seller.slug);
  const text = (incoming.text && incoming.text.body) || '';

  // 1. Penjual memakai fitur "Balas" di WhatsApp
  const ctxId = incoming.context && incoming.context.id;
  if (ctxId) {
    const ref = sellerMsgs.find((m) => m.waId == ctxId);
    if (ref) return { buyerId: ref.buyerId, text };
  }

  // 2. Penjual mengawali pesan dengan kode, mis. "#a1b2 Halo kak"
  const coded = text.match(/^\s*#([a-z0-9]{3,12})\b[:\s-]*([\s\S]*)$/i);
  if (coded) {
    const prefix = coded[1].toLowerCase();
    const ids = [...new Set(sellerMsgs.map((m) => m.buyerId))].filter((id) => id.startsWith(prefix));
    if (ids.length == 1 && coded[2].trim()) {
      return { buyerId: ids[0], text: coded[2].trim() };
    }
  }

  // 3. Tanpa petunjuk: pakai satu-satunya pembeli yang aktif dalam 24 jam terakhir
  const now = Date.now();
  const active = [...new Set(
    sellerMsgs.filter((m) => m.from == 'buyer' && now - m.ts < DAY_MS).map((m) => m.buyerId)
  )];
  if (active.length == 1) return { buyerId: active[0], text };

  return { error: 'ambiguous' };
}

async function handleIncoming(incoming) {
  const seller = sellerByNumber(incoming.from);
  if (!seller) return;

  // Meta bisa mengirim ulang webhook yang sama: abaikan duplikat.
  if (db.messages.some((m) => m.waId == incoming.id)) return;

  if (incoming.type !== 'text') {
    await sendText(seller.wa, 'Saat ini hanya pesan teks yang bisa diteruskan ke pembeli.').catch(() => {});
    return;
  }

  const target = resolveBuyer(seller, incoming);
  if (target.error) {
    await sendText(
      seller.wa,
      'Balasanmu belum bisa dicocokkan ke pembeli. Gunakan fitur "Balas" pada pesan pembeli, ' +
      'atau awali dengan kodenya, contoh: #a1b2 Halo kak.'
    ).catch(() => {});
    return;
  }

  addMessage({
    buyerId: target.buyerId,
    sellerSlug: seller.slug,
    from: 'seller',
    text: target.text.slice(0, MAX_TEXT),
    waId: incoming.id,
  });
}

function applyStatus(update) {
  const msg = db.messages.find((m) => m.waId == update.id);
  if (!msg || msg.from != 'buyer') return;

  if (update.status == 'failed') {
    msg.status = 'failed';
  } else if (STATUS_RANK[update.status] > (STATUS_RANK[msg.status] || 0)) {
    msg.status = update.status;
  }
  saveDb();
}

function handleWebhook(payload) {
  (payload.entry || []).forEach((entry) => {
    (entry.changes || []).forEach((change) => {
      const value = change.value || {};
      (value.statuses || []).forEach(applyStatus);
      (value.messages || []).forEach((m) => {
        handleIncoming(m).catch((err) => console.error('handleIncoming:', err.message));
      });
    });
  });
}

/* ---------- HTTP ---------- */

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req, limit = 20000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function signatureValid(rawBody, header) {
  if (!CONFIG.appSecret) return true; // tidak dicek bila secret belum diisi
  const expected = 'sha256=' + crypto.createHmac('sha256', CONFIG.appSecret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(header || ''));
  return a.length == b.length && crypto.timingSafeEqual(a, b);
}

async function postMessage(req, res, ip) {
  let body;
  try {
    body = JSON.parse((await readBody(req)).toString('utf8'));
  } catch (err) {
    return sendJson(res, 400, { error: 'Body tidak valid' });
  }

  const buyerId = String(body.buyerId || '');
  const sellerSlug = String(body.sellerSlug || '');
  const clientId = String(body.clientId || '').slice(0, 40);
  const text = String(body.text || '').trim().slice(0, MAX_TEXT);
  const productName = String(body.productName || '').replace(/\s+/g, ' ').slice(0, 120);

  if (!BUYER_ID_PATTERN.test(buyerId) || !SELLERS[sellerSlug] || !text || !clientId) {
    return sendJson(res, 400, { error: 'Data tidak lengkap' });
  }
  if (limited('buyer:' + buyerId, 20, 60000) || limited('ip:' + ip, 60, 60000)) {
    return sendJson(res, 429, { error: 'Terlalu banyak pesan, coba lagi sebentar' });
  }

  // Idempotent: klien yang mengirim ulang clientId yang sama tidak membuat pesan ganda
  let msg = db.messages.find((m) => m.buyerId == buyerId && m.clientId == clientId);
  if (msg && msg.status != 'failed') {
    return sendJson(res, 200, { message: publicMessage(msg) });
  }

  const isFirst = !db.messages.some((m) => m.buyerId == buyerId && m.sellerSlug == sellerSlug);
  if (!msg) {
    msg = addMessage({ buyerId, sellerSlug, from: 'buyer', text, clientId, productName, status: 'sending' });
  } else {
    msg.status = 'sending';
  }

  try {
    msg.waId = await deliverToSeller(msg, isFirst);
    msg.status = 'sent';
  } catch (err) {
    console.error('Gagal kirim ke WhatsApp:', err.message);
    msg.status = 'failed';
  }
  saveDb();
  return sendJson(res, 200, { message: publicMessage(msg) });
}

function getMessages(url, res) {
  const buyerId = url.searchParams.get('buyerId') || '';
  const sellerSlug = url.searchParams.get('sellerSlug') || '';
  const after = Number(url.searchParams.get('after')) || 0;

  if (!BUYER_ID_PATTERN.test(buyerId) || !SELLERS[sellerSlug]) {
    return sendJson(res, 400, { error: 'Parameter tidak valid' });
  }

  const convo = db.messages.filter((m) => m.buyerId == buyerId && m.sellerSlug == sellerSlug);
  const statuses = {};
  convo.forEach((m) => {
    if (m.from == 'buyer') statuses[m.id] = m.status;
  });

  return sendJson(res, 200, {
    messages: convo.filter((m) => m.id > after).map(publicMessage),
    statuses,
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const ip = req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : req.socket.remoteAddress;

  res.setHeader('Access-Control-Allow-Origin', CONFIG.allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
  if (req.method == 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  try {
    if (url.pathname == '/health') {
      return sendJson(res, 200, { ok: true, mock: CONFIG.mock });
    }

    if (url.pathname == '/api/messages' && req.method == 'POST') {
      return await postMessage(req, res, ip);
    }
    if (url.pathname == '/api/messages' && req.method == 'GET') {
      return getMessages(url, res);
    }

    // Verifikasi webhook oleh Meta (dipanggil sekali saat mendaftarkan webhook)
    if (url.pathname == '/webhook' && req.method == 'GET') {
      const ok = url.searchParams.get('hub.mode') == 'subscribe'
        && CONFIG.verifyToken
        && url.searchParams.get('hub.verify_token') == CONFIG.verifyToken;
      res.writeHead(ok ? 200 : 403);
      return res.end(ok ? url.searchParams.get('hub.challenge') : 'forbidden');
    }

    // Pesan masuk & status dari Meta
    if (url.pathname == '/webhook' && req.method == 'POST') {
      const raw = await readBody(req, 200000);
      if (!signatureValid(raw, req.headers['x-hub-signature-256'])) {
        res.writeHead(401);
        return res.end('bad signature');
      }
      res.writeHead(200);
      res.end('ok'); // balas cepat; Meta mengulang pengiriman bila lambat
      try {
        handleWebhook(JSON.parse(raw.toString('utf8')));
      } catch (err) {
        console.error('webhook:', err.message);
      }
      return;
    }

    return sendJson(res, 404, { error: 'Tidak ditemukan' });
  } catch (err) {
    console.error(err);
    return sendJson(res, 500, { error: 'Kesalahan server' });
  }
});

/** Simpan segera (sinkron). Dipakai saat server dimatikan agar pesan terakhir tidak hilang. */
function flushSync() {
  clearTimeout(saveTimer);
  try {
    fs.writeFileSync(CONFIG.dataFile, JSON.stringify(db));
  } catch (err) {
    console.error('Gagal menyimpan data:', err.message);
  }
}

if (require.main === module) {
  ['SIGINT', 'SIGTERM'].forEach((signal) => {
    process.on(signal, () => {
      flushSync();
      process.exit(0);
    });
  });

  server.listen(CONFIG.port, () => {
    console.log(`Server chat berjalan di port ${CONFIG.port}${CONFIG.mock ? ' (MODE MOCK: tidak mengirim ke WhatsApp)' : ''}`);
    if (!CONFIG.mock && (!CONFIG.token || !CONFIG.phoneId)) {
      console.warn('PERINGATAN: WA_TOKEN / WA_PHONE_ID belum diisi, pengiriman ke WhatsApp akan gagal.');
    }
  });
}

module.exports = { server, db };
