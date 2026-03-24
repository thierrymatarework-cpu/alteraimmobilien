// lib/pdfReport.js — sauberes 3-seitiges PDF via PDFShift
function fmt(n){return Number(n).toLocaleString('de-CH')}
const TYP={etw:'Eigentumswohnung',efh:'Einfamilienhaus',mfh:'Mehrfamilienhaus',rh:'Reihenhaus',villa:'Villa',gew:'Gewerbe/B\u00fcro'};
const SUBTYP={std:'Standard',erd:'Gartenwohnung (EG)',duplex:'Duplex',attika:'Attika',penthouse:'Penthouse',studio:'Studio/Loft'};
const LAGE={top:'Toplage',sg:'Sehr gut',gut:'Gut',mit:'Mittel',ein:'Einfach'};
const ZUST={neu:'Neuwertig',sg:'Sehr gut',gut:'Gut',ren:'Renovationsbedarf',san:'Sanierungsbedarf'};
const GRUND={vk:'Verkauf',ref:'Finanzierung/Hypothek',erb:'Erbschaft/Scheidung',ori:'Orientierung',kauf:'Kaufentscheid',steu:'Steuererkl\u00e4rung'};
const LAERM={kein:'Kein L\u00e4rm',ger:'Gering',mit:'Mittel',hoch:'Stark'};
const STATUS={eigen:'Eigennutzung',verm:'Vermietet',leer:'Leer',ferien:'Ferienwohnung'};

// px-Werte f\u00fcr A4 @ 96dpi: 794 x 1123px
// PDFShift rendert mit Chromium, also echte Browser-Masse
// Wir nutzen mm-basiertes Layout um sicherzustellen dass nichts abgeschnitten wird

function buildReportHTML(data,result){
  const {total,rMin,rMax,score,scoreLabel,m2,ren,base,lm,zm,af,fm}=result;
  const feats=Number(data.feats)||0;
  const date=new Date().toLocaleDateString('de-CH');
  const year=new Date().getFullYear();
  const addr=[data.strasse,[data.plz,data.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ')||'\u2014';
  const typL=(TYP[data.typ]||data.typ||'\u2014')+(data.subtyp&&data.subtyp!=='std'?` \u00b7 ${SUBTYP[data.subtyp]||data.subtyp}`:'');

  // Segment basiert auf Preis/m\u00b2 vs Basispreis (nicht Score!)
  const ratio=m2/base;
  const yourSeg=ratio>=1.35?0:ratio>=1.05?1:ratio>=0.82?2:3;
  const sb=Math.round(total/10000)*10000;
  const segs=[
    {n:'Premium-Segment',   sub:'Top 15% der Region',   lo:Math.round(sb*1.25/10000)*10000, hi:Math.round(sb*1.7/10000)*10000},
    {n:'Gehobenes Segment', sub:'Top 35% der Region',   lo:Math.round(sb*1.05/10000)*10000, hi:Math.round(sb*1.25/10000)*10000},
    {n:'Mittleres Segment', sub:'Breite Marktmitte',    lo:Math.round(sb*0.82/10000)*10000, hi:Math.round(sb*1.05/10000)*10000},
    {n:'Einfaches Segment', sub:'Untere 30%',           lo:Math.round(sb*0.55/10000)*10000, hi:Math.round(sb*0.82/10000)*10000},
  ];

  const insight = result.einschaetzung ||
    (score>=80
      ?'Ihre Immobilie weist eine \u00fcberdurchschnittliche Qualit\u00e4t auf. Das Marktumfeld ist g\u00fcnstig \u2014 eine zeitnahe Vermarktung verspricht einen optimalen Erl\u00f6s.'
      :score>=60
      ?'Ihre Immobilie hat solide Ausgangsbedingungen. Mit gezielten Massnahmen l\u00e4sst sich der Verkaufspreis optimieren.'
      :'Es besteht Optimierungspotenzial. Wir zeigen Ihnen was sich lohnt \u2014 unverbindlich.');

  const scores=[
    {l:'Lage & Mikrolage',    v:Math.min(100,Math.round(lm*72))},
    {l:'Bausubstanz & Alter', v:Math.min(100,Math.round(af*92))},
    {l:'Zustand',             v:Math.min(100,Math.round(zm*85))},
    {l:'Ausstattung',         v:Math.min(100,Math.round(fm*74))},
    {l:'Marktlage',           v:78},
    {l:'Energiestandard',     v:64},
  ];

  const objRows=[
    ['Objekttyp',typL],['Adresse',addr],
    ...[
      data.etage?['Etage',data.etage]:null,
      data.flaeche?['Wohnfl\u00e4che',data.flaeche+' m\u00b2']:null,
      data.zimmer?['Zimmer',String(data.zimmer)]:null,
      data.baujahr?['Baujahr',String(data.baujahr)]:null,
      data.renov?['Letzte Renovation',String(data.renov)]:null,
      data.zustand?['Zustand',ZUST[data.zustand]||data.zustand]:null,
      data.lage?['Wohnlage',LAGE[data.lage]||data.lage]:null,
      data.laerm?['L\u00e4rmbelastung',LAERM[data.laerm]||data.laerm]:null,
      data.heizung?['Heizung',data.heizung]:null,
      data.status?['Status',STATUS[data.status]||data.status]:null,
      (data.miete&&Number(data.miete)>0)?['Nettomiete/Mo','CHF '+fmt(Number(data.miete))]:null,
      feats>0?['Ausstattung',feats+' Merkmale']:null,
      (data.steuer&&Number(data.steuer)!==100)?['Steuerfuss',data.steuer+' %']:null,
      data.grund?['Bewertungsgrund',GRUND[data.grund]||data.grund]:null,
    ].filter(Boolean)
  ];

  const vd=result.vermarktungDauer||38;
  const vo=result.vergleichsObjekte||84;
  const nf=result.nachfrageFaktor||'2.1';
  const rKm=result.radiusKm||5;

  // Header-HTML (wiederverwendet)
  const hdr=(title,pg)=>`
<table width="100%" cellpadding="0" cellspacing="0" style="background:#344E41;margin-bottom:16px">
<tr>
  <td style="padding:12px 20px">
    <div style="font-size:17px;font-weight:700;color:#fff;font-family:Arial">Altera <span style="color:#C9A874">Immobilien</span></div>
    <div style="font-size:8px;color:rgba(255,255,255,.45);margin-top:2px;font-family:Arial">Seestrasse 88 &middot; 8700 K\u00fcsnacht &middot; hallo@altera-immobilien.ch</div>
  </td>
  <td style="padding:12px 20px;text-align:right">
    <div style="font-size:9px;font-weight:700;color:#C9A874;font-family:Arial">${title}</div>
    <div style="font-size:8px;color:rgba(255,255,255,.35);margin-top:2px;font-family:Arial">Seite ${pg} / 3 &middot; ${date}</div>
  </td>
</tr>
</table>`;

  const ft=(pg)=>`
<table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #EAEAE4;margin-top:14px">
<tr><td style="padding-top:6px;font-size:7px;color:#aaa;font-family:Arial">&copy; ${year} Altera Immobilien GmbH &middot; K\u00fcsnacht am Z\u00fcrichsee</td>
    <td style="padding-top:6px;font-size:7px;color:#aaa;font-family:Arial;text-align:right">Seite ${pg} / 3</td></tr>
</table>`;

  // Score-Zeilen
  const scoreRows=scores.map(s=>{
    const col=s.v>=75?'#344E41':s.v>=55?'#966B1A':'#8A2828';
    const bg=s.v>=75?'#EDF1EE':s.v>=55?'#FBF3E8':'#FAE8E8';
    const tag=s.v>=75?'GUT':s.v>=55?'MITTEL':'AUSBAU';
    const barW=Math.round(s.v*1.8);
    return `<tr>
<td style="padding:7px 8px 7px 0;font-size:10px;color:#333;font-family:Arial;width:130px;border-bottom:1px solid #f5f5f0;white-space:nowrap">${s.l}</td>
<td style="padding:7px 8px;border-bottom:1px solid #f5f5f0">
  <table cellpadding="0" cellspacing="0"><tr>
    <td style="width:${barW}px;height:6px;background:${col};border-radius:3px 0 0 3px"></td>
    <td style="width:${180-barW}px;height:6px;background:#EAEAE4;border-radius:0 3px 3px 0"></td>
  </tr></table>
</td>
<td style="padding:7px 6px;font-size:12px;font-weight:800;color:#111;font-family:Arial;text-align:right;border-bottom:1px solid #f5f5f0;width:24px">${s.v}</td>
<td style="padding:7px 0 7px 6px;border-bottom:1px solid #f5f5f0;width:50px">
  <span style="background:${bg};color:${col};font-size:8px;font-weight:700;padding:2px 6px;border-radius:4px;font-family:Arial">${tag}</span>
</td>
</tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Altera Immobilien \u2014 Bewertungsreport</title>
<style>
  @page { size: A4; margin: 8mm 12mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #111; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pb { page-break-after: always; }
</style>
</head>
<body>

<!-- ════ SEITE 1 ════ -->
${hdr('Bewertungsreport \u00b7 '+date, 1)}

<!-- Wert-Box -->
<table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#EDF1EE,#FBF6EE);border-radius:6px;margin-bottom:10px">
<tr><td style="padding:14px 18px">
  <div style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#344E41;margin-bottom:4px;font-family:Arial">Gesch\u00e4tzter Marktwert</div>
  <div style="font-size:9px;color:#666;margin-bottom:3px;font-family:Arial">${addr}</div>
  <div style="font-size:34px;font-weight:800;color:#111;letter-spacing:-.05em;line-height:1;font-family:Arial">CHF ${fmt(total)}</div>
  <div style="font-size:9px;color:#666;margin-top:6px;font-family:Arial">Bandbreite: CHF ${fmt(rMin)} \u2013 CHF ${fmt(rMax)}</div>
  <!-- Range bar -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:7px"><tr>
    <td style="width:33%;height:5px;background:#F5C4C4;border-radius:3px 0 0 3px"></td>
    <td style="width:33%;height:5px;background:#C9A874"></td>
    <td style="width:33%;height:5px;background:#344E41;border-radius:0 3px 3px 0"></td>
  </tr></table>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:5px"><tr>
    <td style="font-size:8px;font-weight:700;color:#8A2828;font-family:Arial">Min: CHF ${fmt(rMin)}</td>
    <td style="font-size:8px;font-weight:700;color:#1B6B3E;font-family:Arial;text-align:right">Max: CHF ${fmt(rMax)}</td>
  </tr></table>
  <div style="background:#EAF4EF;color:#1B6B3E;border-radius:20px;padding:2px 10px;font-size:7px;font-weight:700;display:inline-block;margin-top:6px;font-family:Arial">&bull; Hohe Konfidenz &middot; ${vo} Vergleichsobjekte &middot; ${rKm} km Radius &middot; Stand ${date}</div>
</td></tr>
</table>

<!-- 4 Metriken -->
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #EAEAE4;border-radius:6px;overflow:hidden;margin-bottom:10px">
<tr>
  <td style="padding:9px 10px;border-right:1px solid #EAEAE4;width:25%">
    <div style="font-size:6.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#888;font-family:Arial">Preis pro m\u00b2</div>
    <div style="font-size:15px;font-weight:800;color:#111;letter-spacing:-.04em;font-family:Arial;margin-top:3px">CHF ${fmt(m2)}</div>
    <div style="font-size:7.5px;color:#1B6B3E;font-weight:600;margin-top:1px;font-family:Arial">\u2191 +3.2% ggü. Vorjahr</div>
  </td>
  <td style="padding:9px 10px;border-right:1px solid #EAEAE4;width:25%">
    <div style="font-size:6.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#888;font-family:Arial">Gesamt-Score</div>
    <div style="font-size:15px;font-weight:800;color:#111;letter-spacing:-.04em;font-family:Arial;margin-top:3px">${score}/100</div>
    <div style="font-size:7.5px;color:#1B6B3E;font-weight:600;margin-top:1px;font-family:Arial">${scoreLabel}</div>
  </td>
  <td style="padding:9px 10px;border-right:1px solid #EAEAE4;width:25%">
    <div style="font-size:6.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#888;font-family:Arial">Mietrendite p.a.</div>
    <div style="font-size:15px;font-weight:800;color:#111;letter-spacing:-.04em;font-family:Arial;margin-top:3px">${ren}%</div>
    <div style="font-size:7.5px;color:#1B6B3E;font-weight:600;margin-top:1px;font-family:Arial">Netto-Ertragswert</div>
  </td>
  <td style="padding:9px 10px;width:25%">
    <div style="font-size:6.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#888;font-family:Arial">&Oslash; Vermarktung</div>
    <div style="font-size:15px;font-weight:800;color:#111;letter-spacing:-.04em;font-family:Arial;margin-top:3px">${vd} Tage</div>
    <div style="font-size:7.5px;color:#1B6B3E;font-weight:600;margin-top:1px;font-family:Arial">${data.ort||data.plz||'Region'}</div>
  </td>
</tr>
</table>

<!-- Standort -->
<div style="font-size:11px;font-weight:700;color:#111;padding-bottom:4px;border-bottom:2px solid #344E41;margin-bottom:8px;font-family:Arial">Standort</div>
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #EAEAE4;border-radius:6px;overflow:hidden;margin-bottom:10px;background:#EDF1EE;height:130px">
<tr><td style="text-align:center;vertical-align:middle;padding:16px">
  <div style="font-size:22px;margin-bottom:6px">&#128205;</div>
  <div style="font-size:11px;font-weight:700;color:#344E41;font-family:Arial">${addr}</div>
  <div style="font-size:8px;color:#666;margin-top:4px;font-family:Arial">PLZ ${data.plz||'\u2014'} &middot; ${data.ort||'\u2014'}</div>
</td></tr>
</table>

${ft(1)}
<div class="pb"></div>

<!-- ════ SEITE 2 ════ -->
${hdr('Objektdaten & Analyse', 2)}

<div style="font-size:11px;font-weight:700;color:#111;padding-bottom:4px;border-bottom:2px solid #344E41;margin-bottom:8px;font-family:Arial">Objektdaten</div>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px">
${objRows.map(([l,v],i)=>`<tr><td style="padding:5px 8px;font-size:9px;color:#888;width:40%;border-bottom:1px solid #f5f5f0;background:${i%2===0?'#F9F8F4':'#fff'};font-family:Arial">${l}</td><td style="padding:5px 8px;font-size:9.5px;font-weight:600;color:#111;border-bottom:1px solid #f5f5f0;background:${i%2===0?'#F9F8F4':'#fff'};font-family:Arial">${v}</td></tr>`).join('')}
</table>

<div style="font-size:11px;font-weight:700;color:#111;padding-bottom:4px;border-bottom:2px solid #344E41;margin-bottom:8px;font-family:Arial">Score-Analyse</div>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px">
${scoreRows}
</table>

<div style="font-size:11px;font-weight:700;color:#111;padding-bottom:4px;border-bottom:2px solid #344E41;margin-bottom:8px;font-family:Arial">Segment-Einordnung</div>
${segs.map((s,i)=>`
<table width="100%" cellpadding="0" cellspacing="0" style="border:1.5px solid ${i===yourSeg?'#D0DDD4':'#EAEAE4'};border-radius:5px;background:${i===yourSeg?'#EDF1EE':'#fff'};margin-bottom:4px">
<tr>
  <td style="padding:0;width:4px;background:${i===yourSeg?'#344E41':'transparent'};border-radius:4px 0 0 4px"></td>
  <td style="padding:7px 10px;width:20px">
    <div style="width:18px;height:18px;border-radius:50%;background:${i===yourSeg?'#344E41':'#EAEAE4'};text-align:center;line-height:18px;font-size:9px;font-weight:800;color:${i===yourSeg?'#fff':'#888'};font-family:Arial">${i+1}</div>
  </td>
  <td style="padding:7px 0">
    <div style="font-size:9.5px;font-weight:${i===yourSeg?700:500};color:${i===yourSeg?'#111':'#888'};font-family:Arial">${s.n}${i===yourSeg?'<span style="background:#344E41;color:#fff;font-size:7px;font-weight:700;padding:1px 5px;border-radius:3px;margin-left:6px;font-family:Arial">IHR OBJEKT</span>':''}</div>
    <div style="font-size:7.5px;color:#aaa;margin-top:1px;font-family:Arial">${s.sub}</div>
  </td>
  <td style="padding:7px 10px;text-align:right">
    <div style="font-size:9.5px;font-weight:${i===yourSeg?700:400};color:${i===yourSeg?'#344E41':'#888'};font-family:Arial">CHF ${fmt(s.lo)} \u2013 CHF ${fmt(s.hi)}</div>
  </td>
</tr>
</table>`).join('')}

${ft(2)}
<div class="pb"></div>

<!-- ════ SEITE 3 ════ -->
${hdr('Markt & Empfehlung', 3)}

<div style="font-size:11px;font-weight:700;color:#111;padding-bottom:4px;border-bottom:2px solid #344E41;margin-bottom:8px;font-family:Arial">Markt-Kontext</div>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px"><tr>
  <td style="width:49%;padding-right:6px">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9F8F4;border-radius:6px">
    <tr><td style="padding:10px 12px">
      <div style="font-size:6.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:4px;font-family:Arial">&Oslash;-Preis in Ihrer Region</div>
      <div style="font-size:17px;font-weight:800;color:#111;letter-spacing:-.04em;font-family:Arial">CHF ${fmt(Math.round(base*1.04))}/m\u00b2</div>
      <div style="font-size:7.5px;color:#1B6B3E;font-weight:600;margin-top:2px;font-family:Arial">+2.4% in 12 Monaten</div>
      <div style="font-size:7.5px;color:#888;margin-top:2px;font-family:Arial">${vo} Vergleichsobjekte &middot; ${rKm} km Radius</div>
    </td></tr>
    </table>
  </td>
  <td style="width:49%;padding-left:6px">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9F8F4;border-radius:6px">
    <tr><td style="padding:10px 12px">
      <div style="font-size:6.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:4px;font-family:Arial">Markt-Nachfrage</div>
      <div style="font-size:17px;font-weight:800;color:#111;letter-spacing:-.04em;font-family:Arial">Hoch &#8599;</div>
      <div style="font-size:7.5px;color:#1B6B3E;font-weight:600;margin-top:2px;font-family:Arial">Nachfrage ${nf}&times; über Angebot</div>
      <div style="font-size:7.5px;color:#888;margin-top:2px;font-family:Arial">&Oslash; ${vd} Tage Vermarktungsdauer</div>
    </td></tr>
    </table>
  </td>
</tr></table>

<div style="font-size:11px;font-weight:700;color:#111;padding-bottom:4px;border-bottom:2px solid #344E41;margin-bottom:8px;font-family:Arial">Bewertungsgenauigkeit</div>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px"><tr>
${[{l:'Datenbasis',v:Math.min(96,75+feats*1.2+10)},{l:'Vergleichbarkeit',v:Math.min(94,60+Math.round(lm*20))},{l:'Modellkonfidenz',v:Math.min(96,78+Math.round(zm*12))}].map((a,i)=>`
  <td style="width:32%;padding:0 ${i===1?'6px':'0'}">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9F8F4;border-radius:6px">
    <tr><td style="padding:9px 11px">
      <div style="font-size:6.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:5px;font-family:Arial">${a.l}</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:4px"><tr>
        <td style="height:4px;width:${Math.round(a.v)}%;background:#344E41;border-radius:2px 0 0 2px"></td>
        <td style="height:4px;background:#EAEAE4;border-radius:0 2px 2px 0"></td>
      </tr></table>
      <div style="font-size:15px;font-weight:800;color:#344E41;letter-spacing:-.04em;font-family:Arial">${Math.round(a.v)}%</div>
    </td></tr>
    </table>
  </td>`).join('')}
</tr></table>

<div style="font-size:11px;font-weight:700;color:#111;padding-bottom:4px;border-bottom:2px solid #344E41;margin-bottom:8px;font-family:Arial">Altera-Einsch\u00e4tzung</div>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px">
<tr>
  <td style="width:3px;background:#344E41;border-radius:2px;padding:0"></td>
  <td style="background:#EDF1EE;border-radius:0 6px 6px 0;padding:10px 13px">
    <div style="font-size:9.5px;font-weight:700;color:#344E41;margin-bottom:3px;font-family:Arial">Unsere Einsch\u00e4tzung zu Ihrer Immobilie</div>
    <div style="font-size:9px;color:#333;line-height:1.6;font-family:Arial">${insight}</div>
  </td>
</tr>
</table>

${result.vergleichsInserate && result.vergleichsInserate.length > 0 ? `
<div style="font-size:11px;font-weight:700;color:#111;padding-bottom:4px;border-bottom:2px solid #344E41;margin-bottom:8px;font-family:Arial">Vergleichsinserate</div>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;border-collapse:collapse">
<tr style="background:#EDF1EE">
  <td style="padding:4px 7px;font-size:7px;font-weight:700;color:#344E41;font-family:Arial">Objekt</td>
  <td style="padding:4px 7px;font-size:7px;font-weight:700;color:#344E41;font-family:Arial;text-align:right">Preis</td>
  <td style="padding:4px 7px;font-size:7px;font-weight:700;color:#344E41;font-family:Arial;text-align:right">CHF/m²</td>
  <td style="padding:4px 7px;font-size:7px;font-weight:700;color:#344E41;font-family:Arial">Quelle</td>
</tr>
${result.vergleichsInserate.slice(0,5).map((v,i) => `<tr style="background:${i%2===0?'#F9F8F4':'#fff'}">
  <td style="padding:4px 7px;font-size:8px;color:#333;font-family:Arial">${v.beschreibung||'—'}</td>
  <td style="padding:4px 7px;font-size:8px;font-weight:700;color:#111;font-family:Arial;text-align:right">CHF ${(Number(v.preis)||0).toLocaleString('de-CH')}</td>
  <td style="padding:4px 7px;font-size:8px;color:#344E41;font-weight:700;font-family:Arial;text-align:right">${v.preisM2||'—'}</td>
  <td style="padding:4px 7px;font-size:7.5px;color:#888;font-family:Arial">${v.quelle||'—'}</td>
</tr>`).join('')}
</table>` : ''}

<div style="font-size:11px;font-weight:700;color:#111;padding-bottom:4px;border-bottom:2px solid #344E41;margin-bottom:8px;font-family:Arial">Empfehlungen</div>
${(score>=80
  ?['Zeitnahe Vermarktung \u2014 Marktumfeld ist sehr g\u00fcnstig','Professionelle Fotografie f\u00fcr maximale Sichtbarkeit','Preisstrategie mit Altera-Experten abstimmen']
  :['Gezielte Aufwertungsmassnahmen vor dem Verkauf pr\u00fcfen','Energetische Optimierung kann den Wert steigern','Pers\u00f6nliche Vor-Ort-Sch\u00e4tzung f\u00fcr pr\u00e4zise Einsch\u00e4tzung'])
  .map((r,i)=>`<table width="100%" cellpadding="0" cellspacing="0" style="background:${i%2===0?'#F9F8F4':'#fff'};border-radius:4px;margin-bottom:3px"><tr>
  <td style="width:26px;padding:6px 8px;vertical-align:middle">
    <div style="width:16px;height:16px;border-radius:50%;background:#344E41;text-align:center;line-height:16px;font-size:8.5px;font-weight:800;color:#fff;font-family:Arial">${i+1}</div>
  </td>
  <td style="padding:6px 8px;font-size:9px;color:#333;font-family:Arial">${r}</td>
</tr></table>`).join('')}

<!-- CTA -->
<table width="100%" cellpadding="0" cellspacing="0" style="background:#344E41;border-radius:7px;margin-top:10px">
<tr><td style="padding:14px 18px">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td>
      <div style="font-size:11px;font-weight:700;color:#fff;margin-bottom:3px;font-family:Arial">Professionelle Sch\u00e4tzung vor Ort anfragen</div>
      <div style="font-size:8.5px;color:rgba(255,255,255,.6);line-height:1.5;max-width:260px;font-family:Arial">Thierry Matar\u00e9 oder Janis Beerli kommen pers\u00f6nlich zu Ihnen. Bankf\u00e4hig, rechtsg\u00fcltig, unverbindlich.</div>
    </td>
    <td style="text-align:right;padding-left:12px">
      <div style="font-size:12px;font-weight:800;color:#C9A874;font-family:Arial">+41 44 000 00 00</div>
      <div style="font-size:8px;color:rgba(255,255,255,.5);margin-top:2px;font-family:Arial">hallo@altera-immobilien.ch</div>
    </td>
  </tr></table>
</td></tr>
</table>

<!-- Disclaimer -->
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FBF6EE;border-radius:4px;margin-top:8px">
<tr><td style="padding:7px 10px;font-size:7.5px;color:#888;line-height:1.5;font-family:Arial">
  Diese Bewertung basiert auf hedonischer Methodik und aktuellen Marktdaten. Sie dient als Orientierungswert und ersetzt keine pers\u00f6nliche Vor-Ort-Sch\u00e4tzung durch zertifizierte Sachverst\u00e4ndige.
  &copy; ${year} Altera Immobilien GmbH &middot; Seestrasse 88 &middot; 8700 K\u00fcsnacht
</td></tr>
</table>

${ft(3)}

</body>
</html>`;
}

module.exports={buildReportHTML,fmt};
