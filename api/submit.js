// api/submit.js — Altera Immobilien
// Empfängt Bewertungsdaten → Airtable → E-Mail an Kunde → E-Mail an Team

const { Resend } = require('resend');
const Airtable   = require('airtable');

// ─── Hilfsfunktionen ───────────────────────────────────────────────────────

function fmt(n) {
  return Number(n).toLocaleString('de-CH');
}

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

  const lm = ({ top:1.38, sg:1.18, gut:1.0, mit:0.86, ein:0.73  }[data.lage]    || 1.0);
  const zm = ({ neu:1.13, sg:1.06, gut:1.0, ren:0.89, san:0.75  }[data.zustand] || 1.0);
  const tm = ({ villa:1.32, efh:1.10, etw:1.0, rh:0.95, mfh:1.15, gew:0.83 }[data.typ] || 1.0);
  const sm = ({ attika:1.12, penthouse:1.22, duplex:1.06, erd:0.96, studio:0.88, std:1.0 }[data.subtyp] || 1.0);
  const lam = ({ kein:1.0, ger:0.98, mit:0.93, hoch:0.86 }[data.laerm] || 1.0);

  const af  = Math.max(0.72, 1 - alter * 0.004 + ((2025 - renov) < 10 ? 0.05 : 0));
  const fm  = 1 + (Number(data.feats) || 0) * 0.011;
  const stm = (Number(data.steuer) || 100) < 90 ? 1.07 : (Number(data.steuer) || 100) > 130 ? 0.94 : 1;

  let m2 = Math.round(base * lm * zm * af * fm * lam * stm * tm * sm);
  if (data.grund === 'vk') m2 = Math.round(m2 * 1.10); // +10% bei Verkaufsabsicht

  const total = Math.round(m2 * fl / 10000) * 10000;
  const rMin  = Math.round(total * 0.93 / 10000) * 10000;
  const rMax  = Math.round(total * 1.07 / 10000) * 10000;
  const score = Math.min(96, Math.round(lm * zm * 60 + (Number(data.feats) || 0) * 1.5 + 10));

  return { m2, total, rMin, rMax, score, base };
}

// ─── Airtable: Lead speichern ──────────────────────────────────────────────

async function saveToAirtable(data, result) {
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
    console.log('Airtable: Keys fehlen, übersprungen');
    return null;
  }
  try {
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
      .base(process.env.AIRTABLE_BASE_ID);

    const record = await base('Leads').create({
      'Vorname':               data.vorname  || '',
      'Nachname':              data.nachname || '',
      'E-Mail':                data.email    || '',
      'Telefon':               data.tel      || '',
      'PLZ':                   data.plz      || '',
      'Ort':                   data.ort      || '',
      'Objekttyp':             data.typ      || '',
      'Flaeche m2':            Number(data.flaeche) || 0,
      'Geschaetzter Wert CHF': result.total,
      'Score':                 result.score,
      'Bewertungsgrund':       data.grund    || '',
      'Status':                'Neu',
      'Erstellt am':           new Date().toISOString(),
    });
    console.log('Airtable: Lead gespeichert', record.getId());
    return record.getId();
  } catch (err) {
    console.error('Airtable Fehler:', err.message);
    return null;
  }
}

// ─── E-Mail an Kunden ──────────────────────────────────────────────────────

async function sendClientEmail(resend, data, result) {
  const { vorname, nachname, email, plz, ort } = data;
  const { total, rMin, rMax, score, m2 } = result;
  const scoreLabel = score >= 80 ? 'Überdurchschnittlich' : score >= 65 ? 'Über Durchschnitt' : 'Durchschnittlich';

  const { error } = await resend.emails.send({
    from:    'Altera Immobilien <onboarding@resend.dev>',
    to:      email,
    subject: `Ihre Immobilienbewertung — CHF ${fmt(total)}`,
    html: `
<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F9F8F4;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:32px 16px">
<table width="580" cellpadding="0" cellspacing="0" align="center" style="background:#fff;border-radius:12px;overflow:hidden">

  <tr><td style="background:#344E41;padding:28px 36px">
    <div style="font-size:20px;font-weight:700;color:#fff">Altera <span style="color:#C9A874">Immobilien</span></div>
    <div style="font-size:12px;color:rgba(255,255,255,.5);margin-top:4px">Ihre persönliche Bewertung</div>
  </td></tr>

  <tr><td style="padding:32px 36px 0">
    <p style="font-size:16px;font-weight:700;color:#111;margin:0 0 8px">Guten Tag${vorname ? `, ${vorname}` : ''}</p>
    <p style="font-size:14px;color:#666;line-height:1.7;margin:0">
      Ihre Immobilienbewertung für <strong>PLZ ${plz}${ort ? ` · ${ort}` : ''}</strong> ist fertig.
    </p>
  </td></tr>

  <tr><td style="padding:24px 36px 0">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#EDF1EE;border-radius:10px">
    <tr><td style="padding:24px 28px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#344E41;margin-bottom:6px">Geschätzter Marktwert</div>
      <div style="font-size:40px;font-weight:800;color:#111;letter-spacing:-.04em;line-height:1">CHF ${fmt(total)}</div>
      <div style="font-size:13px;color:#666;margin-top:6px">Bandbreite: CHF ${fmt(rMin)} – CHF ${fmt(rMax)}</div>
      <table cellpadding="0" cellspacing="0" style="margin-top:16px">
        <tr>
          <td style="padding-right:24px">
            <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.06em">Preis/m²</div>
            <div style="font-size:18px;font-weight:800;color:#111">CHF ${fmt(m2)}</div>
          </td>
          <td style="padding-right:24px">
            <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.06em">Score</div>
            <div style="font-size:18px;font-weight:800;color:#111">${score}/100</div>
          </td>
          <td>
            <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.06em">Einschätzung</div>
            <div style="font-size:14px;font-weight:700;color:#344E41">${scoreLabel}</div>
          </td>
        </tr>
      </table>
    </td></tr></table>
  </td></tr>

  <tr><td style="padding:24px 36px 0">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#344E41;border-radius:10px">
    <tr><td style="padding:22px 26px">
      <div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:6px">Professionelle Schätzung vor Ort — kostenlos</div>
      <div style="font-size:13px;color:rgba(255,255,255,.6);margin-bottom:14px">Thierry oder Janis kommen persönlich zu Ihnen. Bankfähig, unverbindlich.</div>
      <a href="mailto:hallo@altera-immobilien.ch?subject=Terminanfrage"
         style="display:inline-block;background:#C9A874;color:#111;font-size:13px;font-weight:700;padding:10px 20px;border-radius:8px;text-decoration:none">
        Termin anfragen →
      </a>
    </td></tr></table>
  </td></tr>

  <tr><td style="padding:24px 36px 28px">
    <p style="font-size:11px;color:#aaa;line-height:1.6;margin:0">
      Altera Immobilien GmbH · Seestrasse 88, 8700 Küsnacht · +41 44 000 00 00<br>
      Diese Bewertung dient zur Orientierung und ersetzt kein offizielles Gutachten.
    </p>
  </td></tr>

</table>
</td></tr></table>
</body></html>
    `,
  });

  if (error) {
    console.error('Resend Kunde Fehler:', JSON.stringify(error));
  } else {
    console.log('E-Mail an Kunde gesendet:', email);
  }
}

// ─── E-Mail ans Team ───────────────────────────────────────────────────────

async function sendTeamEmail(resend, data, result, airtableId) {
  const notifyEmail = process.env.NOTIFY_EMAIL || 'hallo@altera-immobilien.ch';
  const { vorname, nachname, email, tel, plz, ort, typ, flaeche, grund } = data;
  const { total, score } = result;

  const { error } = await resend.emails.send({
    from:    'Altera System <onboarding@resend.dev>',
    to:      notifyEmail,
    subject: `Neuer Lead: ${vorname || ''} ${nachname || ''} — CHF ${fmt(total)}`,
    html: `
<div style="font-family:Arial,sans-serif;max-width:500px;padding:20px">
  <h2 style="color:#344E41;margin:0 0 20px">Neuer Bewertungs-Lead</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <tr><td style="padding:8px 0;color:#888;width:40%">Name</td>
        <td style="font-weight:700">${vorname || ''} ${nachname || ''}</td></tr>
    <tr><td style="padding:8px 0;color:#888">E-Mail</td>
        <td><a href="mailto:${email}">${email}</a></td></tr>
    <tr><td style="padding:8px 0;color:#888">Telefon</td>
        <td>${tel || '—'}</td></tr>
    <tr><td style="padding:8px 0;color:#888">PLZ / Ort</td>
        <td>${plz || '—'}${ort ? ' · ' + ort : ''}</td></tr>
    <tr><td style="padding:8px 0;color:#888">Objekttyp</td>
        <td>${typ || '—'}</td></tr>
    <tr><td style="padding:8px 0;color:#888">Fläche</td>
        <td>${flaeche || '—'} m²</td></tr>
    <tr><td style="padding:8px 0;color:#888">Bewertungsgrund</td>
        <td>${grund || '—'}</td></tr>
    <tr style="background:#EDF1EE">
      <td style="padding:12px 8px;font-weight:700;color:#344E41">Geschätzter Wert</td>
      <td style="padding:12px 8px;font-size:20px;font-weight:800;color:#344E41">CHF ${fmt(total)}</td>
    </tr>
    <tr><td style="padding:8px 0;color:#888">Score</td>
        <td>${score}/100</td></tr>
    ${airtableId ? `<tr><td style="padding:8px 0;color:#888">Airtable</td><td style="font-size:11px;color:#aaa">${airtableId}</td></tr>` : ''}
  </table>
  <div style="margin-top:20px;padding:16px;background:#344E41;border-radius:8px;color:#fff;font-size:13px">
    <strong>Nächster Schritt:</strong> ${vorname || 'Kunde'} innert 24h kontaktieren.
    Bewertungs-E-Mail wurde automatisch an <strong>${email}</strong> gesendet.
  </div>
</div>
    `,
  });

  if (error) {
    console.error('Resend Team Fehler:', JSON.stringify(error));
  } else {
    console.log('Team-E-Mail gesendet an:', notifyEmail);
  }
}

// ─── Haupthandler ──────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Ungültiges JSON' });
  }

  // E-Mail Pflichtfeld
  if (!body.email || !body.email.includes('@')) {
    return res.status(400).json({ error: 'Ungültige E-Mail' });
  }

  console.log('Submit empfangen:', body.email, body.plz);

  // 1. Werte berechnen
  const result = calcValues(body);
  console.log('Berechnet:', result);

  // 2. Airtable
  const airtableId = await saveToAirtable(body, result);

  // 3. E-Mails — nur wenn Resend Key vorhanden
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await sendClientEmail(resend, body, result);
    await sendTeamEmail(resend, body, result, airtableId);
  } else {
    console.log('RESEND_API_KEY fehlt — E-Mails übersprungen');
  }

  return res.status(200).json({
    success: true,
    value:   result.total,
    m2:      result.m2,
    score:   result.score,
    rangeMin: result.rMin,
    rangeMax: result.rMax,
  });
};
