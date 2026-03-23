// api/contact.js
// Kontaktformular-Endpoint: Speichert Anfrage in Airtable und benachrichtigt Team

const { Resend } = require('resend');
const Airtable = require('airtable');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { name, email, tel, anliegen, adresse, termin, nachricht } = body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Ungültige E-Mail-Adresse' });
    }

    // In Airtable speichern
    if (process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID) {
      const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
        .base(process.env.AIRTABLE_BASE_ID);

      await base('Kontaktanfragen').create({
        'Name': name || '',
        'E-Mail': email || '',
        'Telefon': tel || '',
        'Anliegen': anliegen || '',
        'Adresse Liegenschaft': adresse || '',
        'Wunschtermin': termin || '',
        'Nachricht': nachricht || '',
        'Status': 'Neu',
        'Erstellt am': new Date().toISOString(),
      });
    }

    // Team-Benachrichtigung
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const notifyEmail = process.env.NOTIFY_EMAIL || 'hallo@altera-immobilien.ch';

      await resend.emails.send({
        from: 'Altera System <system@altera-immobilien.ch>',
        to: notifyEmail,
        subject: `📞 Neue Kontaktanfrage: ${name}`,
        html: `
<div style="font-family:sans-serif;max-width:480px;padding:20px">
  <h2 style="color:#344E41">Neue Kontaktanfrage</h2>
  <table style="width:100%;font-size:14px;border-collapse:collapse">
    <tr><td style="padding:7px 0;color:#888;width:40%">Name</td><td><strong>${name}</strong></td></tr>
    <tr><td style="padding:7px 0;color:#888">E-Mail</td><td><a href="mailto:${email}">${email}</a></td></tr>
    <tr><td style="padding:7px 0;color:#888">Telefon</td><td>${tel || '—'}</td></tr>
    <tr><td style="padding:7px 0;color:#888">Anliegen</td><td>${anliegen || '—'}</td></tr>
    <tr><td style="padding:7px 0;color:#888">Liegenschaft</td><td>${adresse || '—'}</td></tr>
    <tr><td style="padding:7px 0;color:#888">Wunschtermin</td><td>${termin || '—'}</td></tr>
    ${nachricht ? `<tr><td style="padding:7px 0;color:#888;vertical-align:top">Nachricht</td><td>${nachricht}</td></tr>` : ''}
  </table>
  <div style="margin-top:18px;padding:14px;background:#344E41;border-radius:8px;color:#fff;font-size:13px">
    Bitte innert 24h antworten.
  </div>
</div>
        `,
      });

      // Bestätigung an Anfragenden
      await resend.emails.send({
        from: 'Altera Immobilien <hallo@altera-immobilien.ch>',
        to: email,
        subject: 'Ihre Anfrage ist bei uns angekommen',
        html: `
<div style="font-family:sans-serif;max-width:480px;padding:20px">
  <div style="font-size:20px;font-weight:700;color:#344E41;margin-bottom:16px">Altera <span style="color:#C9A874">Immobilien</span></div>
  <p style="font-size:15px;color:#111">Guten Tag${name ? `, ${name.split(' ')[0]}` : ''}</p>
  <p style="font-size:14px;color:#555;line-height:1.7;margin-top:10px">Vielen Dank für Ihre Anfrage. Thierry oder Janis werden sich innert 24 Stunden persönlich bei Ihnen melden.</p>
  <div style="margin-top:20px;padding:16px;background:#EDF1EE;border-radius:8px;font-size:13px;color:#344E41">
    <strong>Ihre Anfrage:</strong> ${anliegen || 'Allgemeine Beratung'}
  </div>
  <p style="font-size:12px;color:#aaa;margin-top:24px">Altera Immobilien GmbH · Seestrasse 88, 8700 Küsnacht · +41 44 000 00 00</p>
</div>
        `,
      });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Contact API Error:', err);
    return res.status(500).json({ error: 'Server-Fehler' });
  }
};
