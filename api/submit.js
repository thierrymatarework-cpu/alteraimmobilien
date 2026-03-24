// api/submit.js — Altera Immobilien
// Nutzt lib/marktdaten.js für vollständige Live-Bewertung

const { Resend }               = require('resend');
const Airtable                 = require('airtable');
const https                    = require('https');
const { analysiereImmobilie }  = require('../lib/marktdaten');
const { buildReportHTML, fmt } = require('../lib/pdfReport');

// ─── PDF via PDFShift ────────────────────────────────────────────────────────
async function generatePDF(html) {
  const apiKey = process.env.PDFSHIFT_API_KEY;
  if (!apiKey) { console.warn('PDFSHIFT_API_KEY fehlt'); return null; }

  return new Promise(resolve => {
    const body = JSON.stringify({
      source: html, margin: '0', format: 'A4', use_print: true,
    });
    const auth = Buffer.from(`api:${apiKey}`).toString('base64');
    const req  = https.request({
      hostname: 'api.pdfshift.io', path: '/v3/convert/pdf', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log('PDFShift OK:', Math.round(buf.length/1024), 'KB');
          resolve(buf);
        } else {
          console.error('PDFShift Fehler:', res.statusCode, buf.toString().substring(0,200));
          resolve(null);
        }
      });
    });
    req.on('error', err => { console.error('PDFShift:', err.message); resolve(null); });
    req.setTimeout(30000, () => { req.destroy(); resolve(null); });
    req.write(body); req.end();
  });
}

// ─── Airtable ────────────────────────────────────────────────────────────────
async function saveToAirtable(data, result) {
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) return null;
  try {
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
                   .base(process.env.AIRTABLE_BASE_ID);
    const rec = await base(process.env.AIRTABLE_TABLE_LEADS || 'Leads').create({
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
    console.log('Airtable:', rec.getId());
    return rec.getId();
  } catch(err) {
    console.error('Airtable:', err.message);
    return null;
  }
}

// ─── E-Mail Kunde ─────────────────────────────────────────────────────────────
async function sendClientEmail(resend, data, result, pdfBuffer) {
  const { vorname, email, plz, ort, strasse } = data;
  const { total, rMin, rMax, score, scoreLabel, m2, ren, vermarktungDauer, vergleichsObjekte, distBahnhofM, distSeeM, steuerfuss, risikoFlags } = result;
  const addr = [strasse, [plz, ort].filter(Boolean).join(' ')].filter(Boolean).join(', ') || 'Ihre Immobilie';

  const positiveFlags = (risikoFlags||[]).filter(f=>f.typ==='positiv').map(f=>`<li style="margin-bottom:3px">${f.text}</li>`).join('');
  const warnFlags     = (risikoFlags||[]).filter(f=>f.typ==='warnung').map(f=>`<li style="margin-bottom:3px;color:#8A2828">${f.text}</li>`).join('');

  const infoBadges = [
    distBahnhofM ? `🚉 ${Math.round(distBahnhofM/100)/10} km zum Bahnhof` : null,
    distSeeM && distSeeM < 3000 ? `💧 ${Math.round(distSeeM)} m zum See` : null,
    steuerfuss ? `📊 Steuerfuss ${steuerfuss}%` : null,
    `⏱ Ø ${vermarktungDauer} Tage Vermarktung`,
  ].filter(Boolean).map(b=>`<span style="background:#EDF1EE;color:#344E41;font-size:10px;font-weight:600;padding:3px 8px;border-radius:4px;margin-right:4px;margin-bottom:4px;display:inline-block">${b}</span>`).join('');

  const attachments = pdfBuffer ? [{
    filename:    `Altera-Bewertungsreport-${plz}.pdf`,
    content:     pdfBuffer.toString('base64'),
    contentType: 'application/pdf',
  }] : [];

  await resend.emails.send({
    from: 'Altera Immobilien <onboarding@resend.dev>',
    to:   email,
    subject: `Ihre Immobilienbewertung — CHF ${fmt(total)}`,
    attachments,
    html: `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F9F8F4;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px">
<table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">

  <tr><td style="background:#344E41;padding:20px 28px">
    <div style="font-size:18px;font-weight:700;color:#fff;font-family:Arial">Altera <span style="color:#C9A874">Immobilien</span></div>
    <div style="font-size:10px;color:rgba(255,255,255,.45);margin-top:2px">Ihre persönliche Bewertung ist fertig</div>
  </td></tr>

  <tr><td style="padding:24px 28px 0">
    <p style="font-size:14px;font-weight:700;color:#111;margin:0 0 6px">Guten Tag${vorname ? `, ${vorname}` : ''}</p>
    <p style="font-size:12px;color:#666;line-height:1.65;margin:0">
      Ihre Bewertung für <strong style="color:#111">${addr}</strong> ist bereit.
      ${pdfBuffer ? 'Den vollständigen <strong>3-seitigen PDF-Report</strong> finden Sie im Anhang.' : ''}
    </p>
  </td></tr>

  <tr><td style="padding:16px 28px 0">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#EDF1EE,#FBF6EE);border-radius:8px">
    <tr><td style="padding:18px 22px">
      <div style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#344E41;margin-bottom:4px">Geschätzter Marktwert</div>
      <div style="font-size:34px;font-weight:800;color:#111;letter-spacing:-.05em;line-height:1">CHF ${fmt(total)}</div>
      <div style="font-size:11px;color:#666;margin-top:5px">CHF ${fmt(rMin)} – CHF ${fmt(rMax)}</div>
      <table style="margin-top:12px;border-collapse:collapse"><tr>
        <td style="padding-right:16px"><div style="font-size:7px;color:#888;text-transform:uppercase;letter-spacing:.05em">Preis/m²</div><div style="font-size:15px;font-weight:800;color:#111">CHF ${fmt(m2)}</div></td>
        <td style="padding-right:16px"><div style="font-size:7px;color:#888;text-transform:uppercase;letter-spacing:.05em">Score</div><div style="font-size:15px;font-weight:800;color:#111">${score}/100</div></td>
        <td><div style="font-size:7px;color:#888;text-transform:uppercase;letter-spacing:.05em">Rendite p.a.</div><div style="font-size:15px;font-weight:800;color:#344E41">${ren}%</div></td>
      </tr></table>
      <div style="margin-top:10px">${infoBadges}</div>
    </td></tr></table>
  </td></tr>

  ${positiveFlags ? `<tr><td style="padding:12px 28px 0">
    <div style="font-size:10px;font-weight:700;color:#1B6B3E;margin-bottom:4px">✓ Positive Faktoren</div>
    <ul style="font-size:11px;color:#444;margin:0;padding-left:16px;line-height:1.6">${positiveFlags}</ul>
  </td></tr>` : ''}

  ${warnFlags ? `<tr><td style="padding:12px 28px 0">
    <div style="font-size:10px;font-weight:700;color:#8A2828;margin-bottom:4px">⚠ Hinweise</div>
    <ul style="font-size:11px;margin:0;padding-left:16px;line-height:1.6">${warnFlags}</ul>
  </td></tr>` : ''}

  ${pdfBuffer ? `<tr><td style="padding:12px 28px 0">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#EDF1EE;border:1.5px solid #D0DDD4;border-radius:7px">
    <tr><td style="padding:11px 14px">
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:18px;padding-right:10px">📎</td>
        <td><div style="font-size:11px;font-weight:700;color:#344E41">PDF-Report im Anhang</div>
        <div style="font-size:10px;color:#555">3 Seiten · Objektdaten · Score-Analyse · Marktvergleich · Einschätzung</div></td>
      </tr></table>
    </td></tr></table>
  </td></tr>` : ''}

  <tr><td style="padding:12px 28px 0">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#344E41;border-radius:8px">
    <tr><td style="padding:16px 20px">
      <div style="font-size:12px;font-weight:700;color:#fff;margin-bottom:4px">Professionelle Schätzung vor Ort</div>
      <div style="font-size:10px;color:rgba(255,255,255,.6);margin-bottom:12px;line-height:1.55">Thierry oder Janis kommen persönlich zu Ihnen. Bankfähig, unverbindlich.</div>
      <a href="mailto:hallo@altera-immobilien.ch?subject=Terminanfrage" style="display:inline-block;background:#C9A874;color:#111;font-size:11px;font-weight:700;padding:9px 18px;border-radius:6px;text-decoration:none">Termin anfragen →</a>
    </td></tr></table>
  </td></tr>

  <tr><td style="padding:18px 28px 22px">
    <p style="font-size:9px;color:#aaa;line-height:1.55;margin:0">
      Altera Immobilien GmbH · Seestrasse 88, 8700 Küsnacht<br>
      Dataquellen: ${(result.dataquellen||[]).join(' · ')}<br>
      Diese Bewertung dient zur Orientierung. Kein offizielles Gutachten.
    </p>
  </td></tr>

</table></td></tr></table>
</body></html>`,
  });
  console.log('E-Mail Kunde:', email, pdfBuffer ? '+PDF' : 'ohne PDF');
}

// ─── E-Mail Team ──────────────────────────────────────────────────────────────
async function sendTeamEmail(resend, data, result, airtableId) {
  const { total, rMin, rMax, score, scoreLabel, m2, vermarktungDauer, vergleichsObjekte, distBahnhofM, distSeeM, steuerfuss, risikoFlags, dataquellen } = result;

  await resend.emails.send({
    from: 'Altera System <onboarding@resend.dev>',
    to:   process.env.NOTIFY_EMAIL || 'hallo@altera-immobilien.ch',
    subject: `🏠 ${data.vorname||''} ${data.nachname||''} — CHF ${fmt(total)} · Score ${score}`,
    html: `<div style="font-family:Arial;max-width:520px;padding:20px">
      <div style="font-size:18px;font-weight:700;color:#344E41;margin-bottom:16px">Altera <span style="color:#C9A874">Immobilien</span> · Neuer Lead</div>
      <table style="font-size:12px;border-collapse:collapse;width:100%">
        <tr><td style="padding:6px 0;color:#888;width:38%;border-bottom:1px solid #f0f0ea">Name</td><td style="font-weight:700;border-bottom:1px solid #f0f0ea">${data.vorname||''} ${data.nachname||''}</td></tr>
        <tr><td style="padding:6px 0;color:#888;border-bottom:1px solid #f0f0ea">E-Mail</td><td style="border-bottom:1px solid #f0f0ea"><a href="mailto:${data.email}" style="color:#344E41">${data.email}</a></td></tr>
        <tr><td style="padding:6px 0;color:#888;border-bottom:1px solid #f0f0ea">Telefon</td><td style="border-bottom:1px solid #f0f0ea">${data.tel||'—'}</td></tr>
        <tr><td style="padding:6px 0;color:#888;border-bottom:1px solid #f0f0ea">Adresse</td><td style="border-bottom:1px solid #f0f0ea">${data.strasse||''} · ${data.plz||''} ${data.ort||''}</td></tr>
        <tr><td style="padding:6px 0;color:#888;border-bottom:1px solid #f0f0ea">Objekt</td><td style="border-bottom:1px solid #f0f0ea">${data.typ||'—'} · ${data.flaeche||'—'} m² · ${data.zimmer||'—'} Zi.</td></tr>
        <tr><td style="padding:6px 0;color:#888;border-bottom:1px solid #f0f0ea">Grund</td><td style="border-bottom:1px solid #f0f0ea">${data.grund||'—'}</td></tr>
        ${distBahnhofM ? `<tr><td style="padding:6px 0;color:#888;border-bottom:1px solid #f0f0ea">Bahnhof</td><td style="border-bottom:1px solid #f0f0ea">${Math.round(distBahnhofM)} m${result.bahnhofName?' · '+result.bahnhofName:''}</td></tr>` : ''}
        ${distSeeM ? `<tr><td style="padding:6px 0;color:#888;border-bottom:1px solid #f0f0ea">See</td><td style="border-bottom:1px solid #f0f0ea">${Math.round(distSeeM)} m</td></tr>` : ''}
        ${steuerfuss ? `<tr><td style="padding:6px 0;color:#888;border-bottom:1px solid #f0f0ea">Steuerfuss</td><td style="border-bottom:1px solid #f0f0ea">${steuerfuss}%</td></tr>` : ''}
      </table>
      <div style="background:#EDF1EE;border-radius:7px;padding:14px 18px;margin-top:14px">
        <div style="font-size:28px;font-weight:800;color:#344E41;letter-spacing:-.05em">CHF ${fmt(total)}</div>
        <div style="font-size:11px;color:#666;margin-top:3px">CHF ${fmt(rMin)} – CHF ${fmt(rMax)} · Score ${score}/100 · ${scoreLabel}</div>
        <div style="font-size:10px;color:#888;margin-top:3px">${m2} CHF/m² · ${vermarktungDauer} Tage · ${vergleichsObjekte} Vergl.-Obj. · ${result.radiusKm||5} km Radius</div>
        ${airtableId ? `<div style="font-size:9px;color:#aaa;margin-top:5px">Airtable: ${airtableId}</div>` : ''}
      </div>
      ${(risikoFlags||[]).length > 0 ? `<div style="font-size:10px;color:#888;margin-top:10px"><strong>Flags:</strong> ${risikoFlags.map(f=>`${f.kat}: ${f.text}`).join(' | ')}</div>` : ''}
      <div style="font-size:9px;color:#aaa;margin-top:8px">Quellen: ${(dataquellen||[]).join(' · ')}</div>
    </div>`,
  });
  console.log('Team E-Mail gesendet');
}

// ─── Haupthandler ─────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: 'Ungültiges JSON' }); }

  if (!body.email?.includes('@')) return res.status(400).json({ error: 'Ungültige E-Mail' });

  console.log('Submit:', body.email, body.plz, body.ort);

  // 1. Vollständige Live-Analyse
  const result = await analysiereImmobilie(body);
  console.log(`Marktwert: CHF ${fmt(result.total)} | Score: ${result.score} | ${result.vermarktungDauer} Tage | ${result.vergleichsObjekte} Obj.`);

  // 2. PDF
  let pdfBuffer = null;
  try {
    pdfBuffer = await generatePDF(buildReportHTML(body, result));
  } catch(err) { console.error('PDF:', err.message); }

  // 3. Airtable
  const airtableId = await saveToAirtable(body, result);

  // 4. E-Mails
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await sendClientEmail(resend, body, result, pdfBuffer);
    await sendTeamEmail(resend, body, result, airtableId);
  }

  // 5. Response an Frontend (für Live-Update der Anzeige)
  return res.status(200).json({
    success:          true,
    value:            result.total,
    score:            result.score,
    m2:               result.m2,
    vermarktungDauer: result.vermarktungDauer,
    vergleichsObjekte:result.vergleichsObjekte,
    nachfrageFaktor:  result.nachfrageFaktor,
    radiusKm:         result.radiusKm,
    distBahnhofM:     result.distBahnhofM,
    distSeeM:         result.distSeeM,
    steuerfuss:       result.steuerfuss,
    risikoFlags:      result.risikoFlags,
    dataquellen:      result.dataquellen,
  });
};
