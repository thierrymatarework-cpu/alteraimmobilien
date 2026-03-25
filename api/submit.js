// api/submit.js — Altera Immobilien
// Response SOFORT → danach Email + Airtable im Background

const { Resend }              = require('resend');
const Airtable                = require('airtable');
const https                   = require('https');
const { analysiereImmobilie } = require('../lib/marktdaten');
const { bewerteWithAgent }    = require('../lib/bewertungsAgent');
const { buildReportHTML, fmt }= require('../lib/pdfReport');

// ─── PDF via PDFShift ─────────────────────────────────────────────────────────
async function generatePDF(html) {
  const key = process.env.PDFSHIFT_API_KEY;
  if (!key) return null;
  return new Promise(resolve => {
    const body = JSON.stringify({ source: html, margin: '0', format: 'A4', use_print: true });
    const auth = Buffer.from(`api:${key}`).toString('base64');
    const req = https.request({
      hostname: 'api.pdfshift.io', path: '/v3/convert/pdf', method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':`Basic ${auth}`, 'Content-Length':Buffer.byteLength(body) },
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log(`PDF OK: ${Math.round(buf.length/1024)}KB`);
          resolve(buf);
        } else {
          console.error('PDFShift:', res.statusCode, buf.toString().substring(0,150));
          resolve(null);
        }
      });
    });
    req.on('error', e => { console.error('PDF error:', e.message); resolve(null); });
    req.setTimeout(30000, () => { req.destroy(); resolve(null); });
    req.write(body); req.end();
  });
}

// ─── Airtable ─────────────────────────────────────────────────────────────────
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
      'Wert CHF':   result.total  || 0,
      'Score':      result.score  || 0,
      'Grund':      data.grund    || '',
      'Status':     'Neu',
    });
    console.log('Airtable:', rec.getId());
    return rec.getId();
  } catch(err) {
    console.error('Airtable:', err.message); return null;
  }
}

// ─── E-Mail HTML Builder ───────────────────────────────────────────────────────
function buildClientEmailHTML(data, result, hasPdf) {
  const { vorname, email, plz, ort, strasse } = data;
  const { total, rMin, rMax, score, m2, ren, vermarktungDauer, vergleichsObjekte,
          distBahnhofM, distSeeM, steuerfuss, risikoFlags, einschaetzung, vergleichsInserate } = result;
  const addr = [strasse, [plz, ort].filter(Boolean).join(' ')].filter(Boolean).join(', ') || 'Ihre Immobilie';

  const pos = (risikoFlags||[]).filter(f=>f.typ==='positiv').map(f=>`<li>${f.text}</li>`).join('');
  const warn= (risikoFlags||[]).filter(f=>f.typ==='warnung').map(f=>`<li style="color:#8A2828">${f.text}</li>`).join('');
  const ins = (vergleichsInserate||[]).slice(0,3).map(v=>
    `<tr><td style="padding:5px 8px;font-size:11px;color:#333">${v.beschreibung||'—'}</td>
     <td style="padding:5px 8px;font-size:11px;font-weight:700;color:#111;text-align:right">CHF ${(Number(v.preis)||0).toLocaleString('de-CH')}</td>
     <td style="padding:5px 8px;font-size:11px;color:#344E41;text-align:right">${v.preisM2?`${v.preisM2}/m²`:'—'}</td></tr>`
  ).join('');

  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F9F8F4;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden">

<tr><td style="background:#344E41;padding:20px 28px">
  <div style="font-size:18px;font-weight:700;color:#fff">Altera <span style="color:#C9A874">Immobilien</span></div>
  <div style="font-size:10px;color:rgba(255,255,255,.5);margin-top:2px">Ihre persönliche Immobilienbewertung</div>
</td></tr>

<tr><td style="padding:24px 28px">
  <p style="font-size:15px;font-weight:700;color:#111;margin:0 0 6px">Guten Tag${vorname?`, ${vorname}`:''},</p>
  <p style="font-size:13px;color:#555;line-height:1.7;margin:0">
    Ihre Bewertung für <strong style="color:#111">${addr}</strong> ist fertig.
    ${hasPdf?'Den vollständigen <strong>PDF-Report</strong> finden Sie im Anhang.':''}
  </p>
</td></tr>

<tr><td style="padding:0 28px 20px">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#EDF1EE,#FBF6EE);border-radius:10px">
  <tr><td style="padding:20px 22px">
    <div style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#344E41;margin-bottom:4px">Geschätzter Marktwert</div>
    <div style="font-size:36px;font-weight:800;color:#111;letter-spacing:-.05em;line-height:1">CHF ${fmt(total)}</div>
    <div style="font-size:11px;color:#666;margin-top:5px">Bandbreite: CHF ${fmt(rMin)} – CHF ${fmt(rMax)}</div>
    <table style="margin-top:14px;border-collapse:collapse"><tr>
      <td style="padding-right:20px">
        <div style="font-size:7px;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Preis / m²</div>
        <div style="font-size:16px;font-weight:800;color:#111">CHF ${fmt(m2)}</div>
      </td>
      <td style="padding-right:20px">
        <div style="font-size:7px;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Score</div>
        <div style="font-size:16px;font-weight:800;color:#111">${score}/100</div>
      </td>
      <td style="padding-right:20px">
        <div style="font-size:7px;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Rendite p.a.</div>
        <div style="font-size:16px;font-weight:800;color:#344E41">${ren}%</div>
      </td>
      <td>
        <div style="font-size:7px;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Vermarktung</div>
        <div style="font-size:16px;font-weight:800;color:#111">${vermarktungDauer} Tage</div>
      </td>
    </tr></table>
    ${steuerfuss?`<div style="margin-top:10px;font-size:10px;background:rgba(255,255,255,.6);display:inline-block;padding:3px 9px;border-radius:4px;color:#344E41;font-weight:600">Steuerfuss ${steuerfuss}%${distSeeM&&distSeeM<1000?` · See ${distSeeM}m`:''}</div>`:''}
  </td></tr></table>
</td></tr>

${pos?`<tr><td style="padding:0 28px 16px">
  <div style="font-size:10px;font-weight:700;color:#1B6B3E;margin-bottom:5px">Positive Faktoren</div>
  <ul style="font-size:12px;color:#333;margin:0;padding-left:16px;line-height:1.7">${pos}</ul>
</td></tr>`:''}

${warn?`<tr><td style="padding:0 28px 16px">
  <div style="font-size:10px;font-weight:700;color:#8A2828;margin-bottom:5px">Hinweise</div>
  <ul style="font-size:12px;margin:0;padding-left:16px;line-height:1.7">${warn}</ul>
</td></tr>`:''}

${einschaetzung?`<tr><td style="padding:0 28px 16px">
  <div style="background:#EDF1EE;border-left:3px solid #344E41;border-radius:0 8px 8px 0;padding:12px 16px">
    <div style="font-size:10px;font-weight:700;color:#344E41;margin-bottom:4px">Altera-Einschätzung</div>
    <div style="font-size:12px;color:#333;line-height:1.6">${einschaetzung}</div>
  </div>
</td></tr>`:''}

${ins?`<tr><td style="padding:0 28px 16px">
  <div style="font-size:10px;font-weight:700;color:#666;margin-bottom:8px">Vergleichsinserate aus Ihrer Region</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #EAEAE4;border-radius:8px;overflow:hidden">
    <tr style="background:#EDF1EE">
      <td style="padding:6px 8px;font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#344E41">Objekt</td>
      <td style="padding:6px 8px;font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#344E41;text-align:right">Preis</td>
      <td style="padding:6px 8px;font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#344E41;text-align:right">CHF/m²</td>
    </tr>
    ${ins}
  </table>
</td></tr>`:''}

<tr><td style="padding:0 28px 20px">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#344E41;border-radius:10px">
  <tr><td style="padding:18px 22px">
    <div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:4px">Persönliche Schätzung vor Ort — kostenlos</div>
    <div style="font-size:11px;color:rgba(255,255,255,.6);margin-bottom:14px;line-height:1.5">Thierry oder Janis kommen persönlich zu Ihnen. Bankfähig, unverbindlich.</div>
    <a href="mailto:hallo@altera-immobilien.ch?subject=Terminanfrage" style="display:inline-block;background:#C9A874;color:#111;font-size:12px;font-weight:700;padding:10px 20px;border-radius:7px;text-decoration:none">Termin anfragen</a>
  </td></tr></table>
</td></tr>

<tr><td style="padding:16px 28px;border-top:1px solid #f0f0ea">
  <p style="font-size:9px;color:#aaa;line-height:1.6;margin:0">
    Altera Immobilien GmbH · Seestrasse 88, 8700 Küsnacht · Diese Bewertung dient zur Orientierung.
  </p>
</td></tr>

</table></td></tr></table>
</body></html>`;
}

function buildTeamEmailHTML(data, result, airtableId) {
  const { total, rMin, rMax, score, scoreLabel, m2, vermarktungDauer, vergleichsObjekte,
          distBahnhofM, distSeeM, steuerfuss, risikoFlags, quelle, dataquellen } = result;
  return `<div style="font-family:Arial;max-width:540px;padding:20px">
    <div style="font-size:18px;font-weight:700;color:#344E41;margin-bottom:14px">Altera <span style="color:#C9A874">Immobilien</span> · Neuer Lead</div>
    <div style="font-size:11px;color:#888;margin-bottom:4px">Quelle: ${quelle||'—'}</div>
    <table style="font-size:13px;border-collapse:collapse;width:100%;margin-bottom:14px">
      <tr><td style="padding:6px 0;color:#888;width:36%;border-bottom:1px solid #f0f0ea">Name</td><td style="border-bottom:1px solid #f0f0ea;font-weight:700">${data.vorname||''} ${data.nachname||''}</td></tr>
      <tr><td style="padding:6px 0;color:#888;border-bottom:1px solid #f0f0ea">E-Mail</td><td style="border-bottom:1px solid #f0f0ea"><a href="mailto:${data.email}">${data.email}</a></td></tr>
      <tr><td style="padding:6px 0;color:#888;border-bottom:1px solid #f0f0ea">Telefon</td><td style="border-bottom:1px solid #f0f0ea">${data.tel||'—'}</td></tr>
      <tr><td style="padding:6px 0;color:#888;border-bottom:1px solid #f0f0ea">Adresse</td><td style="border-bottom:1px solid #f0f0ea">${data.strasse||''} · ${data.plz||''} ${data.ort||''}</td></tr>
      <tr><td style="padding:6px 0;color:#888;border-bottom:1px solid #f0f0ea">Objekt</td><td style="border-bottom:1px solid #f0f0ea">${data.typ||'—'} · ${data.flaeche||'—'} m² · ${data.zimmer||'—'} Zi.</td></tr>
      <tr><td style="padding:6px 0;color:#888;border-bottom:1px solid #f0f0ea">Grund</td><td style="border-bottom:1px solid #f0f0ea">${data.grund||'—'}</td></tr>
      ${distBahnhofM!=null?`<tr><td style="padding:6px 0;color:#888;border-bottom:1px solid #f0f0ea">Bahnhof</td><td style="border-bottom:1px solid #f0f0ea">${distBahnhofM}m ${result.bahnhofName?'('+result.bahnhofName+')':''}</td></tr>`:''}
      ${distSeeM!=null?`<tr><td style="padding:6px 0;color:#888;border-bottom:1px solid #f0f0ea">See</td><td style="border-bottom:1px solid #f0f0ea">${distSeeM}m</td></tr>`:''}
      ${steuerfuss?`<tr><td style="padding:6px 0;color:#888;border-bottom:1px solid #f0f0ea">Steuerfuss</td><td style="border-bottom:1px solid #f0f0ea">${steuerfuss}%</td></tr>`:''}
    </table>
    <div style="background:#EDF1EE;border-radius:8px;padding:16px 20px">
      <div style="font-size:28px;font-weight:800;color:#344E41;letter-spacing:-.05em">CHF ${fmt(total)}</div>
      <div style="font-size:11px;color:#666;margin-top:3px">CHF ${fmt(rMin)} – CHF ${fmt(rMax)} · Score ${score}/100 · ${scoreLabel}</div>
      <div style="font-size:10px;color:#888;margin-top:2px">${m2} CHF/m² · ${vermarktungDauer} Tage · ${vergleichsObjekte} Obj.</div>
      ${airtableId?`<div style="font-size:9px;color:#aaa;margin-top:4px">Airtable: ${airtableId}</div>`:''}
    </div>
    ${(risikoFlags||[]).length>0?`<div style="font-size:10px;color:#888;margin-top:8px"><strong>Flags:</strong> ${risikoFlags.map(f=>`${f.typ.toUpperCase()} ${f.kat}: ${f.text}`).join(' | ')}</div>`:''}
    <div style="font-size:9px;color:#aaa;margin-top:6px">Quellen: ${(dataquellen||[]).join(' · ')}</div>
  </div>`;
}

// ─── Background Tasks (nach Response) ────────────────────────────────────────
async function runBackground(data, result) {
  // PDF
  let pdfBuffer = null;
  try {
    const html = buildReportHTML(data, result);
    pdfBuffer = await generatePDF(html);
  } catch(e) { console.error('PDF:', e.message); }

  // Airtable
  const airtableId = await saveToAirtable(data, result);

  // E-Mails
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY fehlt — keine E-Mails');
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const FROM_CLIENT = 'Altera Immobilien <onboarding@resend.dev>';
  const FROM_TEAM   = 'Altera System <onboarding@resend.dev>';
  const NOTIFY      = process.env.NOTIFY_EMAIL || 'hallo@altera-immobilien.ch';

  const attachments = pdfBuffer ? [{
    filename:    `Altera-Bewertungsreport-${data.plz||'CH'}.pdf`,
    content:     pdfBuffer.toString('base64'),
    contentType: 'application/pdf',
  }] : [];

  // Kunde
  try {
    await resend.emails.send({
      from:        FROM_CLIENT,
      to:          data.email,
      subject:     `Ihre Immobilienbewertung — CHF ${fmt(result.total)}`,
      html:        buildClientEmailHTML(data, result, !!pdfBuffer),
      attachments,
    });
    console.log('E-Mail Kunde OK:', data.email);
  } catch(e) {
    console.error('E-Mail Kunde Fehler:', e.message, JSON.stringify(e).substring(0,200));
  }

  // Team
  try {
    await resend.emails.send({
      from:    FROM_TEAM,
      to:      NOTIFY,
      subject: `Lead: ${data.vorname||''} ${data.nachname||''} — CHF ${fmt(result.total)} · Score ${result.score}`,
      html:    buildTeamEmailHTML(data, result, airtableId),
    });
    console.log('E-Mail Team OK');
  } catch(e) {
    console.error('E-Mail Team Fehler:', e.message);
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: 'Ungültiges JSON' }); }

  if (!body.email?.includes('@'))
    return res.status(400).json({ error: 'Ungültige E-Mail' });

  console.log(`\n=== Submit: ${body.email} · ${body.plz} ${body.ort||''} ===`);

  // 1. Geodaten
  const geoResult = await analysiereImmobilie(body);
  console.log(`Geo: Bahn ${geoResult.distBahnhofM}m | See ${geoResult.distSeeM}m | Steuerfuss ${geoResult.steuerfuss}%`);

  // 2. KI-Agent
  const result = await bewerteWithAgent(body, geoResult, geoResult);
  console.log(`Bewertung: CHF ${fmt(result.total)} | Score ${result.score} | ${result.quelle}`);

  // 3. Sofort antworten (Frontend zeigt Ergebnis)
  res.status(200).json({
    success:           true,
    value:             result.total,
    score:             result.score,
    m2:                result.m2,
    vermarktungDauer:  result.vermarktungDauer,
    vergleichsObjekte: result.vergleichsObjekte,
    nachfrageFaktor:   result.nachfrageFaktor,
    radiusKm:          result.radiusKm,
    distBahnhofM:      result.distBahnhofM,
    distSeeM:          result.distSeeM,
    steuerfuss:        result.steuerfuss,
    risikoFlags:       result.risikoFlags,
    einschaetzung:     result.einschaetzung,
    dataquellen:       result.dataquellen,
  });

  // 4. Background: PDF + E-Mail + Airtable (nach Response)
  runBackground(body, result).catch(e => console.error('Background:', e.message));
};
