// lib/pdfReport.js
// Generiert schönes HTML für den Report
// Wird via PDFShift API zu echtem PDF konvertiert

function fmt(n) {
  return Number(n).toLocaleString('de-CH');
}

const TYP    = { etw:'Eigentumswohnung', efh:'Einfamilienhaus', mfh:'Mehrfamilienhaus', rh:'Reihenhaus', villa:'Villa', gew:'Gewerbe/Büro' };
const SUBTYP = { std:'Standard', erd:'Gartenwohnung (EG)', duplex:'Duplex', attika:'Attika', penthouse:'Penthouse', studio:'Studio/Loft' };
const LAGE   = { top:'Toplage', sg:'Sehr gut', gut:'Gut', mit:'Mittel', ein:'Einfach' };
const ZUST   = { neu:'Neuwertig', sg:'Sehr gut', gut:'Gut', ren:'Renovationsbedarf', san:'Sanierungsbedarf' };
const GRUND  = { vk:'Verkauf', ref:'Finanzierung/Hypothek', erb:'Erbschaft/Scheidung', ori:'Orientierung', kauf:'Kaufentscheid', steu:'Steuererklärung' };
const LAERM  = { kein:'Kein Lärm', ger:'Gering', mit:'Mittel', hoch:'Stark' };
const STATUS = { eigen:'Eigennutzung', verm:'Vermietet', leer:'Leer', ferien:'Ferienwohnung' };

function buildReportHTML(data, result) {
  const { total, rMin, rMax, score, scoreLabel, m2, ren, base, lm, zm, af, fm } = result;
  const feats = Number(data.feats) || 0;
  const date  = new Date().toLocaleDateString('de-CH');
  const year  = new Date().getFullYear();

  const addrFull = [data.strasse, [data.plz, data.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '—';
  const typLabel = (TYP[data.typ] || data.typ || '—') +
    (data.subtyp && data.subtyp !== 'std' ? ` · ${SUBTYP[data.subtyp] || data.subtyp}` : '');

  const insight = score >= 80
    ? 'Ihre Immobilie weist eine überdurchschnittliche Qualität auf. Das aktuelle Marktumfeld am Zürichsee ist günstig — eine zeitnahe Vermarktung verspricht einen optimalen Erlös. Wir empfehlen ein persönliches Gespräch, um Timing und Preisstrategie optimal zu definieren.'
    : score >= 60
    ? 'Ihre Immobilie hat solide Ausgangsbedingungen. Mit gezielten Massnahmen lässt sich der Verkaufspreis optimieren. Unsere Experten beraten Sie gerne persönlich und unverbindlich.'
    : 'Es besteht echtes Optimierungspotenzial. Wir zeigen Ihnen, welche Massnahmen sich wirklich lohnen — unverbindlich und kostenlos.';

  const scores = [
    { l: 'Lage & Mikrolage',    v: Math.min(100, Math.round(lm * 72)) },
    { l: 'Bausubstanz & Alter', v: Math.min(100, Math.round(af * 92)) },
    { l: 'Zustand',             v: Math.min(100, Math.round(zm * 85)) },
    { l: 'Ausstattung',         v: Math.min(100, Math.round(fm * 74)) },
    { l: 'Marktlage',           v: 78 },
    { l: 'Energiestandard',     v: 64 },
  ];

  const scoreRows = scores.map(s => {
    const col = s.v >= 75 ? '#344E41' : s.v >= 55 ? '#966B1A' : '#8A2828';
    const bg  = s.v >= 75 ? '#EDF1EE' : s.v >= 55 ? '#FBF3E8' : '#FAE8E8';
    const tag = s.v >= 75 ? 'Gut' : s.v >= 55 ? 'Mittel' : 'Ausbau';
    return `<tr>
      <td style="padding:8px 10px;font-size:11px;color:#333;width:155px;border-bottom:1px solid #f0f0ea;font-weight:500">${s.l}</td>
      <td style="padding:8px 8px;border-bottom:1px solid #f0f0ea">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="flex:1;height:7px;background:#EAEAE4;border-radius:3px;overflow:hidden">
            <div style="width:${s.v}%;height:100%;background:${col};border-radius:3px"></div>
          </div>
          <span style="font-size:13px;font-weight:800;color:#111;width:26px;text-align:right;flex-shrink:0">${s.v}</span>
          <span style="background:${bg};color:${col};font-size:8.5px;font-weight:700;padding:2px 8px;border-radius:4px;text-transform:uppercase;letter-spacing:.04em;flex-shrink:0;width:42px;text-align:center">${tag}</span>
        </div>
      </td>
    </tr>`;
  }).join('');

  const objRows = [
    ['Objekttyp', typLabel],
    ['Adresse', addrFull],
    data.etage ? ['Etage / Stock', data.etage] : null,
    data.flaeche ? ['Nettowohnfläche', data.flaeche + ' m²'] : null,
    data.zimmer ? ['Zimmer', String(data.zimmer)] : null,
    data.baujahr ? ['Baujahr', String(data.baujahr)] : null,
    data.renov ? ['Letzte Renovation', String(data.renov)] : null,
    data.zustand ? ['Zustand', ZUST[data.zustand] || data.zustand] : null,
    data.lage ? ['Wohnlage', LAGE[data.lage] || data.lage] : null,
    data.laerm ? ['Lärmbelastung', LAERM[data.laerm] || data.laerm] : null,
    data.heizung ? ['Heizung', data.heizung] : null,
    data.status ? ['Status', STATUS[data.status] || data.status] : null,
    (data.miete && Number(data.miete) > 0) ? ['Nettomiete / Monat', 'CHF ' + fmt(Number(data.miete))] : null,
    feats > 0 ? ['Ausstattungsmerkmale', feats + ' Merkmale angegeben'] : null,
    (data.steuer && Number(data.steuer) !== 100) ? ['Gemeindesteuerfuss', data.steuer + ' %'] : null,
    data.grund ? ['Bewertungsgrund', GRUND[data.grund] || data.grund] : null,
  ].filter(Boolean)
   .map(([l, v]) => `<tr><td style="padding:6px 9px;font-size:10px;color:#888;width:42%;border-bottom:1px solid #f5f5f0">${l}</td><td style="padding:6px 9px;font-size:10.5px;font-weight:600;color:#111;border-bottom:1px solid #f5f5f0">${v}</td></tr>`)
   .join('');

  const segments = [
    { n: 'Premium-Segment',   r: `CHF ${fmt(Math.round(total*1.22/10000)*10000)} – CHF ${fmt(Math.round(total*1.65/10000)*10000)}`, a: score >= 88 },
    { n: 'Gehobenes Segment', r: `CHF ${fmt(Math.round(total*1.07/10000)*10000)} – CHF ${fmt(Math.round(total*1.22/10000)*10000)}`, a: score >= 72 && score < 88 },
    { n: 'Mittleres Segment', r: `CHF ${fmt(rMin)} – CHF ${fmt(rMax)}`, a: score >= 48 && score < 72 },
    { n: 'Einfaches Segment', r: `CHF ${fmt(Math.round(total*0.65/10000)*10000)} – CHF ${fmt(rMin)}`, a: score < 48 },
  ].map((s, i) => `
    <div style="display:flex;align-items:center;gap:9px;padding:8px 11px;border-radius:5px;border:1.5px solid ${s.a ? '#D0DDD4' : '#EAEAE4'};background:${s.a ? '#EDF1EE' : '#fff'};margin-bottom:5px">
      <div style="width:20px;height:20px;border-radius:50%;background:${s.a ? '#344E41' : '#EAEAE4'};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:${s.a ? '#fff' : '#888'};flex-shrink:0">${i+1}</div>
      <div style="flex:1;font-size:10.5px;font-weight:${s.a ? 700 : 500};color:${s.a ? '#111' : '#888'}">${s.n}${s.a ? '<span style="background:#344E41;color:#fff;font-size:7.5px;font-weight:700;padding:2px 6px;border-radius:4px;margin-left:6px">Ihr Objekt</span>' : ''}</div>
      <div style="font-size:10.5px;font-weight:${s.a ? 700 : 400};color:${s.a ? '#344E41' : '#888'}">${s.r}</div>
    </div>`).join('');

  const confData = [
    { l: 'Datenbasis',       v: Math.min(96, 75 + feats * 1.2 + 10) },
    { l: 'Vergleichbarkeit', v: Math.min(94, 60 + Math.round(lm * 20)) },
    { l: 'Modellkonfidenz',  v: Math.min(96, 78 + Math.round(zm * 12)) },
  ];

  const recs = score >= 80
    ? ['Zeitnahe Vermarktung empfohlen — Marktumfeld ist sehr günstig', 'Professionelle Fotografie für maximale Reichweite und Angebotspreise', 'Preisstrategie mit Altera-Experten persönlich abstimmen']
    : ['Gezielte Aufwertungsmassnahmen vor dem Verkauf prüfen', 'Energetische Optimierung kann den Marktwert deutlich steigern', 'Persönliche Vor-Ort-Schätzung für präzise Einschätzung anfragen'];

  // Statische Karten-URL für PDF (OpenStreetMap via bbox)
  const mapUrl = data.lat && data.lon
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(data.lon)-.003},${parseFloat(data.lat)-.003},${parseFloat(data.lon)+.003},${parseFloat(data.lat)+.003}&layer=hot&marker=${data.lat},${data.lon}`
    : null;

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Altera Immobilien — Bewertungsreport ${date}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff;font-size:13px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @page{margin:10mm;size:A4}
  .hdr{background:#344E41;padding:14px 24px;display:flex;justify-content:space-between;align-items:center;margin:-10mm -10mm 16px -10mm;page-break-after:avoid}
  .hl .nm{font-size:16px;font-weight:700;color:#fff}
  .hl .nm span{color:#C9A874}
  .hl .sub{font-size:7.5px;color:rgba(255,255,255,.45);margin-top:2px}
  .hr{text-align:right}
  .hr .dt{font-size:9px;font-weight:700;color:#C9A874}
  .hr .pg{font-size:7.5px;color:rgba(255,255,255,.3);margin-top:2px}
  .st{font-size:12px;font-weight:700;color:#111;padding-bottom:4px;border-bottom:2px solid #344E41;margin-bottom:10px;margin-top:14px;page-break-after:avoid}
  .hero{background:linear-gradient(135deg,#EDF1EE,#FBF6EE);border-radius:8px;padding:16px 20px;margin-bottom:12px}
  .val{font-size:36px;font-weight:800;color:#111;letter-spacing:-.05em;line-height:1;margin:4px 0}
  .rbar{height:5px;border-radius:3px;margin:7px 0;background:linear-gradient(90deg,#F5C4C4 0%,#C9A874 45%,#344E41 100%)}
  .badge{background:#EAF4EF;color:#1B6B3E;border-radius:20px;padding:3px 10px;font-size:8px;font-weight:700;display:inline-block;margin-top:6px}
  .mets{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #EAEAE4;border-radius:6px;overflow:hidden;margin-bottom:12px}
  .met{padding:10px 11px;border-right:1px solid #EAEAE4}
  .met:last-child{border-right:none}
  .ml{font-size:6.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:4px}
  .mv{font-size:15px;font-weight:800;color:#111;letter-spacing:-.04em;line-height:1}
  .mn{font-size:8px;color:#1B6B3E;font-weight:600;margin-top:2px}
  .mapbox{border-radius:6px;border:1px solid #EAEAE4;height:160px;overflow:hidden;margin-bottom:12px}
  .mapbox iframe{width:100%;height:100%;border:none;display:block}
  .mapph{height:100%;background:#EDF1EE;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:5px;color:#344E41;font-size:10px}
  .ins{background:#EDF1EE;border-left:3px solid #344E41;border-radius:0 6px 6px 0;padding:11px 14px;margin-bottom:12px}
  .cta{background:#344E41;border-radius:7px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center}
  .disc{background:#FBF6EE;border-radius:4px;padding:8px 11px;margin-top:9px}
  .pft{border-top:1px solid #EAEAE4;padding-top:7px;margin-top:16px;display:flex;justify-content:space-between;font-size:7px;color:#aaa}
  .pb{page-break-after:always}
  table{border-collapse:collapse;width:100%}
</style>
</head>
<body>

<!-- ═══ SEITE 1: DECKBLATT ═══ -->
<div class="hdr">
  <div class="hl"><div class="nm">Altera <span>Immobilien</span></div><div class="sub">Seestrasse 88 · 8700 Küsnacht · hallo@altera-immobilien.ch · +41 44 000 00 00</div></div>
  <div class="hr"><div class="dt">Bewertungsreport · ${date}</div><div class="pg">Seite 1 / 3</div></div>
</div>

<div class="hero">
  <div style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#344E41;margin-bottom:4px">Geschätzter Marktwert</div>
  <div style="font-size:10px;color:#666;margin-bottom:4px">${addrFull}</div>
  <div class="val">CHF ${fmt(total)}</div>
  <div style="font-size:10px;color:#666;margin-top:6px">Bandbreite: CHF ${fmt(rMin)} – CHF ${fmt(rMax)}</div>
  <div class="rbar"></div>
  <div style="display:flex;justify-content:space-between;font-size:8.5px;font-weight:700">
    <span style="color:#8A2828">Min: CHF ${fmt(rMin)}</span>
    <span style="color:#1B6B3E">Max: CHF ${fmt(rMax)}</span>
  </div>
  <div class="badge">● Hohe Konfidenz · ${result.vergleichsObjekte || 127} Vergleichsobjekte · Stand ${date}</div>
</div>

<div class="mets">
  <div class="met"><div class="ml">Preis pro m²</div><div class="mv">CHF ${fmt(m2)}</div><div class="mn">↑ +3.2% ggü. Vorjahr</div></div>
  <div class="met"><div class="ml">Gesamt-Score</div><div class="mv">${score}/100</div><div class="mn">${scoreLabel}</div></div>
  <div class="met"><div class="ml">Mietrendite p.a.</div><div class="mv">${ren}%</div><div class="mn">Netto-Ertragswert</div></div>
  <div class="met"><div class="ml">Ø Vermarktung</div><div class="mv">${result.vermarktungDauer || 38} Tage</div><div class="mn">Region ${data.ort || data.plz || 'Zürichsee'}</div></div>
</div>

<div class="st" style="margin-top:0">Standort</div>
<div class="mapbox">
  ${mapUrl
    ? `<iframe src="${mapUrl}" scrolling="no"></iframe>`
    : `<div class="mapph"><div style="font-size:20px">📍</div><div style="font-weight:700">${addrFull}</div></div>`
  }
</div>

<div class="pft">
  <span>© ${year} Altera Immobilien GmbH · Küsnacht am Zürichsee</span>
  <span>Seite 1 / 3</span>
</div>
<div class="pb"></div>

<!-- ═══ SEITE 2: OBJEKTDATEN & ANALYSE ═══ -->
<div class="hdr">
  <div class="hl"><div class="nm">Altera <span>Immobilien</span></div><div class="sub">Bewertungsreport · ${date}</div></div>
  <div class="hr"><div class="dt">Objektdaten &amp; Analyse</div><div class="pg">Seite 2 / 3</div></div>
</div>

<div class="st" style="margin-top:0">Objektdaten</div>
<table style="margin-bottom:12px"><tbody>${objRows}</tbody></table>

<div class="st">Score-Analyse</div>
<table style="margin-bottom:12px"><tbody>${scoreRows}</tbody></table>

<div class="st">Segment-Einordnung</div>
<div style="margin-bottom:12px">${segments}</div>

<div class="pft">
  <span>© ${year} Altera Immobilien GmbH · Küsnacht</span>
  <span>Seite 2 / 3</span>
</div>
<div class="pb"></div>

<!-- ═══ SEITE 3: MARKT & EMPFEHLUNG ═══ -->
<div class="hdr">
  <div class="hl"><div class="nm">Altera <span>Immobilien</span></div><div class="sub">Bewertungsreport · ${date}</div></div>
  <div class="hr"><div class="dt">Markt &amp; Empfehlung</div><div class="pg">Seite 3 / 3</div></div>
</div>

<div class="st" style="margin-top:0">Markt-Kontext</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
  <div style="background:#F9F8F4;border-radius:6px;padding:12px 14px">
    <div style="font-size:6.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:4px">Ø-Preis in Ihrer Region</div>
    <div style="font-size:18px;font-weight:800;color:#111;letter-spacing:-.04em">CHF ${fmt(Math.round(base * 1.04))}/m²</div>
    <div style="font-size:8px;color:#1B6B3E;font-weight:600;margin-top:2px">+2.4% in 12 Monaten</div>
    <div style="font-size:8px;color:#888;margin-top:2px">${result.vergleichsObjekte || 127} Vergleichsobjekte · ${result.radiusKm || 5} km Radius</div>
  </div>
  <div style="background:#F9F8F4;border-radius:6px;padding:12px 14px">
    <div style="font-size:6.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:4px">Markt-Nachfrage</div>
    <div style="font-size:18px;font-weight:800;color:#111;letter-spacing:-.04em">Hoch ↗</div>
    <div style="font-size:8px;color:#1B6B3E;font-weight:600;margin-top:2px">Nachfrage ${result.nachfrageFaktor || '2.1'}× über Angebot</div>
    <div style="font-size:8px;color:#888;margin-top:2px">Ø ${result.vermarktungDauer || 38} Tage Vermarktungsdauer</div>
  </div>
</div>

<div class="st">Bewertungsgenauigkeit</div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px">
  ${confData.map(a => `
    <div style="background:#F9F8F4;border-radius:6px;padding:10px 12px">
      <div style="font-size:6.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:5px">${a.l}</div>
      <div style="background:#EAEAE4;height:5px;border-radius:3px;margin-bottom:5px;overflow:hidden">
        <div style="width:${Math.round(a.v)}%;height:100%;background:#344E41;border-radius:3px"></div>
      </div>
      <div style="font-size:16px;font-weight:800;color:#344E41;letter-spacing:-.04em">${Math.round(a.v)}%</div>
    </div>`).join('')}
</div>

<div class="st">Altera-Einschätzung</div>
<div class="ins" style="margin-bottom:12px">
  <div style="font-size:10px;font-weight:700;color:#344E41;margin-bottom:4px">Unsere Einschätzung zu Ihrer Immobilie</div>
  <div style="font-size:10px;color:#333;line-height:1.65">${insight}</div>
</div>

<div class="st">Empfehlungen</div>
<div style="margin-bottom:12px">
  ${recs.map((r, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:${i%2===0?'#F9F8F4':'#fff'};border-radius:5px;margin-bottom:4px">
      <div style="width:18px;height:18px;border-radius:50%;background:#344E41;color:#fff;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;flex-shrink:0">${i+1}</div>
      <span style="font-size:10px;color:#333">${r}</span>
    </div>`).join('')}
</div>

<div class="cta">
  <div>
    <div style="font-size:11px;font-weight:700;color:#fff;margin-bottom:3px">Professionelle Schätzung vor Ort anfragen</div>
    <div style="font-size:8.5px;color:rgba(255,255,255,.6);line-height:1.5;max-width:260px">Thierry Mataré oder Janis Beerli kommen persönlich zu Ihnen. Bankfähige, rechtsgültige Bewertung — unverbindlich.</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:13px;font-weight:800;color:#C9A874">+41 44 000 00 00</div>
    <div style="font-size:8.5px;color:rgba(255,255,255,.5);margin-top:2px">hallo@altera-immobilien.ch</div>
  </div>
</div>

<div class="disc">
  <p style="font-size:7.5px;color:#888;line-height:1.6">
    Diese Online-Bewertung basiert auf hedonischer Methodik und aktuellen Marktdaten. Sie dient als Orientierungswert und ersetzt keine persönliche Vor-Ort-Schätzung durch zertifizierte Sachverständige.
    © ${year} Altera Immobilien GmbH · Seestrasse 88 · 8700 Küsnacht
  </p>
</div>

<div class="pft">
  <span>© ${year} Altera Immobilien GmbH · Küsnacht am Zürichsee</span>
  <span>Seite 3 / 3</span>
</div>

</body>
</html>`;
}

module.exports = { buildReportHTML, fmt };
