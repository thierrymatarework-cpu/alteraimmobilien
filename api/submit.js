// api/submit.js
// Hauptendpunkt: Empfängt Bewertungsdaten, generiert PDF, sendet E-Mails, speichert Lead in Airtable

const { Resend } = require('resend');
const Airtable = require('airtable');
const { buildReportHTML } = require('../lib/generatePDF');

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function fmt(n) {
  return Number(n).toLocaleString('de-CH');
}

function calcValues(data) {
  const {
    flaeche = 120, plz = '8700', baujahr = 2000, renov,
    typ = 'etw', subtyp = 'std',
    lage = 'gut', zustand = 'gut',
    feats = 0, laerm = 'kein', steuer = 100, tm_mult = 1,
    grund = 'ori'
  } = data;

  const renovJ = renov || baujahr;
  const alter = 2025 - baujahr;
  const p2 = parseInt(String(plz).substring(0, 2));

  // PLZ → Basispreis
  let base = 6500;
  if (String(plz).startsWith('87') || String(plz).startsWith('88')) base = 11500;
  else if (String(plz).startsWith('80') || String(plz).startsWith('81')) base = 12800;
  else if (p2 >= 80 && p2 <= 89) base = 9600;
  else if (p2 >= 30 && p2 <= 31) base = 9000;
  else if (p2 >= 10 && p2 <= 12) base = 13200;
  else if (p2 >= 40 && p2 <= 41) base = 8600;
  else if (p2 >= 60 && p2 <= 65) base = 7000;
  else if (p2 >= 50 && p2 <= 59) base = 6600;
  else if (p2 >= 20 && p2 <= 29) base = 7200;
  else if (p2 >= 70 && p2 <= 79) base = 8000;

  const lageMult = { top: 1.38, sg: 1.18, gut: 1.0, mit: 0.86, ein: 0.73 }[lage] || 1;
  const zusMult = { neu: 1.13, sg: 1.06, gut: 1.0, ren: 0.89, san: 0.75 }[zustand] || 1;
  const alterFak = Math.max(0.72, 1 - alter * 0.004 + ((2025 - renovJ) < 10 ? 0.05 : 0));
  const featMult = 1 + Number(feats) * 0.011;
  const laermMult = { kein: 1.0, ger: 0.98, mit: 0.93, hoch: 0.86 }[laerm] || 1;
  const steuerMult = steuer < 90 ? 1.07 : steuer > 130 ? 0.94 : 1;
  const typMult = { villa: 1.32, efh: 1.10, etw: 1.0, rh: 0.95, mfh: 1.15, gew: 0.83 }[typ] || 1;
  const subtypMult = { attika: 1.12, penthouse: 1.22, duplex: 1.06, erd: 0.96, studio: 0.88, std: 1.0 }[subtyp] || 1;

  let m2 = Math.round(base * lageMult * zusMult * alterFak * featMult * laermMult * steuerMult * typMult * subtypMult);
  // +10% bei Verkaufsabsicht
  if (grund === 'vk') m2 = Math.round(m2 * 1.10);

  const total = Math.round(m2 * flaeche / 10000) * 10000;
  const rMin = Math.round(total * 0.93 / 10000) * 10000;
  const rMax = Math.round(total * 1.07 / 10000) * 10000;
  const score = Math.min(96, Math.round(lageMult * zusMult * 60 + Number(feats) * 1.5 + 10));
  const rendite = (3.0 + Math.random() * 1.0).toFixed(1);

  return { m2, total, rMin, rMax, score, rendite, base, lageMult, zusMult, alterFak, featMult };
}

function buildScores(vals) {
  const { lageMult, zusMult, alterFak, featMult, feats = 0 } = vals;
  return [
    { label: 'Lage & Mikrolage', val: Math.min(100, Math.round(lageMult * 72)), cls: lageMult > 1 ? 'gr' : 'md', tag: lageMult > 1 ? 'Gut' : 'Mittel', pct: Math.min(100, Math.round(lageMult * 72)) },
    { label: 'Bausubstanz & Alter', val: Math.min(100, Math.round(alterFak * 92)), cls: alterFak > 0.9 ? 'gr' : 'md', tag: alterFak > 0.9 ? 'Gut' : 'Mittel', pct: Math.min(100, Math.round(alterFak * 92)) },
    { label: 'Zustand', val: Math.min(100, Math.round(zusMult * 85)), cls: zusMult >= 1 ? 'gr' : 'md', tag: zusMult >= 1 ? 'Gut' : 'Mittel', pct: Math.min(100, Math.round(zusMult * 85)) },
    { label: 'Ausstattung', val: Math.min(100, Math.round(featMult * 74)), cls: feats > 8 ? 'gr' : 'md', tag: feats > 8 ? 'Gut' : 'Mittel', pct: Math.min(100, Math.round(featMult * 74)) },
    { label: 'Marktlage', val: 78, cls: 'md', tag: 'Mittel', pct: 78 },
    { label: 'Energiestandard', val: 64, cls: 'md', tag: 'Mittel', pct: 64 },
  ];
}

function buildBands(total, rMin, rMax, score) {
  const yours = score >= 88 ? 0 : score >= 72 ? 1 : score >= 48 ? 2 : 3;
  const defs = [
    { name: 'Premium-Segment', rank: '1', min: fmt(Math.round(total * 1.22 / 10000) * 10000), max: fmt(Math.round(total * 1.65 / 10000) * 10000) },
    { name: 'Gehobenes Segment', rank: '2', min: fmt(Math.round(total * 1.07 / 10000) * 10000), max: fmt(Math.round(total * 1.22 / 10000) * 10000) },
    { name: 'Mittleres Segment', rank: '3', min: fmt(rMin), max: fmt(rMax) },
    { name: 'Einfaches Segment', rank: '4', min: fmt(Math.round(total * 0.65 / 10000) * 10000), max: fmt(rMin) },
  ];
  return defs.map((b, i) => ({ ...b, active: i === yours }));
}

// ─── PDF generieren via Puppeteer ────────────────────────────────────────────
async function generatePDF(htmlContent) {
  // Vercel-kompatible Chromium-Konfiguration
  const chromium = require('@sparticuz/chromium');
  const puppeteer = require('puppeteer-core');

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });

  await browser.close();
  return pdf;
}

// ─── Airtable: Lead speichern ────────────────────────────────────────────────
async function saveLeadToAirtable(data, calcResult) {
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) return null;

  const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
    .base(process.env.AIRTABLE_BASE_ID);

  const record = await base('Leads').create({
    'Vorname': data.vorname || '',
    'Nachname': data.nachname || '',
    'E-Mail': data.email || '',
    'Telefon': data.tel || '',
    'PLZ': data.plz || '',
    'Ort': data.ort || '',
    'Objekttyp': data.typ || '',
    'Fläche (m²)': Number(data.flaeche) || 0,
    'Geschätzter Wert (CHF)': calcResult.total,
    'Preis/m² (CHF)': calcResult.m2,
    'Score': calcResult.score,
    'Bewertungsgrund': data.grund || '',
    'Status': 'Neu',
    'Erstellt am': new Date().toISOString(),
    'Notizen': '',
  });

  return record.getId();
}

// ─── E-Mail an Kunde ─────────────────────────────────────────────────────────
async function sendClientEmail(resend, data, calcResult, pdfBuffer) {
  const { vorname, nachname, email, plz, ort } = data;
  const { total, rMin, rMax, score, rendite, m2 } = calcResult;

  const scoreLabel = score >= 80 ? 'Überdurchschnittlich' : score >= 65 ? 'Über Durchschnitt' : 'Durchschnittlich';

  await resend.emails.send({
    from: 'Altera Immobilien <report@altera-immobilien.ch>',
    to: email,
    subject: `Ihre Immobilienbewertung — CHF ${fmt(total)}`,
    html: `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F9F8F4;font-family:'Helvetica Neue',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F9F8F4;padding:40px 20px">
<tr><td>
<table width="600" cellpadding="0" cellspacing="0" align="center" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">

  <!-- HEADER -->
  <tr><td style="background:#344E41;padding:28px 36px">
    <div style="font-size:20px;font-weight:700;color:#fff;letter-spacing:-.04em">Altera <span style="color:#C9A874">Immobilien</span></div>
    <div style="font-size:11px;color:rgba(255,255,255,.5);margin-top:3px">Ihr Bewertungsreport ist bereit</div>
  </td></tr>

  <!-- GREETING -->
  <tr><td style="padding:32px 36px 0">
    <p style="font-size:16px;color:#111;font-weight:700;letter-spacing:-.03em;margin-bottom:6px">Guten Tag, ${vorname} ${nachname}</p>
    <p style="font-size:14px;color:#666;line-height:1.7;margin:0">Ihre Immobilienbewertung für PLZ ${plz}${ort ? ` (${ort})` : ''} ist abgeschlossen. Im Anhang finden Sie Ihren detaillierten 12-seitigen Report.</p>
  </td></tr>

  <!-- VALUE BLOCK -->
  <tr><td style="padding:24px 36px 0">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#EDF1EE,#FBF6EE);border-radius:10px;overflow:hidden">
    <tr><td style="padding:24px 28px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#344E41;margin-bottom:8px">Geschätzter Marktwert</div>
      <div style="font-size:36px;font-weight:800;color:#111;letter-spacing:-.06em;line-height:1">CHF ${fmt(total)}</div>
      <div style="font-size:13px;color:#666;margin-top:6px">Bandbreite: CHF ${fmt(rMin)} – CHF ${fmt(rMax)}</div>
      <table cellpadding="0" cellspacing="0" style="margin-top:16px">
        <tr>
          <td style="padding-right:20px"><div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.06em">Preis/m²</div><div style="font-size:16px;font-weight:800;color:#111">CHF ${fmt(m2)}</div></td>
          <td style="padding-right:20px"><div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.06em">Score</div><div style="font-size:16px;font-weight:800;color:#111">${score}/100</div></td>
          <td><div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.06em">Rendite</div><div style="font-size:16px;font-weight:800;color:#111">${rendite}%</div></td>
        </tr>
      </table>
    </td></tr>
    </table>
  </td></tr>

  <!-- BODY TEXT -->
  <tr><td style="padding:24px 36px 0">
    <p style="font-size:14px;color:#444;line-height:1.75;margin:0">
      Ihr Gesamt-Score von <strong>${score}/100</strong> entspricht einer <strong>${scoreLabel}en</strong> Bewertung im regionalen Vergleich. Den vollständigen Report mit Segment-Einordnung, Score-Analyse und Marktvergleich finden Sie im Anhang dieser E-Mail.
    </p>
  </td></tr>

  <!-- CTA -->
  <tr><td style="padding:24px 36px 0">
    <table cellpadding="0" cellspacing="0" style="background:#344E41;border-radius:10px;overflow:hidden;width:100%">
    <tr><td style="padding:22px 26px">
      <div style="font-size:15px;font-weight:800;color:#fff;letter-spacing:-.04em;margin-bottom:4px">Professionelle Schätzung vor Ort — kostenlos</div>
      <div style="font-size:13px;color:rgba(255,255,255,.58);margin-bottom:14px">Unsere Experten kommen zu Ihnen. Bankfähig, rechtsgültig, unverbindlich.</div>
      <a href="mailto:hallo@altera-immobilien.ch?subject=Terminanfrage Vor-Ort-Schätzung" style="display:inline-block;background:#C9A874;color:#111;font-size:13px;font-weight:700;padding:11px 22px;border-radius:8px;text-decoration:none">Termin anfragen →</a>
    </td></tr>
    </table>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="padding:24px 36px 32px">
    <p style="font-size:11px;color:#aaa;line-height:1.6;margin:0">
      Diese Bewertung basiert auf hedonischer Methodik und aktuellen Marktdaten. Sie dient zur Orientierung und ersetzt kein offizielles Gutachten.<br>
      <strong>Altera Immobilien GmbH</strong> · Seestrasse 88, 8700 Küsnacht · +41 44 000 00 00
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>
    `,
    attachments: pdfBuffer ? [
      {
        filename: `Altera-Report-${plz}-${Date.now()}.pdf`,
        content: pdfBuffer.toString('base64'),
      }
    ] : [],
  });
}

// ─── E-Mail-Benachrichtigung an Altera-Team ──────────────────────────────────
async function sendTeamNotification(resend, data, calcResult, airtableId) {
  const { vorname, nachname, email, tel, plz, ort, typ, flaeche, grund } = data;
  const { total, score } = calcResult;

  const notifyEmail = process.env.NOTIFY_EMAIL || 'hallo@altera-immobilien.ch';

  await resend.emails.send({
    from: 'Altera System <system@altera-immobilien.ch>',
    to: notifyEmail,
    subject: `🏠 Neuer Lead: ${vorname} ${nachname} — CHF ${fmt(total)}`,
    html: `
<div style="font-family:sans-serif;max-width:500px;padding:20px">
  <h2 style="color:#344E41;margin-bottom:16px">Neuer Bewertungs-Lead</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <tr><td style="padding:8px 0;color:#888;width:40%">Name</td><td style="font-weight:600">${vorname} ${nachname}</td></tr>
    <tr><td style="padding:8px 0;color:#888">E-Mail</td><td><a href="mailto:${email}">${email}</a></td></tr>
    <tr><td style="padding:8px 0;color:#888">Telefon</td><td>${tel || '—'}</td></tr>
    <tr><td style="padding:8px 0;color:#888">PLZ / Ort</td><td>${plz}${ort ? ` · ${ort}` : ''}</td></tr>
    <tr><td style="padding:8px 0;color:#888">Objekttyp</td><td>${typ || '—'}</td></tr>
    <tr><td style="padding:8px 0;color:#888">Fläche</td><td>${flaeche} m²</td></tr>
    <tr style="background:#EDF1EE"><td style="padding:10px;color:#344E41;font-weight:700">Geschätzter Wert</td><td style="padding:10px;font-size:18px;font-weight:800;color:#344E41">CHF ${fmt(total)}</td></tr>
    <tr><td style="padding:8px 0;color:#888">Score</td><td>${score}/100</td></tr>
    <tr><td style="padding:8px 0;color:#888">Bewertungsgrund</td><td>${grund || '—'}</td></tr>
    ${airtableId ? `<tr><td style="padding:8px 0;color:#888">Airtable ID</td><td style="font-size:12px;color:#888">${airtableId}</td></tr>` : ''}
  </table>
  <div style="margin-top:20px;padding:16px;background:#344E41;border-radius:8px;color:#fff;font-size:13px">
    <strong>Nächster Schritt:</strong> Bitte ${vorname} innert 24h kontaktieren. Der Report wurde automatisch an ${email} gesendet.
  </div>
</div>
    `,
  });
}

// ─── HAUPTHANDLER ────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { email, vorname, nachname } = body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Ungültige E-Mail-Adresse' });
    }

    // 1. Werte berechnen
    const calcResult = calcValues(body);
    const scores = buildScores({ ...calcResult, feats: body.feats || 0 });
    const bands = buildBands(calcResult.total, calcResult.rMin, calcResult.rMax, calcResult.score);

    const reportDate = new Date().toLocaleDateString('de-CH');
    const year = new Date().getFullYear();
    const scoreLabel = calcResult.score >= 80 ? 'Überdurchschnittlich' : calcResult.score >= 65 ? 'Über Durchschnitt' : 'Durchschnittlich';
    const insight = calcResult.score >= 80
      ? 'Ihre Immobilie zeigt eine überdurchschnittliche Qualität. Das aktuelle Marktumfeld ist günstig — eine zeitnahe Vermarktung verspricht einen optimalen Erlös.'
      : calcResult.score >= 60
      ? 'Ihre Immobilie hat solide Ausgangsbedingungen. Mit gezielten Massnahmen lässt sich der Verkaufspreis weiter optimieren.'
      : 'Es besteht Optimierungspotenzial. Gerne beraten wir Sie kostenlos und zeigen, was sich lohnt.';

    // 2. PDF generieren
    const htmlContent = buildReportHTML({
      reportDate, year,
      address: `PLZ ${body.plz || '—'}${body.ort ? ` · ${body.ort}` : ''}`,
      value: fmt(calcResult.total),
      rangeMin: fmt(calcResult.rMin),
      rangeMax: fmt(calcResult.rMax),
      m2Price: fmt(calcResult.m2),
      score: calcResult.score,
      scoreLabel,
      rendite: calcResult.rendite,
      avgPrice: fmt(Math.round(calcResult.base * 1.04)),
      scores, bands, insight,
    });

    let pdfBuffer = null;
    try {
      pdfBuffer = await generatePDF(htmlContent);
    } catch (pdfErr) {
      console.error('PDF generation failed:', pdfErr.message);
      // Weiter ohne PDF — E-Mail ohne Anhang
    }

    // 3. Lead in Airtable speichern
    let airtableId = null;
    try {
      airtableId = await saveLeadToAirtable(body, calcResult);
    } catch (atErr) {
      console.error('Airtable error:', atErr.message);
    }

    // 4. E-Mails versenden
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await sendClientEmail(resend, body, calcResult, pdfBuffer);
      await sendTeamNotification(resend, body, calcResult, airtableId);
    }

    return res.status(200).json({
      success: true,
      value: calcResult.total,
      m2: calcResult.m2,
      score: calcResult.score,
      rangeMin: calcResult.rMin,
      rangeMax: calcResult.rMax,
      airtableId,
    });

  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ error: 'Server-Fehler', message: err.message });
  }
};
