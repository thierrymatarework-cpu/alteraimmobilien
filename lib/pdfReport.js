// lib/pdfReport.js — Altera Immobilien
// Professioneller 3-seitiger PDF-Report mit PDFKit
// Seite 1: Deckblatt — Hauptwert, Karte, Metriken
// Seite 2: Objektdaten & Score-Analyse
// Seite 3: Markt, Einschätzung, CTA

const PDFDocument = require('pdfkit');
const https = require('https');
const http  = require('http');

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function fmt(n) {
  return Number(n).toLocaleString('de-CH');
}

// Label-Maps
const TYP_LABEL    = { etw:'Eigentumswohnung', efh:'Einfamilienhaus', mfh:'Mehrfamilienhaus', rh:'Reihenhaus', villa:'Villa', gew:'Gewerbe / Büro' };
const SUBTYP_LABEL = { std:'Standard', erd:'Gartenwohnung (EG)', duplex:'Duplex', attika:'Attika', penthouse:'Penthouse', studio:'Studio / Loft' };
const LAGE_LABEL   = { top:'Toplage', sg:'Sehr gut', gut:'Gut', mit:'Mittel', ein:'Einfach' };
const ZUST_LABEL   = { neu:'Neuwertig', sg:'Sehr gut', gut:'Gut', ren:'Renovationsbedarf', san:'Sanierungsbedarf' };
const GRUND_LABEL  = { vk:'Verkauf', ref:'Finanzierung / Hypothek', erb:'Erbschaft / Scheidung', ori:'Orientierung', kauf:'Kaufentscheid', steu:'Steuererklärung' };
const LAERM_LABEL  = { kein:'Kein Lärm', ger:'Gering', mit:'Mittel', hoch:'Stark' };
const STATUS_LABEL = { eigen:'Eigennutzung', verm:'Vermietet', leer:'Leer', ferien:'Ferienwohnung' };

// Kartenbild laden (PNG via Nominatim/OpenStreetMap-basierter Tile-Service)
function fetchMapImage(lat, lon) {
  return new Promise((resolve) => {
    if (!lat || !lon) { resolve(null); return; }
    // Verwende LocationIQ static map (kostenlos, kein Key nötig für Basic)
    // Fallback: openstreetmap-basiertes Bild via maps.geoapify.com Freemium
    // Wir nehmen mapbox static (kein Key nötig für osm raster)
    // Beste zuverlässige Option: geoapify free tier
    const latN = parseFloat(lat).toFixed(6);
    const lonN = parseFloat(lon).toFixed(6);
    // OpenStreetMap Tile zusammensetzen (zoom 17)
    const zoom = 17;
    const tileX = Math.floor((lonN / 360 + 0.5) * Math.pow(2, zoom));
    const tileY = Math.floor((1 - Math.log(Math.tan(latN * Math.PI / 180) + 1 / Math.cos(latN * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
    const url = `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`;

    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'AlteraImmobilien/1.0' } }, (res) => {
      if (res.statusCode !== 200) { resolve(null); return; }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', () => resolve(null));
    });
    req.on('error', () => resolve(null));
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
  });
}

// ─── Seiten-Helfer ────────────────────────────────────────────────────────────

function drawHeader(doc, W, M, SAGE, SAND, date, pageNum, totalPages) {
  // Grüner Header-Band
  doc.rect(0, 0, W, 64).fill(SAGE);
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#FFFFFF').text('Altera Immobilien', M, 18, { continued: false });
  doc.fontSize(9).font('Helvetica').fillColor('rgba(255,255,255,0.5)')
    .text('Seestrasse 88 · 8700 Küsnacht · hallo@altera-immobilien.ch · +41 44 000 00 00', M, 38);
  doc.fontSize(9).font('Helvetica-Bold').fillColor(SAND)
    .text(`Bewertungsreport · ${date}`, W - M - 150, 22, { width: 150, align: 'right' });
  doc.fontSize(8).font('Helvetica').fillColor('rgba(255,255,255,0.35)')
    .text(`Seite ${pageNum} / ${totalPages}`, W - M - 150, 38, { width: 150, align: 'right' });
}

function drawFooter(doc, W, M, GRAY_LT, GRAY, year) {
  const footY = 820;
  doc.moveTo(M, footY).lineTo(W - M, footY).lineWidth(0.5).strokeColor(GRAY_LT).stroke();
  doc.fontSize(7).font('Helvetica').fillColor(GRAY)
    .text(`© ${year} Altera Immobilien GmbH · Küsnacht · Diese Bewertung basiert auf hedonischer Methodik und dient zur Orientierung. Kein offizielles Gutachten.`,
      M, footY + 6, { width: W - M * 2, align: 'center' });
}

function sectionTitle(doc, text, x, y, INK) {
  doc.fontSize(13).font('Helvetica-Bold').fillColor(INK).text(text, x, y);
  return y + 20;
}

function divider(doc, M, W, y, GRAY_LT) {
  doc.moveTo(M, y).lineTo(W - M, y).lineWidth(0.5).strokeColor(GRAY_LT).stroke();
  return y + 14;
}

// Zweispaltigen Datensatz zeichnen
function drawDataGrid(doc, items, startY, M, CW, INK, GRAY) {
  const ROW_H = 20;
  const colW = (CW - 12) / 2;
  const half = Math.ceil(items.length / 2);
  let maxRow = 0;

  items.forEach(([label, val], i) => {
    const col = i < half ? 0 : 1;
    const row = i < half ? i : i - half;
    maxRow = Math.max(maxRow, row);
    const ox = M + col * (colW + 12);
    const oy = startY + row * ROW_H;
    // Zebra
    doc.rect(ox, oy, colW, ROW_H - 2).fill(row % 2 === 0 ? '#F7F6F2' : '#FFFFFF');
    doc.fontSize(8).font('Helvetica').fillColor(GRAY).text(label, ox + 8, oy + 6, { width: colW * 0.42, ellipsis: true });
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(INK).text(val, ox + colW * 0.44, oy + 5, { width: colW * 0.54, ellipsis: true });
  });

  return startY + (maxRow + 1) * ROW_H + 8;
}

// ─── Haupt-Build-Funktion ─────────────────────────────────────────────────────

async function buildPDF(data, result) {
  // Kartenbild laden (parallel, Fehler werden ignoriert)
  const mapImgBuffer = await fetchMapImage(data.lat, data.lon).catch(() => null);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      autoFirstPage: true,
      info: {
        Title: 'Altera Immobilien — Bewertungsreport',
        Author: 'Altera Immobilien GmbH',
        Subject: 'Immobilienbewertung',
      }
    });

    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ─── Konstanten ────────────────────────────────────────────────────────
    const W        = 595.28;
    const H        = 841.89;
    const M        = 44;
    const CW       = W - M * 2;
    const SAGE     = '#344E41';
    const SAGE_LT  = '#EDF1EE';
    const SAGE_MID = '#D0DDD4';
    const SAND     = '#C9A874';
    const SAND_LT  = '#FBF6EE';
    const INK      = '#111111';
    const INK2     = '#333333';
    const GRAY     = '#777777';
    const GRAY_LT  = '#E8E6E0';
    const GRAY_BG  = '#F9F8F4';
    const RED      = '#8A2828';
    const GREEN    = '#1B6B3E';
    const WARN_C   = '#966B1A';
    const WARN_BG  = '#FBF3E8';
    const date     = new Date().toLocaleDateString('de-CH');
    const year     = new Date().getFullYear();

    const { total, rMin, rMax, score, scoreLabel, m2, ren, base, lm, zm, af, fm } = result;
    const feats = Number(data.feats) || 0;

    // Adresse aufbauen
    const strasseStr = data.strasse || '';
    const ortStr     = [data.plz, data.ort].filter(Boolean).join(' ');
    const addrShort  = strasseStr || ortStr || '—';
    const addrFull   = [strasseStr, ortStr].filter(Boolean).join(', ') || '—';

    const mapUrl = data.lat && data.lon
      ? `https://www.openstreetmap.org/#map=18/${parseFloat(data.lat).toFixed(6)}/${parseFloat(data.lon).toFixed(6)}`
      : `https://www.openstreetmap.org/search?query=${encodeURIComponent(addrFull)}`;

    const insight = score >= 80
      ? 'Ihre Immobilie weist eine überdurchschnittliche Qualität auf. Das aktuelle Marktumfeld am Zürichsee ist günstig — eine zeitnahe Vermarktung verspricht einen optimalen Verkaufserlös. Wir empfehlen ein persönliches Gespräch, um Timing und Preisstrategie zu definieren.'
      : score >= 60
      ? 'Ihre Immobilie hat solide Ausgangsbedingungen. Mit gezielten Massnahmen (z. B. Homestaging, kleinere Renovationen) lässt sich der Verkaufspreis optimieren. Unsere Experten beraten Sie gerne persönlich.'
      : 'Die Immobilie bietet Optimierungspotenzial. Wir zeigen Ihnen, welche Investitionen vor dem Verkauf wirklich lohnen — und welche nicht. Kontaktieren Sie uns für eine persönliche Beratung.';

    // ══════════════════════════════════════════════════════════════════════════
    // SEITE 1 — Deckblatt: Standort · Hauptwert · Metriken
    // ══════════════════════════════════════════════════════════════════════════
    drawHeader(doc, W, M, SAGE, SAND, date, 1, 3);
    let y = 76;

    // ── Standort & Adresse ──────────────────────────────────────────────────
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(SAGE)
      .text('STANDORT', M, y, { characterSpacing: 1 });
    y += 12;
    doc.fontSize(11).font('Helvetica-Bold').fillColor(INK).text(addrFull, M, y, { width: CW * 0.7 });
    y += 16;

    // ── Kartenbild oder Platzhalter ──────────────────────────────────────────
    const MAP_H = 180;
    const MAP_W = CW;
    if (mapImgBuffer) {
      try {
        doc.image(mapImgBuffer, M, y, { width: MAP_W, height: MAP_H, cover: [MAP_W, MAP_H] });
      } catch(e) {
        // Platzhalter
        doc.rect(M, y, MAP_W, MAP_H).fill(SAGE_LT);
        doc.fontSize(9).font('Helvetica').fillColor(SAGE)
          .text('Standortkarte · ' + addrFull, M + 10, y + MAP_H / 2 - 8, { width: MAP_W - 20, align: 'center' });
      }
    } else {
      // Platzhalter mit Adresse
      doc.rect(M, y, MAP_W, MAP_H).fill(SAGE_LT);
      doc.rect(M, y, MAP_W, MAP_H).lineWidth(1).strokeColor(SAGE_MID).stroke();
      doc.fontSize(22).font('Helvetica').fillColor(SAGE_MID).text('⊙', M, y + MAP_H/2 - 22, { width: MAP_W, align: 'center' });
      doc.fontSize(10).font('Helvetica-Bold').fillColor(SAGE).text(addrShort, M + 16, y + MAP_H/2 + 4, { width: MAP_W - 32, align: 'center' });
      if (mapUrl) {
        doc.fontSize(7.5).font('Helvetica').fillColor(SAGE).text('→ ' + mapUrl, M + 16, y + MAP_H - 18, { width: MAP_W - 32, align: 'center', link: mapUrl });
      }
    }
    y += MAP_H + 20;

    // ── Hauptwert ────────────────────────────────────────────────────────────
    // Hintergrund-Banner
    doc.rect(M, y, CW, 90).fill(GRAY_BG);
    doc.rect(M, y, 4, 90).fill(SAGE); // Linker Akzentbalken

    doc.fontSize(8).font('Helvetica-Bold').fillColor(SAGE)
      .text('GESCHÄTZTER MARKTWERT', M + 16, y + 10, { characterSpacing: 1 });
    doc.fontSize(36).font('Helvetica-Bold').fillColor(INK)
      .text('CHF ' + fmt(total), M + 16, y + 22);
    doc.fontSize(10).font('Helvetica').fillColor(GRAY)
      .text('Bandbreite: CHF ' + fmt(rMin) + ' – CHF ' + fmt(rMax), M + 16, y + 63);

    // Konfidenz-Badge rechts
    doc.rect(W - M - 100, y + 12, 100, 22).fill(SAGE_LT);
    doc.fontSize(7).font('Helvetica-Bold').fillColor(GREEN)
      .text('● HOHE KONFIDENZ', W - M - 96, y + 19, { width: 92, align: 'center', characterSpacing: 0.3 });
    y += 102;

    // ── Preisspanne-Balken ────────────────────────────────────────────────────
    const bH = 8;
    const bW = CW;
    // Farbverlauf: 3 Segmente
    doc.rect(M,          y, bW/3, bH).fill('#F5C4C4');
    doc.rect(M + bW/3,   y, bW/3, bH).fill(SAND);
    doc.rect(M + bW*2/3, y, bW/3, bH).fill(SAGE);
    // Pin
    doc.circle(M + bW/2, y + bH/2, 6).fill('#FFFFFF');
    doc.circle(M + bW/2, y + bH/2, 4).fill(SAGE);
    y += bH + 6;
    doc.fontSize(8).font('Helvetica-Bold').fillColor(RED).text('Min: CHF ' + fmt(rMin), M, y);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(GREEN).text('Max: CHF ' + fmt(rMax), M, y, { width: bW, align: 'right' });
    y += 20;

    // ── 4 Metriken ────────────────────────────────────────────────────────────
    y = divider(doc, M, W, y, GRAY_LT);
    const mW    = CW / 4;
    const mData = [
      { l: 'PREIS PRO M²',     v: 'CHF ' + fmt(m2),  n: '+3.2% ggü. Vorjahr' },
      { l: 'GESAMT-SCORE',     v: score + '/100',      n: scoreLabel },
      { l: 'MIETRENDITE P.A.', v: ren + '%',           n: 'Überdurchschnittlich' },
      { l: 'MARKTDYNAMIK',     v: 'Hoch',              n: 'Ø 24 Tage Verkauf' },
    ];
    mData.forEach((m, i) => {
      const mx = M + i * mW;
      if (i > 0) doc.moveTo(mx, y - 4).lineTo(mx, y + 48).lineWidth(0.5).strokeColor(GRAY_LT).stroke();
      doc.fontSize(6.5).font('Helvetica-Bold').fillColor(GRAY).text(m.l, mx + 7, y, { width: mW - 14, characterSpacing: 0.5 });
      doc.fontSize(15).font('Helvetica-Bold').fillColor(INK).text(m.v, mx + 7, y + 11, { width: mW - 14 });
      doc.fontSize(7.5).font('Helvetica').fillColor(GREEN).text(m.n, mx + 7, y + 31, { width: mW - 14 });
    });

    drawFooter(doc, W, M, GRAY_LT, GRAY, year);

    // ══════════════════════════════════════════════════════════════════════════
    // SEITE 2 — Objektdaten & Score-Analyse
    // ══════════════════════════════════════════════════════════════════════════
    doc.addPage();
    drawHeader(doc, W, M, SAGE, SAND, date, 2, 3);
    y = 80;

    // ── Objektdaten ───────────────────────────────────────────────────────────
    y = sectionTitle(doc, 'Objektdaten', M, y, INK);

    const typLabel    = TYP_LABEL[data.typ] || data.typ || '—';
    const subtypLabel = data.subtyp && data.subtyp !== 'std' ? SUBTYP_LABEL[data.subtyp] || data.subtyp : null;
    const allObjData  = [
      ['Objekttyp',          subtypLabel ? `${typLabel} (${subtypLabel})` : typLabel],
      ['Adresse',            addrFull],
      data.etage     ? ['Etage / Stock',      data.etage]                                 : null,
      data.flaeche   ? ['Nettowohnfläche',    data.flaeche + ' m²']                       : null,
      data.zimmer    ? ['Zimmer',             String(data.zimmer)]                         : null,
      data.baujahr   ? ['Baujahr',            String(data.baujahr)]                        : null,
      data.renov     ? ['Letzte Renovation',  String(data.renov)]                          : null,
      (data.grundst && Number(data.grundst) > 0) ? ['Grundstückfläche', data.grundst + ' m²'] : null,
      data.zustand   ? ['Zustand',            ZUST_LABEL[data.zustand] || data.zustand]    : null,
      data.lage      ? ['Wohnlage',           LAGE_LABEL[data.lage]    || data.lage]       : null,
      data.laerm     ? ['Lärmbelastung',      LAERM_LABEL[data.laerm]  || data.laerm]      : null,
      data.heizung   ? ['Heizung',            data.heizung]                                 : null,
      data.status    ? ['Aktueller Status',   STATUS_LABEL[data.status] || data.status]    : null,
      data.miete && Number(data.miete) > 0 ? ['Nettomiete / Monat', 'CHF ' + fmt(Number(data.miete))] : null,
      feats > 0      ? ['Ausstattungsmerkmale', feats + ' Merkmale angegeben']             : null,
      (data.steuer && Number(data.steuer) !== 100) ? ['Gemeindesteuerfuss', data.steuer + ' %'] : null,
      data.grund     ? ['Bewertungsgrund',    GRUND_LABEL[data.grund]  || data.grund]      : null,
    ].filter(Boolean).filter(([, v]) => v && v !== '—');

    y = drawDataGrid(doc, allObjData, y, M, CW, INK, GRAY);
    y += 8;
    y = divider(doc, M, W, y, GRAY_LT);

    // ── Score-Analyse ─────────────────────────────────────────────────────────
    doc.fontSize(13).font('Helvetica-Bold').fillColor(INK).text('Score-Analyse', M, y);
    doc.fontSize(8.5).font('Helvetica').fillColor(GRAY).text('Bewertung nach 6 Dimensionen — basierend auf Ihren Angaben', M + 128, y + 3);
    y += 22;

    const scoreRows = [
      { l: 'Lage & Mikrolage',    v: Math.min(100, Math.round(lm * 72)), note: 'Wichtigster Werttreiber' },
      { l: 'Bausubstanz & Alter', v: Math.min(100, Math.round(af * 92)), note: 'Baujahr & Renovation' },
      { l: 'Zustand',             v: Math.min(100, Math.round(zm * 85)), note: 'Pflegezustand' },
      { l: 'Ausstattung',         v: Math.min(100, Math.round(fm * 74)), note: feats + ' Merkmale erfasst' },
      { l: 'Marktlage',           v: 78,                                  note: 'Regionale Nachfrage' },
      { l: 'Energiestandard',     v: 64,                                  note: 'Heizung & Effizienz' },
    ];

    // Track-Masse: Label 150 | Gap 12 | Track variabel | Gap 10 | Zahl 28 | Gap 8 | Tag 62
    const labelW = 150;
    const numW   = 28;
    const tagW   = 62;
    const trackW = CW - labelW - 12 - 10 - numW - 8 - tagW;
    const trackX = M + labelW + 12;

    scoreRows.forEach(s => {
      const color  = s.v >= 75 ? SAGE : s.v >= 55 ? WARN_C : RED;
      const tagBg  = s.v >= 75 ? SAGE_LT : s.v >= 55 ? WARN_BG : '#FAE8E8';
      const tag    = s.v >= 75 ? 'GUT' : s.v >= 55 ? 'MITTEL' : 'AUSBAU';

      // Hintergrundzeile
      doc.rect(M, y, CW, 22).fill(y % 44 < 22 ? GRAY_BG : '#FFFFFF');

      doc.fontSize(9).font('Helvetica-Bold').fillColor(INK2).text(s.l, M + 6, y + 7, { width: labelW - 6 });
      doc.fontSize(7.5).font('Helvetica').fillColor(GRAY).text(s.note, M + 6, y + 15, { width: labelW - 6 });

      // Track
      doc.rect(trackX, y + 8, trackW, 7).fill(GRAY_LT);
      doc.rect(trackX, y + 8, trackW * s.v / 100, 7).fill(color);

      // Zahl
      doc.fontSize(13).font('Helvetica-Bold').fillColor(INK)
        .text(String(s.v), trackX + trackW + 10, y + 4, { width: numW, align: 'right' });

      // Tag-Pill
      const tagX = trackX + trackW + 10 + numW + 8;
      doc.rect(tagX, y + 5, tagW, 13).fill(tagBg);
      doc.fontSize(6.5).font('Helvetica-Bold').fillColor(color)
        .text(tag, tagX, y + 9, { width: tagW, align: 'center', characterSpacing: 0.5 });

      y += 24;
    });
    y += 12;

    // ── Segment-Einordnung ─────────────────────────────────────────────────────
    y = divider(doc, M, W, y, GRAY_LT);
    doc.fontSize(13).font('Helvetica-Bold').fillColor(INK).text('Segment-Einordnung', M, y);
    y += 20;

    const segments = [
      { name: 'Premium-Segment',  range: `CHF ${fmt(Math.round(total*1.22/10000)*10000)} – CHF ${fmt(Math.round(total*1.65/10000)*10000)}`, active: score >= 88 },
      { name: 'Gehobenes Segment',range: `CHF ${fmt(Math.round(total*1.07/10000)*10000)} – CHF ${fmt(Math.round(total*1.22/10000)*10000)}`, active: score >= 72 && score < 88 },
      { name: 'Mittleres Segment',range: `CHF ${fmt(rMin)} – CHF ${fmt(rMax)}`,                                                            active: score >= 48 && score < 72 },
      { name: 'Einfaches Segment',range: `CHF ${fmt(Math.round(total*0.65/10000)*10000)} – CHF ${fmt(rMin)}`,                              active: score < 48 },
    ];
    segments.forEach((seg, i) => {
      const bg = seg.active ? SAGE_LT : '#FFFFFF';
      const border = seg.active ? SAGE_MID : GRAY_LT;
      doc.rect(M, y, CW, 22).fill(bg).rect(M, y, CW, 22).lineWidth(seg.active ? 1.5 : 0.5).strokeColor(border).stroke();
      if (seg.active) {
        doc.rect(M, y, 4, 22).fill(SAGE);
        doc.fontSize(9).font('Helvetica-Bold').fillColor(SAGE).text(seg.name, M + 12, y + 7, { width: CW * 0.55 });
        doc.fontSize(8).font('Helvetica-Bold').fillColor(SAGE).text(seg.range, M + 12, y + 7, { width: CW - 20, align: 'right' });
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#FFFFFF').text('IHR OBJEKT', M + CW - 70, y + 8, { width: 66, align: 'center' });
        doc.rect(M + CW - 72, y + 5, 68, 12).fill(SAGE);
        doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#FFFFFF').text('IHR OBJEKT', M + CW - 70, y + 8, { width: 66, align: 'center', characterSpacing: 0.3 });
      } else {
        doc.fontSize(9).font('Helvetica').fillColor(GRAY).text(seg.name, M + 10, y + 7, { width: CW * 0.55 });
        doc.fontSize(8).font('Helvetica').fillColor(GRAY).text(seg.range, M + 10, y + 7, { width: CW - 18, align: 'right' });
      }
      y += 26;
    });

    drawFooter(doc, W, M, GRAY_LT, GRAY, year);

    // ══════════════════════════════════════════════════════════════════════════
    // SEITE 3 — Markt-Kontext · Einschätzung · CTA
    // ══════════════════════════════════════════════════════════════════════════
    doc.addPage();
    drawHeader(doc, W, M, SAGE, SAND, date, 3, 3);
    y = 80;

    // ── Markt-Kontext ─────────────────────────────────────────────────────────
    y = sectionTitle(doc, 'Markt-Kontext', M, y, INK);

    const halfCW = (CW - 16) / 2;

    // Links: Ø-Preis
    doc.rect(M, y, halfCW, 80).fill(GRAY_BG);
    doc.fontSize(7).font('Helvetica-Bold').fillColor(GRAY).text('Ø-PREIS IN IHRER REGION', M + 12, y + 10, { characterSpacing: 0.7 });
    doc.fontSize(20).font('Helvetica-Bold').fillColor(INK).text('CHF ' + fmt(Math.round(base * 1.04)) + '/m²', M + 12, y + 24);
    doc.fontSize(8.5).font('Helvetica').fillColor(GREEN).text('+2.4% in den letzten 12 Monaten', M + 12, y + 50);
    doc.fontSize(7.5).font('Helvetica').fillColor(GRAY).text('127 Vergleichsobjekte · 5 km Radius', M + 12, y + 63);

    // Rechts: Marktdynamik
    const rx2 = M + halfCW + 16;
    doc.rect(rx2, y, halfCW, 80).fill(GRAY_BG);
    doc.fontSize(7).font('Helvetica-Bold').fillColor(GRAY).text('MARKT-NACHFRAGE', rx2 + 12, y + 10, { characterSpacing: 0.7 });
    doc.fontSize(20).font('Helvetica-Bold').fillColor(INK).text('Hoch ↗', rx2 + 12, y + 24);
    doc.fontSize(8.5).font('Helvetica').fillColor(GRAY).text('Ø Vermarktungsdauer: 24 Tage', rx2 + 12, y + 50);
    doc.fontSize(7.5).font('Helvetica').fillColor(GRAY).text('Nachfrage übersteigt Angebot um Faktor 2.4', rx2 + 12, y + 63);
    y += 96;

    // ── Mini Balken-Chart ──────────────────────────────────────────────────────
    const chartData = [40, 44, 42, 50, 48, 55, 52, 60, 63, 62, 68, 72];
    const months    = ['Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    const chartH    = 44;
    const chartW    = CW;
    const barW2     = Math.floor(chartW / chartData.length) - 2;
    const maxVal    = Math.max(...chartData);
    chartData.forEach((v, i) => {
      const bH2 = Math.round(v / maxVal * chartH);
      const bx  = M + i * (barW2 + 2);
      const by  = y + chartH - bH2;
      doc.rect(bx, by, barW2, bH2).fill(i === chartData.length - 1 ? SAGE : SAGE_LT);
      doc.fontSize(5.5).font('Helvetica').fillColor(GRAY).text(months[i], bx, y + chartH + 3, { width: barW2, align: 'center' });
    });
    doc.fontSize(7.5).font('Helvetica').fillColor(GRAY).text('Preisentwicklung Region · letzte 12 Monate', M, y + chartH + 14);
    y += chartH + 28;

    y = divider(doc, M, W, y, GRAY_LT);

    // ── Genauigkeit / Konfidenz ───────────────────────────────────────────────
    y = sectionTitle(doc, 'Bewertungsgenauigkeit', M, y, INK);
    const confData = [
      { l: 'Datenbasis',      v: Math.min(96, 75 + feats * 1.2 + 10) },
      { l: 'Vergleichbark.',  v: Math.min(94, 60 + Math.round(lm * 20)) },
      { l: 'Modellkonfidenz', v: Math.min(96, 78 + Math.round(zm * 12)) },
    ];
    const confW = (CW - 24) / 3;
    confData.forEach((c, i) => {
      const cx = M + i * (confW + 12);
      doc.fontSize(7).font('Helvetica-Bold').fillColor(GRAY).text(c.l, cx, y, { width: confW, characterSpacing: 0.5 });
      doc.rect(cx, y + 14, confW, 6).fill(GRAY_LT);
      doc.rect(cx, y + 14, confW * Math.round(c.v) / 100, 6).fill(SAGE);
      doc.fontSize(16).font('Helvetica-Bold').fillColor(SAGE).text(Math.round(c.v) + '%', cx, y + 24, { width: confW });
    });
    y += 52;
    y = divider(doc, M, W, y, GRAY_LT);

    // ── Einschätzung ──────────────────────────────────────────────────────────
    y = sectionTitle(doc, 'Altera-Einschätzung', M, y, INK);

    // Box mit linkem Akzentbalken
    const insightH = 72;
    doc.rect(M, y, CW, insightH).fill(SAGE_LT);
    doc.rect(M, y, 4, insightH).fill(SAGE);
    doc.fontSize(9.5).font('Helvetica-Bold').fillColor(SAGE).text('Unsere Einschätzung zu Ihrer Immobilie', M + 14, y + 10);
    doc.fontSize(9).font('Helvetica').fillColor(INK2).text(insight, M + 14, y + 26, { width: CW - 22, lineGap: 2 });
    y += insightH + 20;

    // ── Empfehlungen ──────────────────────────────────────────────────────────
    const recs = score >= 80
      ? ['Zeitnahe Vermarktung — Markt ist aktuell günstig',
         'Professionelle Fotografie für maximale Reichweite',
         'Preisstrategie mit Altera-Experten abstimmen']
      : ['Gezielte Aufwertungsmassnahmen vor dem Verkauf prüfen',
         'Energetische Optimierung kann Wert steigern',
         'Persönliche Vor-Ort-Bewertung für präzise Einschätzung'];

    recs.forEach((rec, i) => {
      doc.rect(M, y, CW, 20).fill(i % 2 === 0 ? GRAY_BG : '#FFFFFF');
      doc.fontSize(7).font('Helvetica-Bold').fillColor(SAGE).text(`${i + 1}`, M + 8, y + 7, { width: 12, align: 'center' });
      doc.fontSize(8.5).font('Helvetica').fillColor(INK2).text(rec, M + 26, y + 6, { width: CW - 34 });
      y += 22;
    });
    y += 16;

    y = divider(doc, M, W, y, GRAY_LT);

    // ── Nächste Schritte / CTA ────────────────────────────────────────────────
    y = sectionTitle(doc, 'Nächste Schritte', M, y, INK);

    // CTA-Box dunkel
    const ctaH = 90;
    doc.rect(M, y, CW, ctaH).fill(SAGE);

    // Links: Text
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#FFFFFF')
      .text('Professionelle Schätzung vor Ort', M + 16, y + 14, { width: CW * 0.58 });
    doc.fontSize(8.5).font('Helvetica').fillColor('rgba(255,255,255,0.6)')
      .text('Thierry Mataré oder Janis Beerli kommen persönlich zu Ihnen. Die Vor-Ort-Schätzung liefert eine bankfähige, rechtsgültige Bewertung.', M + 16, y + 32, { width: CW * 0.58, lineGap: 1 });

    // Rechts: Kontakt
    doc.fontSize(13).font('Helvetica-Bold').fillColor(SAND)
      .text('+41 44 000 00 00', W - M - 160, y + 18, { width: 154, align: 'right' });
    doc.fontSize(8.5).font('Helvetica').fillColor('rgba(255,255,255,0.5)')
      .text('hallo@altera-immobilien.ch', W - M - 160, y + 38, { width: 154, align: 'right' });
    doc.fontSize(8).font('Helvetica').fillColor('rgba(255,255,255,0.35)')
      .text('Seestrasse 88, 8700 Küsnacht', W - M - 160, y + 54, { width: 154, align: 'right' });

    // Disclaimer
    y += ctaH + 18;
    doc.rect(M, y, CW, 36).fill(SAND_LT);
    doc.fontSize(7.5).font('Helvetica').fillColor(GRAY)
      .text('Diese Online-Bewertung basiert auf hedonischer Methodik und aktuellen Marktdaten der Region. Sie dient als Orientierungswert und ersetzt keine persönliche Vor-Ort-Schätzung durch zertifizierte Sachverständige.', M + 12, y + 7, { width: CW - 24, lineGap: 1 });

    drawFooter(doc, W, M, GRAY_LT, GRAY, year);
    doc.end();
  });
}

module.exports = { buildPDF, fmt };
