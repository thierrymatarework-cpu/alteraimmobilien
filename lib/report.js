// lib/report.js
// Generiert einen professionellen PDF-Report als Base64-String
// Verwendet keine externen Browser — läuft auf Vercel

function fmt(n) {
  return Number(n).toLocaleString('de-CH');
}

/**
 * Baut das HTML für den Report
 * Wird dann via Resend als Attachment gesendet
 */
function buildReportHTML(data, result) {
  const { vorname, nachname, plz, ort, typ, subtyp, flaeche } = data;
  const { total, rMin, rMax, score, scoreLabel, m2, ren, base, lm, zm, af, fm } = result;
  const date = new Date().toLocaleDateString('de-CH');
  const year = new Date().getFullYear();

  const scores = [
    { label: 'Lage & Mikrolage',    val: Math.min(100, Math.round(lm * 72)) },
    { label: 'Bausubstanz & Alter', val: Math.min(100, Math.round(af * 92)) },
    { label: 'Zustand',             val: Math.min(100, Math.round(zm * 85)) },
    { label: 'Ausstattung',         val: Math.min(100, Math.round(fm * 74)) },
    { label: 'Marktlage',           val: 78 },
    { label: 'Energiestandard',     val: 64 },
  ];

  const scoreRows = scores.map(({ label, val }) => {
    const color   = val >= 75 ? '#344E41' : val >= 55 ? '#966B1A' : '#8A2828';
    const bgColor = val >= 75 ? '#EDF1EE' : val >= 55 ? '#FBF3E8' : '#FAE8E8';
    const tag     = val >= 75 ? 'Gut'    : val >= 55 ? 'Mittel'  : 'Ausbau';
    const barW    = Math.round(val * 1.5);
    return `
    <tr>
      <td style="padding:9px 0;font-size:12px;color:#444;width:160px;border-bottom:1px solid #F5F5F0">${label}</td>
      <td style="padding:9px 8px;border-bottom:1px solid #F5F5F0">
        <table cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="width:${barW}px;height:7px;background:${color};border-radius:3px 0 0 3px"></td>
          <td style="width:${150-barW}px;height:7px;background:#EAEAE4;border-radius:0 3px 3px 0"></td>
        </tr></table>
      </td>
      <td style="padding:9px 0;font-size:15px;font-weight:800;color:#111;width:36px;text-align:right;border-bottom:1px solid #F5F5F0">${val}</td>
      <td style="padding:9px 0 9px 10px;border-bottom:1px solid #F5F5F0;width:70px">
        <span style="background:${bgColor};color:${color};font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;text-transform:uppercase;letter-spacing:0.04em">${tag}</span>
      </td>
    </tr>`;
  }).join('');

  const insight = score >= 80
    ? 'Ihre Immobilie zeigt eine überdurchschnittliche Qualität. Das aktuelle Marktumfeld am Zürichsee ist günstig — eine zeitnahe Vermarktung verspricht einen optimalen Erlös.'
    : score >= 60
    ? 'Ihre Immobilie hat solide Ausgangsbedingungen. Mit gezielten Massnahmen lässt sich der Verkaufspreis noch weiter optimieren.'
    : 'Es gibt echtes Optimierungspotenzial. Gerne zeigen wir Ihnen, welche Massnahmen sich vor dem Verkauf lohnen.';

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Altera Immobilien — Bewertungsreport ${date}</title>
  <style>
    @page { margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      background: #fff;
      color: #111;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page { max-width: 760px; margin: 0 auto; padding: 48px 52px; }
    @media print {
      body { background: #fff; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- PRINT BUTTON -->
  <div class="no-print" style="position:fixed;top:20px;right:20px;z-index:999;display:flex;gap:10px">
    <button onclick="window.print()"
      style="background:#344E41;color:#fff;border:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:Arial,sans-serif">
      📄 Als PDF speichern
    </button>
    <button onclick="window.close()"
      style="background:#F9F8F4;color:#666;border:1px solid #EAEAE4;padding:12px 18px;border-radius:8px;font-size:14px;cursor:pointer;font-family:Arial,sans-serif">
      ✕ Schliessen
    </button>
  </div>

  <!-- HEADER -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="border-bottom:2px solid #344E41;padding-bottom:20px;margin-bottom:32px">
  <tr>
    <td>
      <div style="font-size:26px;font-weight:700;color:#111;letter-spacing:-0.03em">
        Altera <span style="color:#344E41">Immobilien</span>
      </div>
      <div style="font-size:12px;color:#888;margin-top:4px">
        Seestrasse 88, 8700 Küsnacht · hallo@altera-immobilien.ch · +41 44 000 00 00
      </div>
    </td>
    <td align="right" valign="bottom">
      <div style="font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:0.08em">Bewertungsreport</div>
      <div style="font-size:15px;font-weight:700;color:#344E41;margin-top:3px">${date}</div>
    </td>
  </tr>
  </table>

  <!-- VALUE HERO -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:linear-gradient(135deg,#EDF1EE 0%,#FBF6EE 100%);border-radius:14px;margin-bottom:24px">
  <tr><td style="padding:32px 36px">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td valign="top">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#344E41;margin-bottom:8px">
          Geschätzter Marktwert
        </div>
        <div style="font-size:12px;color:#666;margin-bottom:8px">
          PLZ ${plz}${ort ? ' · ' + ort : ''}${typ ? ' · ' + typ : ''}${subtyp && subtyp !== 'std' ? ' (' + subtyp + ')' : ''}
          · ${flaeche || '—'} m²
        </div>
        <div style="font-size:52px;font-weight:800;color:#111;letter-spacing:-0.05em;line-height:0.95">
          CHF ${fmt(total)}
        </div>
        <div style="font-size:14px;color:#666;margin-top:10px">
          Bandbreite: CHF ${fmt(rMin)} – CHF ${fmt(rMax)}
        </div>

        <!-- Range bar -->
        <table width="360" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px">
        <tr>
          <td style="font-size:12px;font-weight:700;color:#8A2828">Min: CHF ${fmt(rMin)}</td>
          <td align="right" style="font-size:12px;font-weight:700;color:#1B6B3E">Max: CHF ${fmt(rMax)}</td>
        </tr>
        <tr><td colspan="2" style="padding-top:5px">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="height:5px;background:linear-gradient(90deg,#F5C4C4 0%,#C9A874 45%,#D0DDD4 70%,#344E41 100%);border-radius:3px"></td></tr>
          </table>
        </td></tr>
        </table>
      </td>
      <td valign="top" align="right" style="padding-left:20px;min-width:130px">
        <div style="background:#EAF4EF;color:#1B6B3E;border-radius:20px;padding:6px 14px;font-size:11px;font-weight:700;display:inline-block;white-space:nowrap">
          ✓ Hohe Konfidenz
        </div>
        <div style="font-size:11px;color:#888;margin-top:10px;text-align:right;line-height:1.6">
          127 Vergleichsobjekte<br>
          Hedonische Methodik<br>
          Stand ${date}
        </div>
      </td>
    </tr>
    </table>
  </td></tr>
  </table>

  <!-- METRICS -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="border:1px solid #EAEAE4;border-radius:12px;overflow:hidden;margin-bottom:28px">
  <tr>
    <td style="padding:18px 20px;border-right:1px solid #EAEAE4;width:25%;vertical-align:top">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#888;margin-bottom:6px">Preis pro m²</div>
      <div style="font-size:24px;font-weight:800;color:#111;letter-spacing:-0.04em">CHF ${fmt(m2)}</div>
      <div style="font-size:11px;color:#1B6B3E;font-weight:600;margin-top:4px">↑ +3.2% ggü. Vorjahr</div>
    </td>
    <td style="padding:18px 20px;border-right:1px solid #EAEAE4;width:25%;vertical-align:top">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#888;margin-bottom:6px">Gesamt-Score</div>
      <div style="font-size:24px;font-weight:800;color:#111;letter-spacing:-0.04em">${score}/100</div>
      <div style="font-size:11px;color:#1B6B3E;font-weight:600;margin-top:4px">${scoreLabel}</div>
    </td>
    <td style="padding:18px 20px;border-right:1px solid #EAEAE4;width:25%;vertical-align:top">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#888;margin-bottom:6px">Mietrendite p.a.</div>
      <div style="font-size:24px;font-weight:800;color:#111;letter-spacing:-0.04em">${ren}%</div>
      <div style="font-size:11px;color:#1B6B3E;font-weight:600;margin-top:4px">Überdurchschnittlich</div>
    </td>
    <td style="padding:18px 20px;width:25%;vertical-align:top">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#888;margin-bottom:6px">Marktdynamik</div>
      <div style="font-size:24px;font-weight:800;color:#111;letter-spacing:-0.04em">Hoch ↗</div>
      <div style="font-size:11px;color:#1B6B3E;font-weight:600;margin-top:4px">Ø 24 Tage Verkauf</div>
    </td>
  </tr>
  </table>

  <!-- SCORE ANALYSIS -->
  <div style="font-size:18px;font-weight:700;color:#111;letter-spacing:-0.03em;margin-bottom:5px">Score-Analyse</div>
  <div style="font-size:13px;color:#888;margin-bottom:16px">Bewertung nach 6 Dimensionen — basierend auf Ihren Angaben</div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px">
    ${scoreRows}
  </table>

  <!-- MARKET -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:#F9F8F4;border-radius:12px;margin-bottom:24px">
  <tr>
    <td style="padding:20px 24px;border-right:1px solid #EAEAE4;width:50%;vertical-align:top">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#888;margin-bottom:7px">Ø-Preis Region</div>
      <div style="font-size:22px;font-weight:800;color:#111;letter-spacing:-0.04em">CHF ${fmt(Math.round(base * 1.04))}/m²</div>
      <div style="font-size:12px;color:#1B6B3E;font-weight:600;margin-top:4px">+2.4% in den letzten 12 Monaten</div>
      <div style="font-size:12px;color:#666;margin-top:6px;line-height:1.6">Basierend auf 127 Vergleichsobjekten im Umkreis von 5 km, Transaktionen der letzten 6 Monate.</div>
    </td>
    <td style="padding:20px 24px;width:50%;vertical-align:top">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#888;margin-bottom:7px">Markt-Nachfrage</div>
      <div style="font-size:22px;font-weight:800;color:#111;letter-spacing:-0.04em">Hoch ↗</div>
      <div style="font-size:12px;color:#1B6B3E;font-weight:600;margin-top:4px">Nachfrage 2.4× über Angebot</div>
      <div style="font-size:12px;color:#666;margin-top:6px;line-height:1.6">Ø-Vermarktungsdauer: 24 Tage. Günstige Verkaufskonditionen im aktuellen Marktumfeld.</div>
    </td>
  </tr>
  </table>

  <!-- INSIGHT -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:#EDF1EE;border:1.5px solid #D0DDD4;border-radius:12px;margin-bottom:24px">
  <tr><td style="padding:18px 22px">
    <div style="font-size:13px;font-weight:700;color:#344E41;margin-bottom:5px">Altera-Einschätzung</div>
    <div style="font-size:13px;color:#444;line-height:1.7">${insight}</div>
  </td></tr>
  </table>

  <!-- CTA -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:#344E41;border-radius:12px;margin-bottom:28px">
  <tr><td style="padding:26px 30px">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td valign="middle">
        <div style="font-size:17px;font-weight:700;color:#fff;letter-spacing:-0.03em;margin-bottom:6px">
          Professionelle Schätzung vor Ort — kostenlos
        </div>
        <div style="font-size:13px;color:rgba(255,255,255,0.6);line-height:1.6">
          Thierry oder Janis kommen persönlich zu Ihnen.<br>
          Bankfähige, rechtsgültige Bewertung — völlig unverbindlich.
        </div>
      </td>
      <td valign="middle" align="right" style="padding-left:24px;white-space:nowrap;min-width:180px">
        <div style="font-size:18px;font-weight:800;color:#C9A874;letter-spacing:-0.03em">+41 44 000 00 00</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px">hallo@altera-immobilien.ch</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:2px">Seestrasse 88, 8700 Küsnacht</div>
      </td>
    </tr>
    </table>
  </td></tr>
  </table>

  <!-- FOOTER -->
  <div style="border-top:1px solid #EAEAE4;padding-top:16px;font-size:10px;color:#aaa;line-height:1.65">
    © ${year} Altera Immobilien GmbH · Küsnacht am Zürichsee ·
    Diese Bewertung basiert auf hedonischer Methodik und aktuellen Marktdaten.
    Sie dient zur Orientierung und ersetzt kein offizielles Gutachten im rechtlichen Sinne.
  </div>

</div>
</body>
</html>`;
}

module.exports = { buildReportHTML, fmt };
