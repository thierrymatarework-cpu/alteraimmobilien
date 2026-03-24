// lib/pdfReport.js
// Generiert einen professionellen PDF-Report mit PDFKit
// Läuft zuverlässig auf Vercel ohne Browser-Abhängigkeiten

const PDFDocument = require('pdfkit');

function fmt(n) {
  return Number(n).toLocaleString('de-CH');
}

function buildPDF(data, result) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      info: {
        Title: 'Altera Immobilien — Bewertungsreport',
        Author: 'Altera Immobilien GmbH',
      }
    });

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ─── Farben & Masse ─────────────────────────────────────────────
    const W = 595.28, H = 841.89; // A4 in Punkten
    const M = 48; // Margin
    const SAGE   = '#344E41';
    const SAND   = '#C9A874';
    const SAGELIGHT = '#EDF1EE';
    const INK    = '#111111';
    const GRAY   = '#888888';
    const LIGHTGRAY = '#EAEAE4';
    const RED    = '#8A2828';
    const GREEN  = '#1B6B3E';

    const { total, rMin, rMax, score, scoreLabel, m2, ren, base, lm, zm, af, fm } = result;
    const feats = Number(data.feats) || 0;
    const date = new Date().toLocaleDateString('de-CH');
    const year = new Date().getFullYear();

    // Adresse zusammensetzen
    const addrLine = [data.strasse, data.plz, data.ort].filter(Boolean).join(', ') || `PLZ ${data.plz || '—'}`;

    // ─── HEADER BAND ────────────────────────────────────────────────
    doc.rect(0, 0, W, 72).fill(SAGE);
    doc.fontSize(20).font('Helvetica-Bold').fillColor('#FFFFFF')
      .text('Altera Immobilien', M, 24);
    doc.fontSize(10).font('Helvetica').fillColor('rgba(255,255,255,0.6)')
      .text('Bewertungsreport · ' + date, M, 50);
    doc.fontSize(10).font('Helvetica').fillColor(SAND)
      .text('Hohe Konfidenz ✓', W - M - 100, 38, { width: 100, align: 'right' });

    let y = 90;

    // ─── ADRESSE ────────────────────────────────────────────────────
    doc.fontSize(11).font('Helvetica').fillColor(GRAY)
      .text(addrLine, M, y);
    y += 16;

    // ─── HAUPTWERT ──────────────────────────────────────────────────
    doc.fontSize(9).font('Helvetica-Bold').fillColor(SAGE)
      .text('GESCHÄTZTER MARKTWERT', M, y, { characterSpacing: 1 });
    y += 14;

    doc.fontSize(44).font('Helvetica-Bold').fillColor(INK)
      .text('CHF ' + fmt(total), M, y);
    y += 52;

    doc.fontSize(11).font('Helvetica').fillColor(GRAY)
      .text('Bandbreite: CHF ' + fmt(rMin) + ' – CHF ' + fmt(rMax), M, y);
    y += 18;

    // Min/Max Balken
    const barX = M, barW = W - M * 2, barH = 8;
    doc.rect(barX, y, barW, barH).fill(LIGHTGRAY);
    // Gradient-ähnlich: rot → gold → grün
    const seg = barW / 3;
    doc.rect(barX,        y, seg, barH).fill('#F5C4C4');
    doc.rect(barX + seg,  y, seg, barH).fill(SAND);
    doc.rect(barX + seg*2, y, seg, barH).fill(SAGE);

    // Pin in der Mitte
    const pinX = barX + barW / 2;
    doc.circle(pinX, y + barH/2, 6).lineWidth(2).stroke('#FFFFFF').fill(SAGE);

    y += barH + 10;
    doc.fontSize(9).font('Helvetica-Bold').fillColor(RED).text('Min: CHF ' + fmt(rMin), M, y);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(GREEN).text('Max: CHF ' + fmt(rMax), M, y, { width: barW, align: 'right' });
    y += 22;

    // ─── TRENNLINIE ─────────────────────────────────────────────────
    doc.moveTo(M, y).lineTo(W - M, y).lineWidth(0.5).stroke(LIGHTGRAY);
    y += 16;

    // ─── METRIKEN (4 Felder) ────────────────────────────────────────
    const mW = (W - M * 2) / 4;
    const metrics = [
      { label: 'PREIS PRO M²', value: 'CHF ' + fmt(m2), note: '↑ +3.2% ggü. Vorjahr' },
      { label: 'GESAMT-SCORE', value: score + '/100',   note: scoreLabel },
      { label: 'MIETRENDITE P.A.', value: ren + '%',   note: 'Überdurchschnittlich' },
      { label: 'MARKTDYNAMIK',   value: 'Hoch ↗',     note: 'Ø 24 Tage Verkauf' },
    ];
    // Hintergrundboxen
    metrics.forEach((m, i) => {
      const mx = M + i * mW;
      if(i > 0) doc.moveTo(mx, y - 4).lineTo(mx, y + 56).lineWidth(0.5).stroke(LIGHTGRAY);
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(GRAY)
        .text(m.label, mx + 8, y, { width: mW - 16, characterSpacing: 0.8 });
      doc.fontSize(18).font('Helvetica-Bold').fillColor(INK)
        .text(m.value, mx + 8, y + 12, { width: mW - 16 });
      doc.fontSize(8.5).font('Helvetica').fillColor(GREEN)
        .text(m.note, mx + 8, y + 34, { width: mW - 16 });
    });
    y += 62;

    doc.moveTo(M, y).lineTo(W - M, y).lineWidth(0.5).stroke(LIGHTGRAY);
    y += 16;

    // ─── SCORE ANALYSE ──────────────────────────────────────────────
    doc.fontSize(14).font('Helvetica-Bold').fillColor(INK).text('Score-Analyse', M, y);
    doc.fontSize(9).font('Helvetica').fillColor(GRAY).text('Bewertung nach 6 Dimensionen', M + 130, y + 3);
    y += 22;

    const scoreData = [
      { label: 'Lage & Mikrolage',    val: Math.min(100, Math.round(lm * 72)) },
      { label: 'Bausubstanz & Alter', val: Math.min(100, Math.round(af * 92)) },
      { label: 'Zustand',             val: Math.min(100, Math.round(zm * 85)) },
      { label: 'Ausstattung',         val: Math.min(100, Math.round(fm * 74)) },
      { label: 'Marktlage',           val: 78 },
      { label: 'Energiestandard',     val: 64 },
    ];

    const sbW = (W - M * 2 - 160 - 40 - 60) ; // track width
    scoreData.forEach(s => {
      const color = s.val >= 75 ? SAGE : s.val >= 55 ? '#966B1A' : RED;
      const tag   = s.val >= 75 ? 'Gut' : s.val >= 55 ? 'Mittel' : 'Ausbau';

      doc.fontSize(10).font('Helvetica').fillColor(INK)
        .text(s.label, M, y + 3, { width: 155 });

      // Track background
      doc.rect(M + 160, y + 4, sbW, 7).fill(LIGHTGRAY);
      // Fill
      doc.rect(M + 160, y + 4, sbW * s.val / 100, 7).fill(color);

      // Number
      doc.fontSize(13).font('Helvetica-Bold').fillColor(INK)
        .text(String(s.val), M + 160 + sbW + 8, y, { width: 30, align: 'right' });

      // Tag pill (simulated)
      const tagBg = s.val >= 75 ? SAGELIGHT : s.val >= 55 ? '#FBF3E8' : '#FAE8E8';
      doc.rect(M + 160 + sbW + 44, y, 56, 16).fill(tagBg);
      doc.fontSize(7).font('Helvetica-Bold').fillColor(color)
        .text(tag.toUpperCase(), M + 160 + sbW + 46, y + 5, { width: 52, align: 'center', characterSpacing: 0.5 });

      y += 22;
    });

    y += 10;
    doc.moveTo(M, y).lineTo(W - M, y).lineWidth(0.5).stroke(LIGHTGRAY);
    y += 16;

    // ─── MARKT-KONTEXT ───────────────────────────────────────────────
    doc.fontSize(14).font('Helvetica-Bold').fillColor(INK).text('Markt-Kontext', M, y);
    y += 20;

    const halfW = (W - M * 2 - 16) / 2;
    // Links
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(GRAY).text('Ø-PREIS REGION', M, y, { characterSpacing: 0.8 });
    doc.fontSize(18).font('Helvetica-Bold').fillColor(INK).text('CHF ' + fmt(Math.round(base * 1.04)) + '/m²', M, y + 12);
    doc.fontSize(8.5).font('Helvetica').fillColor(GREEN).text('+2.4% in den letzten 12 Monaten', M, y + 34);

    // Rechts
    const rx = M + halfW + 16;
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(GRAY).text('MARKT-NACHFRAGE', rx, y, { characterSpacing: 0.8 });
    doc.fontSize(18).font('Helvetica-Bold').fillColor(INK).text('Hoch ↗', rx, y + 12);
    doc.fontSize(8.5).font('Helvetica').fillColor(GRAY).text('Ø 24 Tage Vermarktung · Nachfrage 2.4× über Angebot', rx, y + 34, { width: halfW });

    y += 60;

    // ─── ALTERA EINSCHÄTZUNG ─────────────────────────────────────────
    const insight = score >= 80
      ? 'Ihre Immobilie zeigt eine überdurchschnittliche Qualität. Das aktuelle Marktumfeld am Zürichsee ist günstig — eine zeitnahe Vermarktung verspricht einen optimalen Erlös.'
      : score >= 60
      ? 'Ihre Immobilie hat solide Ausgangsbedingungen. Mit gezielten Massnahmen lässt sich der Verkaufspreis weiter optimieren. Gerne beraten wir Sie persönlich und kostenlos.'
      : 'Es gibt echtes Optimierungspotenzial. Wir zeigen Ihnen, welche Massnahmen sich lohnen — und welche nicht.';

    doc.rect(M, y, W - M * 2, 52).fill(SAGELIGHT);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(SAGE).text('Altera-Einschätzung', M + 14, y + 10);
    doc.fontSize(9).font('Helvetica').fillColor('#444444').text(insight, M + 14, y + 24, { width: W - M * 2 - 28 });
    y += 64;

    // ─── CTA BAND ────────────────────────────────────────────────────
    doc.rect(M, y, W - M * 2, 60).fill(SAGE);
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#FFFFFF')
      .text('Professionelle Schätzung vor Ort — kostenlos', M + 16, y + 12);
    doc.fontSize(9).font('Helvetica').fillColor('rgba(255,255,255,0.65)')
      .text('Thierry oder Janis kommen persönlich zu Ihnen. Bankfähig, unverbindlich.', M + 16, y + 30, { width: 320 });
    doc.fontSize(13).font('Helvetica-Bold').fillColor(SAND)
      .text('+41 44 000 00 00', W - M - 180, y + 14, { width: 170, align: 'right' });
    doc.fontSize(9).font('Helvetica').fillColor('rgba(255,255,255,0.5)')
      .text('hallo@altera-immobilien.ch', W - M - 180, y + 34, { width: 170, align: 'right' });
    y += 76;

    // ─── FOOTER ──────────────────────────────────────────────────────
    doc.moveTo(M, y).lineTo(W - M, y).lineWidth(0.5).stroke(LIGHTGRAY);
    y += 8;
    doc.fontSize(7.5).font('Helvetica').fillColor(GRAY)
      .text(
        `© ${year} Altera Immobilien GmbH · Seestrasse 88, 8700 Küsnacht · Diese Bewertung basiert auf hedonischer Methodik und dient zur Orientierung. Kein offizielles Gutachten.`,
        M, y, { width: W - M * 2 }
      );

    doc.end();
  });
}

module.exports = { buildPDF, fmt };
