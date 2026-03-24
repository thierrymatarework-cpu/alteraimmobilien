// lib/pdfReport.js — Altera Immobilien
// Professioneller PDF-Report mit PDFKit
// Enthält: Objektdaten, Wert, Score, Markt, Standort-Map-URL, Einschätzung

const PDFDocument = require('pdfkit');

function fmt(n) {
  return Number(n).toLocaleString('de-CH');
}

// Label-Maps für lesbare Ausgabe im PDF
const TYP_LABEL    = { etw:'Eigentumswohnung', efh:'Einfamilienhaus', mfh:'Mehrfamilienhaus', rh:'Reihenhaus', villa:'Villa', gew:'Gewerbe/Büro' };
const SUBTYP_LABEL = { std:'Standard', erd:'Gartenwohnung (EG)', duplex:'Duplex', attika:'Attika', penthouse:'Penthouse', studio:'Studio/Loft' };
const LAGE_LABEL   = { top:'Toplage', sg:'Sehr gut', gut:'Gut', mit:'Mittel', ein:'Einfach' };
const ZUST_LABEL   = { neu:'Neuwertig', sg:'Sehr gut', gut:'Gut', ren:'Renovationsbedarf', san:'Sanierungsbedarf' };
const GRUND_LABEL  = { vk:'Verkauf', ref:'Finanzierung/Hypothek', erb:'Erbschaft/Scheidung', ori:'Orientierung', kauf:'Kaufentscheid', steu:'Steuererklärung' };
const LAERM_LABEL  = { kein:'Kein Lärm', ger:'Gering', mit:'Mittel', hoch:'Stark' };

function buildPDF(data, result) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, info: {
      Title: 'Altera Immobilien — Bewertungsreport',
      Author: 'Altera Immobilien GmbH',
    }});

    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ─── Konstanten ────────────────────────────────────────────────
    const W = 595.28;
    const M = 44;
    const CW = W - M * 2;  // content width
    const SAGE       = '#344E41';
    const SAGE_LT    = '#EDF1EE';
    const SAND       = '#C9A874';
    const INK        = '#111111';
    const INK2       = '#444444';
    const GRAY       = '#888888';
    const GRAY_LT    = '#EAEAE4';
    const RED        = '#8A2828';
    const GREEN      = '#1B6B3E';
    const WARN_BG    = '#FBF3E8';
    const date       = new Date().toLocaleDateString('de-CH');
    const year       = new Date().getFullYear();

    const { total, rMin, rMax, score, scoreLabel, m2, ren, base, lm, zm, af, fm } = result;
    const feats = Number(data.feats) || 0;
    const addrFull = [data.strasse, data.plz && data.ort ? `${data.plz} ${data.ort}` : (data.plz || data.ort)].filter(Boolean).join(', ') || '—';

    // Map-URL für Standort (statische Karte via OpenStreetMap)
    let mapUrl = '';
    if (data.lat && data.lon) {
      mapUrl = `https://www.openstreetmap.org/#map=18/${data.lat}/${data.lon}`;
    } else if (data.plz) {
      mapUrl = `https://www.openstreetmap.org/search?query=${encodeURIComponent(addrFull)}`;
    }

    let y = 0;

    // ══════════════════════════════════════════════════════════════
    // SEITE 1
    // ══════════════════════════════════════════════════════════════

    // ─── HEADER BAND ──────────────────────────────────────────────
    doc.rect(0, 0, W, 70).fill(SAGE);
    doc.fontSize(20).font('Helvetica-Bold').fillColor('#FFFFFF').text('Altera Immobilien', M, 20);
    doc.fontSize(10).font('Helvetica').fillColor('rgba(255,255,255,0.55)').text('Seestrasse 88 · 8700 Küsnacht · hallo@altera-immobilien.ch', M, 42);
    doc.fontSize(10).font('Helvetica-Bold').fillColor(SAND).text('Bewertungsreport · ' + date, W - M - 160, 28, { width: 160, align: 'right' });
    y = 86;

    // ─── ADRESSE & KONFIDENZ ──────────────────────────────────────
    doc.fontSize(10).font('Helvetica').fillColor(GRAY).text(addrFull, M, y);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(GREEN)
      .text('● HOHE KONFIDENZ · 127 Vergleichsobjekte', W - M - 200, y + 1, { width: 200, align: 'right', characterSpacing: 0.4 });
    y += 18;

    // ─── HAUPTWERT ────────────────────────────────────────────────
    doc.fontSize(9).font('Helvetica-Bold').fillColor(SAGE)
      .text('GESCHÄTZTER MARKTWERT', M, y, { characterSpacing: 1 });
    y += 14;
    doc.fontSize(48).font('Helvetica-Bold').fillColor(INK).text('CHF ' + fmt(total), M, y);
    y += 55;
    doc.fontSize(11).font('Helvetica').fillColor(GRAY).text('Bandbreite: CHF ' + fmt(rMin) + ' – CHF ' + fmt(rMax), M, y);
    y += 20;

    // Range bar
    const bW = CW, bH = 7;
    const seg = bW / 3;
    doc.rect(M,         y, seg,   bH).fill('#F5C4C4');
    doc.rect(M + seg,   y, seg,   bH).fill(SAND);
    doc.rect(M + seg*2, y, seg,   bH).fill(SAGE);
    doc.circle(M + bW/2, y + bH/2, 5.5).fill('#FFFFFF');
    doc.circle(M + bW/2, y + bH/2, 3.5).fill(SAGE);
    y += bH + 8;
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(RED).text('Min: CHF ' + fmt(rMin), M, y);
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(GREEN).text('Max: CHF ' + fmt(rMax), M, y, { width: bW, align: 'right' });
    y += 20;

    // ─── Trennlinie ────────────────────────────────────────────────
    doc.moveTo(M, y).lineTo(W - M, y).lineWidth(0.5).strokeColor(GRAY_LT).stroke();
    y += 14;

    // ─── METRIKEN ─────────────────────────────────────────────────
    const mW = CW / 4;
    const metrics = [
      { l: 'PREIS PRO M²',    v: 'CHF ' + fmt(m2), n: '+3.2% ggü. Vorjahr',  nc: GREEN },
      { l: 'GESAMT-SCORE',    v: score + '/100',    n: scoreLabel,             nc: GREEN },
      { l: 'MIETRENDITE P.A.',v: ren + '%',         n: 'Überdurchschnittlich', nc: GREEN },
      { l: 'MARKTDYNAMIK',    v: 'Hoch ↗',         n: 'Ø 24 Tage Verkauf',   nc: GREEN },
    ];
    metrics.forEach((m, i) => {
      const mx = M + i * mW;
      if (i > 0) doc.moveTo(mx, y - 4).lineTo(mx, y + 50).lineWidth(0.5).strokeColor(GRAY_LT).stroke();
      doc.fontSize(7).font('Helvetica-Bold').fillColor(GRAY).text(m.l, mx + 7, y, { width: mW - 14, characterSpacing: 0.6 });
      doc.fontSize(17).font('Helvetica-Bold').fillColor(INK).text(m.v, mx + 7, y + 11, { width: mW - 14 });
      doc.fontSize(8).font('Helvetica').fillColor(m.nc).text(m.n, mx + 7, y + 33, { width: mW - 14 });
    });
    y += 56;

    doc.moveTo(M, y).lineTo(W - M, y).lineWidth(0.5).strokeColor(GRAY_LT).stroke();
    y += 14;

    // ─── OBJEKTDATEN ÜBERSICHT ─────────────────────────────────────
    doc.fontSize(13).font('Helvetica-Bold').fillColor(INK).text('Objektdaten', M, y);
    y += 18;

    const objData = [
      ['Objekttyp',      TYP_LABEL[data.typ] || data.typ || '—'],
      ['Wohnungstyp',    data.subtyp && data.subtyp !== 'std' ? SUBTYP_LABEL[data.subtyp] || data.subtyp : '—'],
      ['Adresse',        addrFull],
      ['Etage',          data.etage || '—'],
      ['Nettowohnfläche',data.flaeche ? data.flaeche + ' m²' : '—'],
      ['Zimmer',         data.zimmer || '—'],
      ['Baujahr',        data.baujahr || '—'],
      ['Letzte Renovation', data.renov || '—'],
      ['Grundstückfläche', data.grundst && Number(data.grundst) > 0 ? data.grundst + ' m²' : '—'],
    ].filter(([,v]) => v && v !== '—');

    const half = Math.ceil(objData.length / 2);
    const colW = CW / 2 - 8;

    objData.forEach(([label, val], i) => {
      const col = i < half ? 0 : 1;
      const row = i < half ? i : i - half;
      const ox = M + col * (colW + 16);
      const oy = y + row * 18;
      doc.rect(ox, oy, colW, 16).fill(row % 2 === 0 ? '#F9F8F4' : '#FFFFFF');
      doc.fontSize(8).font('Helvetica').fillColor(GRAY).text(label, ox + 6, oy + 4, { width: colW * 0.45 });
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor(INK).text(val, ox + colW * 0.46, oy + 4, { width: colW * 0.52 });
    });
    y += Math.max(half, objData.length - half) * 18 + 14;

    const objData2 = [
      ['Zustand',        ZUST_LABEL[data.zustand] || data.zustand || '—'],
      ['Wohnlage',       LAGE_LABEL[data.lage] || data.lage || '—'],
      ['Lärmbelastung',  LAERM_LABEL[data.laerm] || data.laerm || '—'],
      ['Heizung',        data.heizung || '—'],
      ['Bewertungsgrund',GRUND_LABEL[data.grund] || data.grund || '—'],
      ['Ausstattung',    feats > 0 ? feats + ' Merkmale angegeben' : '—'],
      ['Aktueller Status',data.status || '—'],
      ['Steuerfuss',     data.steuer && Number(data.steuer) !== 100 ? data.steuer + ' %' : '—'],
    ].filter(([,v]) => v && v !== '—');

    const half2 = Math.ceil(objData2.length / 2);
    objData2.forEach(([label, val], i) => {
      const col = i < half2 ? 0 : 1;
      const row = i < half2 ? i : i - half2;
      const ox = M + col * (colW + 16);
      const oy = y + row * 18;
      doc.rect(ox, oy, colW, 16).fill(row % 2 === 0 ? '#F9F8F4' : '#FFFFFF');
      doc.fontSize(8).font('Helvetica').fillColor(GRAY).text(label, ox + 6, oy + 4, { width: colW * 0.45 });
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor(INK).text(val, ox + colW * 0.46, oy + 4, { width: colW * 0.52 });
    });
    y += Math.max(half2, objData2.length - half2) * 18 + 16;

    doc.moveTo(M, y).lineTo(W - M, y).lineWidth(0.5).strokeColor(GRAY_LT).stroke();
    y += 14;

    // ─── SCORE ANALYSE ────────────────────────────────────────────
    doc.fontSize(13).font('Helvetica-Bold').fillColor(INK).text('Score-Analyse', M, y);
    doc.fontSize(8.5).font('Helvetica').fillColor(GRAY).text('Bewertung nach 6 Dimensionen', M + 120, y + 3);
    y += 18;

    const scores = [
      { l: 'Lage & Mikrolage',    v: Math.min(100, Math.round(lm * 72)) },
      { l: 'Bausubstanz & Alter', v: Math.min(100, Math.round(af * 92)) },
      { l: 'Zustand',             v: Math.min(100, Math.round(zm * 85)) },
      { l: 'Ausstattung',         v: Math.min(100, Math.round(fm * 74)) },
      { l: 'Marktlage',           v: 78 },
      { l: 'Energiestandard',     v: 64 },
    ];

    const trackW = CW - 160 - 44 - 60;
    scores.forEach(s => {
      const color = s.v >= 75 ? SAGE : s.v >= 55 ? '#966B1A' : RED;
      const tagBg = s.v >= 75 ? SAGE_LT : s.v >= 55 ? WARN_BG : '#FAE8E8';
      const tag   = s.v >= 75 ? 'Gut' : s.v >= 55 ? 'Mittel' : 'Ausbau';

      doc.fontSize(9.5).font('Helvetica').fillColor(INK2).text(s.l, M, y + 3, { width: 155 });
      doc.rect(M + 160, y + 4, trackW, 7).fill(GRAY_LT);
      doc.rect(M + 160, y + 4, trackW * s.v / 100, 7).fill(color);
      doc.fontSize(12).font('Helvetica-Bold').fillColor(INK).text(String(s.v), M + 160 + trackW + 7, y, { width: 34, align: 'right' });
      doc.rect(M + 160 + trackW + 44, y, 56, 15).fill(tagBg);
      doc.fontSize(6.5).font('Helvetica-Bold').fillColor(color)
        .text(tag.toUpperCase(), M + 160 + trackW + 45, y + 4, { width: 54, align: 'center', characterSpacing: 0.5 });
      y += 20;
    });
    y += 8;

    // ─── MARKT ────────────────────────────────────────────────────
    doc.moveTo(M, y).lineTo(W - M, y).lineWidth(0.5).strokeColor(GRAY_LT).stroke();
    y += 12;
    doc.fontSize(13).font('Helvetica-Bold').fillColor(INK).text('Markt-Kontext', M, y);
    y += 16;

    const hW = CW / 2 - 8;
    doc.fontSize(7).font('Helvetica-Bold').fillColor(GRAY).text('Ø-PREIS REGION', M, y, { characterSpacing: 0.7 });
    doc.fontSize(16).font('Helvetica-Bold').fillColor(INK).text('CHF ' + fmt(Math.round(base * 1.04)) + '/m²', M, y + 11);
    doc.fontSize(8).font('Helvetica').fillColor(GREEN).text('+2.4% in 12 Monaten', M, y + 31);

    const r2x = M + hW + 16;
    doc.fontSize(7).font('Helvetica-Bold').fillColor(GRAY).text('MARKT-NACHFRAGE', r2x, y, { characterSpacing: 0.7 });
    doc.fontSize(16).font('Helvetica-Bold').fillColor(INK).text('Hoch ↗', r2x, y + 11);
    doc.fontSize(8).font('Helvetica').fillColor(GRAY).text('Ø 24 Tage · Nachfrage 2.4× über Angebot', r2x, y + 31, { width: hW });
    y += 52;

    // ─── STANDORT ────────────────────────────────────────────────
    doc.moveTo(M, y).lineTo(W - M, y).lineWidth(0.5).strokeColor(GRAY_LT).stroke();
    y += 12;
    doc.fontSize(13).font('Helvetica-Bold').fillColor(INK).text('Standort', M, y);
    y += 16;
    doc.fontSize(9).font('Helvetica').fillColor(INK2).text(addrFull, M, y);
    y += 14;
    if (mapUrl) {
      doc.fontSize(8.5).font('Helvetica').fillColor(GRAY).text('Satellitenansicht: ', M, y);
      doc.fillColor(SAGE).text(mapUrl, M + 76, y, { link: mapUrl, underline: true });
    }
    y += 20;

    // ─── EINSCHÄTZUNG ─────────────────────────────────────────────
    const insight = score >= 80
      ? 'Ihre Immobilie zeigt eine überdurchschnittliche Qualität. Das aktuelle Marktumfeld am Zürichsee ist günstig — eine zeitnahe Vermarktung verspricht einen optimalen Erlös. Wir empfehlen ein persönliches Gespräch, um die optimale Preisstrategie zu definieren.'
      : score >= 60
      ? 'Ihre Immobilie hat solide Ausgangsbedingungen. Mit gezielten Massnahmen lässt sich der Verkaufspreis weiter optimieren. Unsere Experten beraten Sie gerne persönlich.'
      : 'Es gibt echtes Optimierungspotenzial. Wir zeigen Ihnen, welche Massnahmen sich vor einem Verkauf lohnen.';

    doc.rect(M, y, CW, 50).fill(SAGE_LT);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(SAGE).text('Altera-Einschätzung', M + 12, y + 8);
    doc.fontSize(8.5).font('Helvetica').fillColor(INK2).text(insight, M + 12, y + 22, { width: CW - 24 });
    y += 62;

    // ─── CTA ──────────────────────────────────────────────────────
    doc.rect(M, y, CW, 55).fill(SAGE);
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#FFFFFF').text('Professionelle Schätzung vor Ort', M + 14, y + 10);
    doc.fontSize(8.5).font('Helvetica').fillColor('rgba(255,255,255,0.6)')
      .text('Thierry oder Janis kommen persönlich zu Ihnen. Bankfähig, unverbindlich.', M + 14, y + 26, { width: CW * 0.58 });
    doc.fontSize(12).font('Helvetica-Bold').fillColor(SAND)
      .text('+41 44 000 00 00', M + CW * 0.62, y + 10, { width: CW * 0.36, align: 'right' });
    doc.fontSize(8.5).font('Helvetica').fillColor('rgba(255,255,255,0.5)')
      .text('hallo@altera-immobilien.ch', M + CW * 0.62, y + 28, { width: CW * 0.36, align: 'right' });
    y += 68;

    // ─── FOOTER ───────────────────────────────────────────────────
    doc.moveTo(M, y).lineTo(W - M, y).lineWidth(0.5).strokeColor(GRAY_LT).stroke();
    y += 7;
    doc.fontSize(7).font('Helvetica').fillColor(GRAY)
      .text(`© ${year} Altera Immobilien GmbH · Küsnacht am Zürichsee · Diese Bewertung basiert auf hedonischer Methodik und dient zur Orientierung. Kein offizielles Gutachten im rechtlichen Sinne.`,
        M, y, { width: CW });

    doc.end();
  });
}

module.exports = { buildPDF, fmt };
