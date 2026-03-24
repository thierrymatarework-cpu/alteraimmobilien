// api/submit.js — Altera Immobilien
// Bewertung → PDF generieren → Airtable → E-Mail mit PDF-Anhang

const { Resend } = require('resend');
const Airtable   = require('airtable');
const { buildPDF, fmt } = require('../lib/pdfReport');

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

  const lm  = ({ top:1.38, sg:1.18, gut:1.0, mit:0.86, ein:0.73  }[data.lage]    || 1.0);
  const zm  = ({ neu:1.13, sg:1.06, gut:1.0, ren:0.89, san:0.75  }[data.zustand] || 1.0);
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

// ─── PDF generieren mit PDFKit ──────────────────────────────────────────────
// PDFKit läuft zuverlässig auf Vercel — kein Browser nötig
async function generatePDF(html) {
  const chromium = require('@sparticuz/chromium-min');
  const puppeteer = require('puppeteer-core');

  const executablePath = await chromium.executablePath(
    'https://github.com/Sparticuz/chromium/releases/download/v123.0.0/chromium-v123.0.0-pack.tar'
  );

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath,
    headless: chromium.headless,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
    });
    return pdf;
  } finally {
    await browser.close();
  }
}

// ─── Airtable ───────────────────────────────────────────────────────────────
async function saveToAirtable(data, result) {
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
    console.warn('Airtable: Keys fehlen');
    return null;
  }
  try {
    const base  = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
                    .base(process.env.AIRTABLE_BASE_ID);
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

    const id = record.getId();
    console.log('Airtable OK:', id);
    return id;
  } catch (err) {
    console.error('Airtable Fehler:', err.message);
    return null;
  }
}

// ─── E-Mail an Kunde mit PDF-Anhang ─────────────────────────────────────────
async function sendClientEmail(resend, data, result, pdfBuffer) {
  const { vorname, email, plz, ort } = data;
  const { total, rMin, rMax, score, scoreLabel, m2 } = result;

  const attachments = pdfBuffer ? [{
    filename:    `Altera-Bewertungsreport-${plz}.pdf`,
    content:     pdfBuffer.toString('base64'),
    contentType: 'application/pdf',
  }] : [];

  const { error } = await resend.emails.send({
    from:    'Altera Immobilien <onboarding@resend.dev>',
    to:      email,
    subject: `Ihre Immobilienbewertung — CHF ${fmt(total)}`,
    attachments,
    html: `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F9F8F4;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center" style="padding:32px 16px">
<table width="600" cellpadding="0" cellspacing="0" border="0"
       style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

  <tr><td style="background:#344E41;padding:28px 36px">
    <div style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.03em">
      Altera <span style="color:#C9A874">Immobilien</span>
    </div>
    <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px">Ihre persönliche Bewertung ist fertig</div>
  </td></tr>

  <tr><td style="padding:32px 36px 0">
    <p style="font-size:16px;font-weight:700;color:#111;margin:0 0 8px">
      Guten Tag${vorname ? `, ${vorname}` : ''}
    </p>
    <p style="font-size:14px;color:#666;line-height:1.75;margin:0">
      Ihre Immobilienbewertung für <strong style="color:#111">PLZ ${plz}${ort ? ' · ' + ort : ''}</strong>
      ist fertig. Den vollständigen Report finden Sie als
      <strong>PDF-Anhang</strong> in dieser E-Mail.
    </p>
  </td></tr>

  <tr><td style="padding:24px 36px 0">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:linear-gradient(135deg,#EDF1EE,#FBF6EE);border-radius:12px">
    <tr><td style="padding:26px 30px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#344E41;margin-bottom:8px">Geschätzter Marktwert</div>
      <div style="font-size:44px;font-weight:800;color:#111;letter-spacing:-0.05em;line-height:1">CHF ${fmt(total)}</div>
      <div style="font-size:13px;color:#666;margin-top:8px">Bandbreite: CHF ${fmt(rMin)} – CHF ${fmt(rMax)}</div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px">
      <tr>
        <td style="font-size:12px;font-weight:700;color:#8A2828">Min: CHF ${fmt(rMin)}</td>
        <td align="right" style="font-size:12px;font-weight:700;color:#1B6B3E">Max: CHF ${fmt(rMax)}</td>
      </tr>
      <tr><td colspan="2" style="padding-top:5px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="height:5px;background:linear-gradient(90deg,#F5C4C4,#C9A874,#344E41);border-radius:3px"></td></tr>
        </table>
      </td></tr>
      </table>
      <table cellpadding="0" cellspacing="0" border="0" style="margin-top:18px">
      <tr>
        <td style="padding-right:24px">
          <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px">Preis/m²</div>
          <div style="font-size:20px;font-weight:800;color:#111">CHF ${fmt(m2)}</div>
        </td>
        <td style="padding-right:24px">
          <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px">Score</div>
          <div style="font-size:20px;font-weight:800;color:#111">${score}/100</div>
        </td>
        <td>
          <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px">Einschätzung</div>
          <div style="font-size:14px;font-weight:700;color:#344E41">${scoreLabel}</div>
        </td>
      </tr>
      </table>
    </td></tr>
    </table>
  </td></tr>

  ${pdfBuffer ? `
  <tr><td style="padding:20px 36px 0">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#F9F8F4;border:1.5px solid #EAEAE4;border-radius:10px">
    <tr><td style="padding:16px 20px">
      <table cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="font-size:22px;padding-right:14px">📎</td>
        <td>
          <div style="font-size:13px;font-weight:700;color:#111;margin-bottom:2px">Vollständiger Report im Anhang</div>
          <div style="font-size:12px;color:#666">Altera-Bewertungsreport-${plz}.pdf · Mit Score-Analyse, Marktvergleich und Einschätzung</div>
        </td>
      </tr></table>
    </td></tr>
    </table>
  </td></tr>` : ''}

  <tr><td style="padding:20px 36px 0">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#344E41;border-radius:12px">
    <tr><td style="padding:22px 26px">
      <div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:6px">Professionelle Schätzung vor Ort — kostenlos</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-bottom:16px;line-height:1.6">
        Thierry oder Janis kommen persönlich zu Ihnen. Bankfähig, rechtsgültig, unverbindlich.
      </div>
      <a href="mailto:hallo@altera-immobilien.ch?subject=Terminanfrage"
         style="display:inline-block;background:#C9A874;color:#111;font-size:13px;font-weight:700;padding:11px 22px;border-radius:8px;text-decoration:none;margin-right:8px">
        Termin anfragen →
      </a>
      <a href="tel:+41440000000"
         style="display:inline-block;background:rgba(255,255,255,0.1);color:#fff;font-size:13px;padding:11px 22px;border-radius:8px;text-decoration:none;border:1px solid rgba(255,255,255,0.2)">
        +41 44 000 00 00
      </a>
    </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:24px 36px 28px">
    <p style="font-size:11px;color:#aaa;line-height:1.65;margin:0">
      Altera Immobilien GmbH · Seestrasse 88, 8700 Küsnacht<br>
      +41 44 000 00 00 · hallo@altera-immobilien.ch<br><br>
      Diese Bewertung basiert auf hedonischer Methodik und aktuellen Marktdaten.
      Sie dient zur Orientierung und ersetzt kein offizielles Gutachten.
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`,
  });

  if (error) console.error('E-Mail Kunde Fehler:', JSON.stringify(error));
  else       console.log('E-Mail + PDF gesendet an:', email);
}

// ─── E-Mail ans Team ────────────────────────────────────────────────────────
async function sendTeamEmail(resend, data, result, airtableId) {
  const notifyEmail = process.env.NOTIFY_EMAIL || 'hallo@altera-immobilien.ch';
  const { total, rMin, rMax, score, scoreLabel } = result;

  const { error } = await resend.emails.send({
    from:    'Altera System <onboarding@resend.dev>',
    to:      notifyEmail,
    subject: `🏠 Neuer Lead: ${data.vorname || ''} ${data.nachname || ''} — CHF ${fmt(total)}`,
    html: `
<div style="font-family:Arial,sans-serif;max-width:520px;padding:24px">
  <div style="font-size:20px;font-weight:700;color:#344E41;margin-bottom:20px">
    Altera <span style="color:#C9A874">Immobilien</span>
    <span style="font-size:13px;font-weight:400;color:#888;margin-left:8px">— Neuer Lead</span>
  </div>
  <table width="100%" style="font-size:14px;border-collapse:collapse">
    <tr><td style="padding:9px 0;color:#888;width:40%;border-bottom:1px solid #f0f0ea">Name</td>
        <td style="padding:9px 0;font-weight:700;border-bottom:1px solid #f0f0ea">${data.vorname || ''} ${data.nachname || ''}</td></tr>
    <tr><td style="padding:9px 0;color:#888;border-bottom:1px solid #f0f0ea">E-Mail</td>
        <td style="padding:9px 0;border-bottom:1px solid #f0f0ea"><a href="mailto:${data.email}" style="color:#344E41">${data.email}</a></td></tr>
    <tr><td style="padding:9px 0;color:#888;border-bottom:1px solid #f0f0ea">Telefon</td>
        <td style="padding:9px 0;border-bottom:1px solid #f0f0ea">${data.tel || '—'}</td></tr>
    <tr><td style="padding:9px 0;color:#888;border-bottom:1px solid #f0f0ea">PLZ / Ort</td>
        <td style="padding:9px 0;border-bottom:1px solid #f0f0ea">${data.plz || '—'}${data.ort ? ' · ' + data.ort : ''}</td></tr>
    <tr><td style="padding:9px 0;color:#888;border-bottom:1px solid #f0f0ea">Objekt</td>
        <td style="padding:9px 0;border-bottom:1px solid #f0f0ea">${data.typ || '—'}${data.subtyp ? ' / ' + data.subtyp : ''} · ${data.flaeche || '—'} m²</td></tr>
    <tr><td style="padding:9px 0;color:#888;border-bottom:1px solid #f0f0ea">Grund</td>
        <td style="padding:9px 0;border-bottom:1px solid #f0f0ea">${data.grund || '—'}</td></tr>
  </table>
  <div style="background:#EDF1EE;border-radius:10px;padding:20px 24px;margin-top:20px">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#344E41;margin-bottom:6px">Geschätzter Marktwert</div>
    <div style="font-size:38px;font-weight:800;color:#344E41;letter-spacing:-0.05em;line-height:1">CHF ${fmt(total)}</div>
    <div style="font-size:13px;color:#666;margin-top:6px">CHF ${fmt(rMin)} – CHF ${fmt(rMax)}</div>
    <div style="font-size:13px;color:#666;margin-top:4px">Score: ${score}/100 · ${scoreLabel}</div>
    ${airtableId ? `<div style="font-size:11px;color:#aaa;margin-top:8px">Airtable ID: ${airtableId}</div>` : ''}
  </div>
  <div style="background:#344E41;border-radius:10px;padding:16px 20px;margin-top:16px;color:#fff;font-size:13px;line-height:1.6">
    <strong>Nächster Schritt:</strong> ${data.vorname || 'Kunden'} innert 24h kontaktieren.<br>
    Report-PDF wurde automatisch an <strong>${data.email}</strong> gesendet.
  </div>
</div>`,
  });

  if (error) console.error('Team E-Mail Fehler:', JSON.stringify(error));
  else       console.log('Team E-Mail gesendet an:', notifyEmail);
}

// ─── Haupthandler ───────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Ungültiges JSON' });
  }

  if (!body.email || !body.email.includes('@')) {
    return res.status(400).json({ error: 'Ungültige E-Mail' });
  }

  console.log('Submit von:', body.email, '| PLZ:', body.plz);

  // 1. Berechnen
  const result = calcValues(body);
  console.log('Wert:', fmt(result.total), '| Score:', result.score);

  // 2. PDF generieren
  let pdfBuffer = null;
  try {
    console.log('PDF wird generiert...');
    let reportHTML;
    if (body.reportHtmlBase64) {
      // Frontend hat das fertige Report-HTML als Base64 mitgeschickt
      reportHTML = Buffer.from(body.reportHtmlBase64, 'base64').toString('utf-8');
      console.log('PDF: HTML vom Frontend, Laenge:', reportHTML.length);
    } else {
      // Serverseitig generieren
      reportHTML = buildReportHTML(body, result);
      console.log('PDF: HTML serverseitig generiert');
    }
    pdfBuffer = await generatePDF(reportHTML);
    console.log('PDF OK:', Math.round(pdfBuffer.length / 1024), 'KB');
  } catch (err) {
    console.error('PDF Fehler:', err.message);
    // E-Mail wird ohne Anhang gesendet
  }

  // 3. Airtable
  const airtableId = await saveToAirtable(body, result);

  // 4. E-Mails
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await sendClientEmail(resend, body, result, pdfBuffer);
    await sendTeamEmail(resend, body, result, airtableId);
  } else {
    console.warn('RESEND_API_KEY fehlt!');
  }

  return res.status(200).json({ success: true, value: result.total, score: result.score });
};
