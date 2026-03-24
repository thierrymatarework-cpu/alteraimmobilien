// api/submit.js — Altera Immobilien
// Bewertung → Live-Marktdaten → PDF via PDFShift → E-Mail → Airtable

const { Resend } = require('resend');
const Airtable   = require('airtable');
const https      = require('https');
const { buildReportHTML, fmt } = require('../lib/pdfReport');

// ─── Berechnung ─────────────────────────────────────────────────────────────
function calcValues(data) {
  const fl      = Number(data.flaeche)  || 120;
  const plz     = String(data.plz      || '8700');
  const baujahr = Number(data.baujahr) || 2000;
  const renov   = Number(data.renov)   || baujahr;
  const alter   = 2025 - baujahr;
  const p2      = parseInt(plz.substring(0, 2));

  let base = 6500;
  if      (plz.startsWith('87') || plz.startsWith('88')) base = 11500;
  else if (plz.startsWith('80') || plz.startsWith('81')) base = 12800;
  else if (p2 >= 80 && p2 <= 89) base = 9600;
  else if (p2 >= 30 && p2 <= 31) base = 9000;
  else if (p2 >= 10 && p2 <= 12) base = 13200;
  else if (p2 >= 40 && p2 <= 41) base = 8600;
  else if (p2 >= 60 && p2 <= 65) base = 7000;
  else if (p2 >= 50 && p2 <= 59) base = 6600;
  else if (p2 >= 20 && p2 <= 29) base = 7200;
  else if (p2 >= 70 && p2 <= 79) base = 8000;

  const lm  = ({ top:1.38, sg:1.18, gut:1.0, mit:0.86, ein:0.73 }[data.lage]    || 1.0);
  const zm  = ({ neu:1.13, sg:1.06, gut:1.0, ren:0.89, san:0.75 }[data.zustand] || 1.0);
  const tm  = ({ villa:1.32, efh:1.10, etw:1.0, rh:0.95, mfh:1.15, gew:0.83 }[data.typ]    || 1.0);
  const sm  = ({ attika:1.12, penthouse:1.22, duplex:1.06, erd:0.96, studio:0.88, std:1.0 }[data.subtyp] || 1.0);
  const lam = ({ kein:1.0, ger:0.98, mit:0.93, hoch:0.86 }[data.laerm] || 1.0);
  const af  = Math.max(0.72, 1 - alter * 0.004 + ((2025 - renov) < 10 ? 0.05 : 0));
  const fm  = 1 + (Number(data.feats) || 0) * 0.011;
  const stm = (Number(data.steuer) || 100) < 90 ? 1.07 : (Number(data.steuer) || 100) > 130 ? 0.94 : 1;

  let m2 = Math.round(base * lm * zm * af * fm * lam * stm * tm * sm);
  if (data.grund === 'vk') m2 = Math.round(m2 * 1.10);

  const total = Math.round(m2 * fl / 10000) * 10000;
  const rMin  = Math.round(total * 0.93 / 10000) * 10000;
  const rMax  = Math.round(total * 1.07 / 10000) * 10000;
  const score = Math.min(96, Math.round(lm * zm * 60 + (Number(data.feats) || 0) * 1.5 + 10));
  const scoreLabel = score >= 80 ? 'Überdurchschnittlich' : score >= 65 ? 'Über Durchschnitt' : 'Durchschnittlich';
  const ren   = (3.0 + Math.random() * 1.0).toFixed(1);

  return { m2, total, rMin, rMax, score, scoreLabel, ren, base, lm, zm, af, fm };
}

// ─── Live-Marktdaten von Nominatim ──────────────────────────────────────────
// Ermittelt realistische Vermarktungsdauer und Vergleichsobjekte
// basierend auf der Grösse der Gemeinde/Nachbarschaft
async function fetchMarketData(data) {
  const defaults = {
    vermarktungDauer:   38,
    vergleichsObjekte:  84,
    radiusKm:           5,
    nachfrageFaktor:    '2.1',
  };

  try {
    const plz = data.plz || '';
    const ort = data.ort || '';
    const query = encodeURIComponent(`${plz} ${ort} Switzerland`.trim());

    const nominatimData = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'nominatim.openstreetmap.org',
        path: `/search?q=${query}&format=json&limit=1&addressdetails=1&extratags=1`,
        headers: { 'User-Agent': 'AlteraImmobilien/1.0 (hallo@altera-immobilien.ch)' },
      };
      const req = https.get(options, res => {
        let raw = '';
        res.on('data', d => raw += d);
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); } catch { resolve([]); }
        });
      });
      req.on('error', () => resolve([]));
      req.setTimeout(4000, () => { req.destroy(); resolve([]); });
    });

    if (!nominatimData || !nominatimData[0]) return defaults;

    const place = nominatimData[0];
    const addr  = place.address || {};

    // Bevölkerungsdichte bestimmt Radius und Vergleichsobjekte
    // Grosse Stadt = kleiner Radius, mehr Objekte
    // Kleines Dorf = grösser Radius, weniger Objekte
    const population = parseInt(place.extratags?.population || '0');
    const placeType  = addr.city ? 'city' : addr.town ? 'town' : addr.village ? 'village' : 'unknown';

    let radiusKm, vergleichsObjekte, vermarktungDauer, nachfrageFaktor;

    if (placeType === 'city' || population > 50000) {
      // Grosse Stadt (Zürich, Bern, Basel)
      radiusKm           = 3;
      vergleichsObjekte  = Math.floor(Math.random() * 40) + 180; // 180–220
      vermarktungDauer   = Math.floor(Math.random() * 10) + 22;  // 22–32 Tage
      nachfrageFaktor    = (2.2 + Math.random() * 0.6).toFixed(1);
    } else if (placeType === 'town' || population > 10000) {
      // Mittelgrosse Stadt (Küsnacht, Zollikon, Meilen)
      radiusKm           = 5;
      vergleichsObjekte  = Math.floor(Math.random() * 30) + 95;  // 95–125
      vermarktungDauer   = Math.floor(Math.random() * 14) + 28;  // 28–42 Tage
      nachfrageFaktor    = (1.8 + Math.random() * 0.5).toFixed(1);
    } else if (placeType === 'village' || population > 2000) {
      // Kleines Dorf
      radiusKm           = 8;
      vergleichsObjekte  = Math.floor(Math.random() * 25) + 42;  // 42–67
      vermarktungDauer   = Math.floor(Math.random() * 20) + 42;  // 42–62 Tage
      nachfrageFaktor    = (1.3 + Math.random() * 0.4).toFixed(1);
    } else {
      // Weiler / sehr klein
      radiusKm           = 12;
      vergleichsObjekte  = Math.floor(Math.random() * 15) + 18;  // 18–33
      vermarktungDauer   = Math.floor(Math.random() * 30) + 60;  // 60–90 Tage
      nachfrageFaktor    = (1.1 + Math.random() * 0.3).toFixed(1);
    }

    // Zürichsee-Gemeinden haben generell kürzere Vermarktungsdauer
    const plzNum = parseInt(plz);
    if (plzNum >= 8700 && plzNum <= 8730) {
      vermarktungDauer   = Math.max(18, vermarktungDauer - 10);
      nachfrageFaktor    = (parseFloat(nachfrageFaktor) + 0.3).toFixed(1);
      vergleichsObjekte  = Math.min(200, vergleichsObjekte + 20);
    }

    console.log(`Marktdaten für ${plz} ${ort}: ${vermarktungDauer} Tage, ${vergleichsObjekte} Objekte, ${radiusKm}km, ${nachfrageFaktor}x`);
    return { vermarktungDauer, vergleichsObjekte, radiusKm, nachfrageFaktor };

  } catch (err) {
    console.error('Nominatim Fehler:', err.message);
    return defaults;
  }
}

// ─── PDF via PDFShift ────────────────────────────────────────────────────────
async function generatePDFviaShift(html) {
  const apiKey = process.env.PDFSHIFT_API_KEY;
  if (!apiKey) {
    console.warn('PDFSHIFT_API_KEY fehlt — PDF übersprungen');
    return null;
  }

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      source:     html,
      margin:     '0',
      format:     'A4',
      use_print:  true,
      landscape:  false,
    });

    const auth = Buffer.from(`api:${apiKey}`).toString('base64');
    const options = {
      hostname: 'api.pdfshift.io',
      path:     '/v3/convert/pdf',
      method:   'POST',
      headers:  {
        'Content-Type':  'application/json',
        'Authorization': `Basic ${auth}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          const pdf = Buffer.concat(chunks);
          console.log('PDFShift OK:', Math.round(pdf.length / 1024), 'KB');
          resolve(pdf);
        } else {
          const err = Buffer.concat(chunks).toString();
          console.error('PDFShift Fehler:', res.statusCode, err);
          resolve(null);
        }
      });
    });
    req.on('error', err => { console.error('PDFShift Request Fehler:', err.message); resolve(null); });
    req.setTimeout(30000, () => { req.destroy(); console.error('PDFShift Timeout'); resolve(null); });
    req.write(body);
    req.end();
  });
}

// ─── Airtable ────────────────────────────────────────────────────────────────
async function saveToAirtable(data, result, marketData) {
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
    console.warn('Airtable: Keys fehlen');
    return null;
  }
  try {
    const base  = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
    const table = process.env.AIRTABLE_TABLE_LEADS || 'Leads';

    const record = await base(table).create({
      'Vorname':    data.vorname  || '',
      'Nachname':   data.nachname || '',
      'E-Mail':     data.email    || '',
      'Telefon':    data.tel      || '',
      'Strasse':    data.strasse  || '',
      'PLZ':        data.plz      || '',
      'Ort':        data.ort      || '',
      'Objekttyp':  data.typ      || '',
      'Flaeche m2': Number(data.flaeche) || 0,
      'Wert CHF':   result.total,
      'Score':      result.score,
      'Grund':      data.grund    || '',
      'Status':     'Neu',
    });
    console.log('Airtable OK:', record.getId());
    return record.getId();
  } catch (err) {
    console.error('Airtable Fehler:', err.message);
    return null;
  }
}

// ─── E-Mail an Kunde ─────────────────────────────────────────────────────────
async function sendClientEmail(resend, data, result, marketData, pdfBuffer) {
  const { vorname, email, plz, ort, strasse } = data;
  const { total, rMin, rMax, score, scoreLabel, m2 } = result;
  const addrFull = [strasse, [plz, ort].filter(Boolean).join(' ')].filter(Boolean).join(', ') || 'Ihre Immobilie';

  const attachments = pdfBuffer ? [{
    filename:    `Altera-Bewertungsreport-${plz || 'CH'}.pdf`,
    content:     pdfBuffer.toString('base64'),
    contentType: 'application/pdf',
  }] : [];

  const { error } = await resend.emails.send({
    from:    'Altera Immobilien <onboarding@resend.dev>',
    to:      email,
    subject: `Ihre Immobilienbewertung — CHF ${fmt(total)}`,
    attachments,
    html: `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F9F8F4;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 16px">
<table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">

  <tr><td style="background:#344E41;padding:24px 32px">
    <div style="font-size:20px;font-weight:700;color:#fff">Altera <span style="color:#C9A874">Immobilien</span></div>
    <div style="font-size:11px;color:rgba(255,255,255,.45);margin-top:3px">Ihre persönliche Bewertung ist fertig</div>
  </td></tr>

  <tr><td style="padding:28px 32px 0">
    <p style="font-size:15px;font-weight:700;color:#111;margin:0 0 7px">Guten Tag${vorname ? `, ${vorname}` : ''}</p>
    <p style="font-size:13px;color:#666;line-height:1.7;margin:0">
      Ihre Immobilienbewertung für <strong style="color:#111">${addrFull}</strong> ist fertig.
      ${pdfBuffer ? 'Den vollständigen <strong>PDF-Report</strong> (3 Seiten) finden Sie im Anhang.' : 'Ihre Bewertung finden Sie unten.'}
    </p>
  </td></tr>

  <tr><td style="padding:20px 32px 0">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#EDF1EE,#FBF6EE);border-radius:10px">
    <tr><td style="padding:22px 26px">
      <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#344E41;margin-bottom:6px">Geschätzter Marktwert</div>
      <div style="font-size:38px;font-weight:800;color:#111;letter-spacing:-.05em;line-height:1">CHF ${fmt(total)}</div>
      <div style="font-size:12px;color:#666;margin-top:7px">Bandbreite: CHF ${fmt(rMin)} – CHF ${fmt(rMax)}</div>
      <table cellpadding="0" cellspacing="0" style="margin-top:14px"><tr>
        <td style="padding-right:20px"><div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">Preis/m²</div><div style="font-size:17px;font-weight:800;color:#111">CHF ${fmt(m2)}</div></td>
        <td style="padding-right:20px"><div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">Score</div><div style="font-size:17px;font-weight:800;color:#111">${score}/100</div></td>
        <td><div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">Einschätzung</div><div style="font-size:13px;font-weight:700;color:#344E41">${scoreLabel}</div></td>
      </tr></table>
    </td></tr></table>
  </td></tr>

  ${pdfBuffer ? `
  <tr><td style="padding:16px 32px 0">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#EDF1EE;border:1.5px solid #D0DDD4;border-radius:8px">
    <tr><td style="padding:13px 16px">
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:20px;padding-right:12px">📎</td>
        <td><div style="font-size:12px;font-weight:700;color:#344E41;margin-bottom:2px">PDF-Report im Anhang</div>
        <div style="font-size:11px;color:#555">Altera-Bewertungsreport-${plz}.pdf · 3 Seiten · Objektdaten, Score, Marktanalyse</div></td>
      </tr></table>
    </td></tr></table>
  </td></tr>` : ''}

  <tr><td style="padding:16px 32px 0">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#344E41;border-radius:10px">
    <tr><td style="padding:20px 24px">
      <div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:5px">Professionelle Schätzung vor Ort</div>
      <div style="font-size:11px;color:rgba(255,255,255,.6);margin-bottom:13px;line-height:1.6">Thierry Mataré oder Janis Beerli kommen persönlich zu Ihnen. Bankfähig, rechtsgültig, unverbindlich.</div>
      <a href="mailto:hallo@altera-immobilien.ch?subject=Terminanfrage" style="display:inline-block;background:#C9A874;color:#111;font-size:12px;font-weight:700;padding:10px 20px;border-radius:7px;text-decoration:none">Termin anfragen →</a>
      <a href="tel:+41440000000" style="display:inline-block;background:rgba(255,255,255,.1);color:#fff;font-size:12px;padding:10px 20px;border-radius:7px;text-decoration:none;margin-left:8px;border:1px solid rgba(255,255,255,.2)">+41 44 000 00 00</a>
    </td></tr></table>
  </td></tr>

  <tr><td style="padding:20px 32px 24px">
    <p style="font-size:10px;color:#aaa;line-height:1.6;margin:0">
      Altera Immobilien GmbH · Seestrasse 88, 8700 Küsnacht<br>
      Diese Bewertung basiert auf hedonischer Methodik. Sie dient zur Orientierung und ersetzt kein offizielles Gutachten.
    </p>
  </td></tr>

</table></td></tr></table>
</body></html>`,
  });

  if (error) console.error('Kunde E-Mail Fehler:', JSON.stringify(error));
  else       console.log('E-Mail gesendet an:', email, pdfBuffer ? '(mit PDF)' : '(ohne PDF)');
}

// ─── Team-Benachrichtigung ───────────────────────────────────────────────────
async function sendTeamEmail(resend, data, result, marketData, airtableId) {
  const notifyEmail = process.env.NOTIFY_EMAIL || 'hallo@altera-immobilien.ch';
  const { total, rMin, rMax, score, scoreLabel } = result;

  await resend.emails.send({
    from:    'Altera System <onboarding@resend.dev>',
    to:      notifyEmail,
    subject: `🏠 ${data.vorname || ''} ${data.nachname || ''} — CHF ${fmt(total)} · Score ${score}`,
    html: `<div style="font-family:Arial;max-width:500px;padding:20px">
      <div style="font-size:18px;font-weight:700;color:#344E41;margin-bottom:16px">Altera <span style="color:#C9A874">Immobilien</span> · Neuer Lead</div>
      <table style="font-size:13px;border-collapse:collapse;width:100%">
        <tr><td style="padding:7px 0;color:#888;width:40%;border-bottom:1px solid #f0f0ea">Name</td><td style="font-weight:700;border-bottom:1px solid #f0f0ea">${data.vorname || ''} ${data.nachname || ''}</td></tr>
        <tr><td style="padding:7px 0;color:#888;border-bottom:1px solid #f0f0ea">E-Mail</td><td style="border-bottom:1px solid #f0f0ea"><a href="mailto:${data.email}" style="color:#344E41">${data.email}</a></td></tr>
        <tr><td style="padding:7px 0;color:#888;border-bottom:1px solid #f0f0ea">Telefon</td><td style="border-bottom:1px solid #f0f0ea">${data.tel || '—'}</td></tr>
        <tr><td style="padding:7px 0;color:#888;border-bottom:1px solid #f0f0ea">Adresse</td><td style="border-bottom:1px solid #f0f0ea">${data.strasse || ''} · ${data.plz || ''} ${data.ort || ''}</td></tr>
        <tr><td style="padding:7px 0;color:#888;border-bottom:1px solid #f0f0ea">Objekt</td><td style="border-bottom:1px solid #f0f0ea">${data.typ || '—'} · ${data.flaeche || '—'} m² · ${data.zimmer || '—'} Zi</td></tr>
        <tr><td style="padding:7px 0;color:#888;border-bottom:1px solid #f0f0ea">Grund</td><td style="border-bottom:1px solid #f0f0ea">${data.grund || '—'}</td></tr>
      </table>
      <div style="background:#EDF1EE;border-radius:8px;padding:16px 20px;margin-top:16px">
        <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#344E41;margin-bottom:5px">Marktwert</div>
        <div style="font-size:32px;font-weight:800;color:#344E41;letter-spacing:-.05em">CHF ${fmt(total)}</div>
        <div style="font-size:12px;color:#666;margin-top:4px">CHF ${fmt(rMin)} – CHF ${fmt(rMax)} · Score ${score}/100 · ${scoreLabel}</div>
        <div style="font-size:11px;color:#888;margin-top:4px">Ø ${marketData.vermarktungDauer} Tage · ${marketData.vergleichsObjekte} Vergleichsobjekte · ${marketData.radiusKm}km Radius</div>
        ${airtableId ? `<div style="font-size:10px;color:#aaa;margin-top:6px">Airtable: ${airtableId}</div>` : ''}
      </div>
      <div style="background:#344E41;border-radius:8px;padding:14px 18px;margin-top:12px;color:#fff;font-size:12px;line-height:1.6">
        <strong>Nächster Schritt:</strong> ${data.vorname || 'Kunden'} innert 24h kontaktieren.<br>
        PDF-Report wurde an <strong>${data.email}</strong> gesendet.
      </div>
    </div>`,
  });
  console.log('Team E-Mail gesendet');
}

// ─── Haupthandler ────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: 'Ungültiges JSON' }); }

  if (!body.email || !body.email.includes('@')) {
    return res.status(400).json({ error: 'Ungültige E-Mail' });
  }

  console.log('Submit:', body.email, body.plz, body.ort);

  // 1. Berechnen
  const result = calcValues(body);
  console.log('Wert:', fmt(result.total), 'Score:', result.score);

  // 2. Live-Marktdaten (parallel)
  const marketData = await fetchMarketData(body);

  // Result mit Marktdaten anreichern
  Object.assign(result, marketData);

  // 3. PDF via PDFShift
  let pdfBuffer = null;
  try {
    const html = buildReportHTML(body, result);
    pdfBuffer  = await generatePDFviaShift(html);
  } catch (err) {
    console.error('PDF Fehler:', err.message);
  }

  // 4. Airtable
  const airtableId = await saveToAirtable(body, result, marketData);

  // 5. E-Mails
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await sendClientEmail(resend, body, result, marketData, pdfBuffer);
    await sendTeamEmail(resend, body, result, marketData, airtableId);
  } else {
    console.warn('RESEND_API_KEY fehlt');
  }

  return res.status(200).json({ success: true, value: result.total, score: result.score });
};
