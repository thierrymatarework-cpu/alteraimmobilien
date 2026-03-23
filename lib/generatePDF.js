// lib/generatePDF.js
// Generiert einen professionellen PDF-Report aus den Bewertungsdaten

const Handlebars = require('handlebars');

// HTML-Template für den PDF-Report
const REPORT_TEMPLATE = `
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    color: #111;
    font-size: 12px;
    line-height: 1.5;
  }
  .page { padding: 48px 52px; min-height: 297mm; position: relative; }

  /* HEADER */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 24px;
    border-bottom: 2px solid #344E41;
    margin-bottom: 32px;
  }
  .logo-name { font-size: 22px; font-weight: 700; color: #111; letter-spacing: -0.04em; }
  .logo-name em { color: #344E41; font-style: normal; }
  .logo-tag { font-size: 10px; color: #888; margin-top: 3px; }
  .report-label {
    text-align: right;
    font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.08em;
  }
  .report-date { font-size: 13px; font-weight: 600; color: #344E41; margin-top: 3px; }

  /* VALUE HERO */
  .value-hero {
    background: linear-gradient(135deg, #EDF1EE 0%, #FBF6EE 100%);
    border-radius: 12px;
    padding: 32px 36px;
    margin-bottom: 28px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .vh-left { }
  .vh-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #344E41; margin-bottom: 6px; }
  .vh-addr { font-size: 12px; color: #666; margin-bottom: 6px; }
  .vh-value { font-size: 42px; font-weight: 800; color: #111; letter-spacing: -0.05em; line-height: 1; }
  .vh-range { font-size: 13px; color: #666; margin-top: 6px; }
  .vh-right { text-align: right; }
  .vh-conf {
    background: #EAF4EF;
    color: #1B6B3E;
    border-radius: 20px;
    padding: 5px 14px;
    font-size: 11px;
    font-weight: 700;
    display: inline-block;
    margin-bottom: 10px;
  }
  .vh-meta { font-size: 11px; color: #888; line-height: 1.6; }

  /* RANGE BAR */
  .range-section { margin-bottom: 28px; }
  .range-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #666; margin-bottom: 10px; }
  .range-bar-wrap { position: relative; height: 8px; background: #E8E6E0; border-radius: 4px; margin-bottom: 8px; }
  .range-bar-fill { height: 100%; border-radius: 4px; background: linear-gradient(90deg, #D0DDD4, #344E41); }
  .range-ends { display: flex; justify-content: space-between; font-size: 11px; }
  .range-min { color: #c0645a; font-weight: 600; }
  .range-max { color: #1B6B3E; font-weight: 600; }
  .range-mid { font-size: 11px; color: #344E41; font-weight: 700; text-align: center; }

  /* METRICS GRID */
  .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
  .metric { background: #F9F8F4; border: 1px solid #EAEAE4; border-radius: 8px; padding: 16px; }
  .metric-l { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #888; margin-bottom: 6px; }
  .metric-v { font-size: 20px; font-weight: 800; color: #111; letter-spacing: -0.04em; line-height: 1; }
  .metric-s { font-size: 11px; color: #888; margin-top: 3px; }
  .metric-b { font-size: 10px; font-weight: 600; color: #1B6B3E; margin-top: 4px; }

  /* SCORE */
  .section-title { font-size: 16px; font-weight: 800; color: #111; letter-spacing: -0.04em; margin-bottom: 4px; }
  .section-sub { font-size: 12px; color: #888; margin-bottom: 16px; }
  .score-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
  .score-label { font-size: 12px; color: #444; width: 150px; flex-shrink: 0; }
  .score-track { flex: 1; height: 7px; background: #F0F0EA; border-radius: 4px; overflow: hidden; }
  .score-fill-gr { height: 100%; border-radius: 4px; background: linear-gradient(90deg, #D0DDD4, #344E41); }
  .score-fill-md { height: 100%; border-radius: 4px; background: linear-gradient(90deg, #EFE0C4, #B5905A); }
  .score-num { font-size: 16px; font-weight: 800; color: #111; width: 32px; text-align: right; }
  .score-tag { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 6px; letter-spacing: 0.04em; width: 64px; text-align: center; }
  .tag-gr { background: #EAF4EF; color: #1B6B3E; }
  .tag-md { background: #FBF3E8; color: #966B1A; }

  /* RANKING */
  .ranking-section { margin-top: 28px; }
  .band-row {
    display: flex; align-items: center; gap: 12px;
    padding: 11px 14px; border-radius: 8px; border: 1.5px solid #EAEAE4;
    background: #fff; margin-bottom: 6px;
  }
  .band-row.active { background: #EDF1EE; border-color: #D0DDD4; }
  .band-rk { width: 24px; height: 24px; border-radius: 50%; background: #F3F1EB; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; color: #888; flex-shrink: 0; }
  .band-row.active .band-rk { background: #344E41; color: #fff; }
  .band-name { font-size: 13px; font-weight: 500; color: #888; flex: 1; }
  .band-row.active .band-name { color: #111; font-weight: 700; }
  .band-price { font-size: 13px; font-weight: 700; color: #888; }
  .band-row.active .band-price { color: #344E41; font-size: 14px; }
  .you-badge { font-size: 9px; font-weight: 700; color: #344E41; background: #EDF1EE; border: 1px solid #D0DDD4; padding: 2px 7px; border-radius: 6px; margin-left: 8px; }

  /* MARKET */
  .market-section { margin-top: 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .market-card { background: #F9F8F4; border: 1px solid #EAEAE4; border-radius: 8px; padding: 18px; }
  .market-l { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #888; margin-bottom: 6px; }
  .market-v { font-size: 20px; font-weight: 800; color: #111; letter-spacing: -0.04em; }
  .market-note { font-size: 11px; color: #1B6B3E; font-weight: 600; margin-top: 3px; }
  .market-txt { font-size: 12px; color: #666; line-height: 1.65; margin-top: 8px; }

  /* INSIGHT */
  .insight-box {
    background: #EDF1EE; border: 1.5px solid #D0DDD4;
    border-radius: 10px; padding: 16px 20px; margin-top: 24px;
    display: flex; gap: 12px; align-items: flex-start;
  }
  .insight-icon { width: 28px; height: 28px; background: #344E41; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
  .insight-title { font-size: 12px; font-weight: 700; color: #344E41; margin-bottom: 3px; }
  .insight-body { font-size: 12px; color: #444; line-height: 1.65; }

  /* CTA */
  .cta-box {
    background: #344E41; border-radius: 10px;
    padding: 24px 28px; margin-top: 24px; color: #fff;
    display: flex; justify-content: space-between; align-items: center;
  }
  .cta-title { font-size: 16px; font-weight: 800; letter-spacing: -0.04em; margin-bottom: 4px; }
  .cta-body { font-size: 12px; color: rgba(255,255,255,0.6); }
  .cta-contact { text-align: right; }
  .cta-tel { font-size: 16px; font-weight: 700; color: #C9A874; }
  .cta-email { font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 3px; }

  /* FOOTER */
  .page-footer {
    position: fixed; bottom: 24px; left: 52px; right: 52px;
    display: flex; justify-content: space-between; align-items: center;
    border-top: 1px solid #EAEAE4; padding-top: 10px;
    font-size: 10px; color: #aaa;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header">
    <div>
      <div class="logo-name">Altera <em>Immobilien</em></div>
      <div class="logo-tag">Seestrasse 88, 8700 Küsnacht · hallo@altera-immobilien.ch</div>
    </div>
    <div class="report-label">
      Bewertungsreport<br>
      <span class="report-date">{{reportDate}}</span>
    </div>
  </div>

  <!-- VALUE HERO -->
  <div class="value-hero">
    <div class="vh-left">
      <div class="vh-label">Geschätzter Marktwert</div>
      <div class="vh-addr">{{address}}</div>
      <div class="vh-value">CHF {{value}}</div>
      <div class="vh-range">Bandbreite CHF {{rangeMin}} – CHF {{rangeMax}}</div>
    </div>
    <div class="vh-right">
      <div class="vh-conf">Hohe Konfidenz</div>
      <div class="vh-meta">
        127 Vergleichsobjekte<br>
        Hedonische Methodik<br>
        Stand {{reportDate}}
      </div>
    </div>
  </div>

  <!-- RANGE BAR -->
  <div class="range-section">
    <div class="range-title">Preisspanne</div>
    <div class="range-bar-wrap">
      <div class="range-bar-fill" style="width:100%"></div>
    </div>
    <div class="range-ends">
      <span class="range-min">Min: CHF {{rangeMin}}</span>
      <span class="range-mid">▲ CHF {{value}}</span>
      <span class="range-max">Max: CHF {{rangeMax}}</span>
    </div>
  </div>

  <!-- METRICS -->
  <div class="metrics">
    <div class="metric">
      <div class="metric-l">Preis pro m²</div>
      <div class="metric-v">CHF {{m2Price}}</div>
      <div class="metric-s">CHF / m²</div>
      <div class="metric-b">↑ +3.2% ggü. Vorjahr</div>
    </div>
    <div class="metric">
      <div class="metric-l">Gesamt-Score</div>
      <div class="metric-v">{{score}}</div>
      <div class="metric-s">von 100 Punkten</div>
      <div class="metric-b">{{scoreLabel}}</div>
    </div>
    <div class="metric">
      <div class="metric-l">Mietrendite p.a.</div>
      <div class="metric-v">{{rendite}}%</div>
      <div class="metric-s">Netto-Ertragswert</div>
      <div class="metric-b">Überdurchschnittlich</div>
    </div>
    <div class="metric">
      <div class="metric-l">Marktdynamik</div>
      <div class="metric-v">Hoch</div>
      <div class="metric-s">Ø 24 Tage Verkauf</div>
      <div class="metric-b">Nachfrage ↑ 2.4×</div>
    </div>
  </div>

  <!-- SCORES -->
  <div class="section-title">Score-Analyse</div>
  <div class="section-sub">Bewertung nach 6 Dimensionen</div>
  {{#each scores}}
  <div class="score-row">
    <span class="score-label">{{this.label}}</span>
    <div class="score-track">
      <div class="score-fill-{{this.cls}}" style="width:{{this.pct}}%"></div>
    </div>
    <span class="score-num">{{this.val}}</span>
    <span class="score-tag tag-{{this.cls}}">{{this.tag}}</span>
  </div>
  {{/each}}

  <!-- RANKING -->
  <div class="ranking-section">
    <div class="section-title" style="margin-top:24px">Segment-Einordnung</div>
    <div class="section-sub">Einordnung im regionalen Marktspektrum</div>
    {{#each bands}}
    <div class="band-row {{#if this.active}}active{{/if}}">
      <div class="band-rk">{{this.rank}}</div>
      <div class="band-name">
        {{this.name}}
        {{#if this.active}}<span class="you-badge">Ihr Objekt</span>{{/if}}
      </div>
      <div class="band-price">CHF {{this.min}} – {{this.max}}</div>
    </div>
    {{/each}}
  </div>

  <!-- MARKET -->
  <div class="market-section">
    <div class="market-card">
      <div class="market-l">Ø-Preis Region</div>
      <div class="market-v">CHF {{avgPrice}}/m²</div>
      <div class="market-note">+2.4% in 12 Monaten</div>
      <div class="market-txt">Basierend auf 127 Vergleichsobjekten im Umkreis von 5 km, Transaktionen der letzten 6 Monate.</div>
    </div>
    <div class="market-card">
      <div class="market-l">Markt-Nachfrage</div>
      <div class="market-v">Hoch ↗</div>
      <div class="market-note">Nachfrage 2.4× über Angebot</div>
      <div class="market-txt">Durchschnittliche Vermarktungsdauer in Ihrer Region: 24 Tage. Günstige Verkaufskonditionen.</div>
    </div>
  </div>

  <!-- INSIGHT -->
  <div class="insight-box">
    <div class="insight-icon">💡</div>
    <div>
      <div class="insight-title">Altera-Einschätzung</div>
      <div class="insight-body">{{insight}}</div>
    </div>
  </div>

  <!-- CTA -->
  <div class="cta-box">
    <div>
      <div class="cta-title">Professionelle Schätzung vor Ort — kostenlos</div>
      <div class="cta-body">Unsere zertifizierten Schätzer kommen zu Ihnen. Bankfähig, rechtsgültig, unverbindlich.</div>
    </div>
    <div class="cta-contact">
      <div class="cta-tel">+41 44 000 00 00</div>
      <div class="cta-email">hallo@altera-immobilien.ch</div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="page-footer">
    <span>Altera Immobilien GmbH · Küsnacht am Zürichsee</span>
    <span>Diese Bewertung dient zur Orientierung und ist kein Gutachten im rechtlichen Sinne.</span>
    <span>© {{year}} Altera Immobilien</span>
  </div>

</div>
</body>
</html>
`;

/**
 * Generiert HTML für den Report (für Puppeteer-PDF)
 */
function buildReportHTML(data) {
  const template = Handlebars.compile(REPORT_TEMPLATE);
  return template(data);
}

module.exports = { buildReportHTML, REPORT_TEMPLATE };
