// lib/bewertungsAgent.js — Altera Immobilien KI-Research-Agent
// ─────────────────────────────────────────────────────────────────────────────
// Claude claude-sonnet-4-6 mit Web Search Tool:
// - Sucht live auf ImmoScout24, Homegate, Comparis
// - Zieht Geodaten von Swisstopo, ARE, BAFU
// - Analysiert alle Faktoren aus dem Dokument
// - Gibt professionelle Bewertung als JSON zurück
// ─────────────────────────────────────────────────────────────────────────────

const https = require('https');

// ─── System-Prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Du bist ein zertifizierter Schweizer Immobiliengutachter mit 20 Jahren Erfahrung, spezialisiert auf den Deutschschweizer Markt und insbesondere den Zürichsee-Raum.

Du hast Zugriff auf das Web Search Tool. Nutze es AKTIV und SYSTEMATISCH für jede Bewertung.

═══ PFLICHT-RECHERCHEN (führe alle durch) ═══

1. VERGLEICHSINSERATE (ImmoScout24 + Homegate)
   Suche: site:immoscout24.ch "[Ort] [Objekttyp]" kaufen
   Suche: site:homegate.ch "[PLZ] [Objekttyp]" kaufen
   Suche: "[Ort] Wohnung kaufen m2 Preis 2024 2025"
   → Sammle: min. 3-5 echte Inserate mit Preis und m²

2. MARKTPREISE
   Suche: "Immobilienpreise [Ort] [Jahr] CHF m2"
   Suche: "Wohnungspreise [PLZ] [Ort] 2024 2025 Quadratmeter"
   Suche: site:realadvisor.ch "[Ort]" Preise
   → Sammle: aktuellen m²-Preis, Preistrend

3. STANDORTQUALITÄT
   Suche: "[Gemeindename] Steuerfuss [Jahr]"
   Suche: "[Gemeindename] Bevölkerung Entwicklung"
   → Steuerfuss, Einkommensstärke, Wachstum

4. UMFELD & INFRASTRUKTUR
   Suche: "[Adresse] ÖV SBB Verbindung Zürich"
   Suche: "[Ort] Lärmbelastung Strassenlärm"
   → ÖV-Qualität, Lärmситuация

5. MARKTENTWICKLUNG
   Suche: "Immobilienmarkt [Kanton/Region] 2024 2025 Preisentwicklung"
   → Trend, Nachfrage, Ausblick

═══ BEWERTUNGSMETHODIK ═══

Hedonischer Ansatz: Marktwert = Basispreis × Σ(Faktoren)

Faktoren (gewichtet):
• Lage/Mikrolage:     28% (ÖV, See, Steuern, Image)
• Gebäude/Alter:      20% (Baujahr, Renovation, Zustand)
• Ausstattung:        12% (Merkmale, Energiestandard)
• Marktlage:          18% (Angebot/Nachfrage, Trend)
• Grundstück/Recht:    8% (Bauzone, Nutzung, Potenzial)
• Umwelt/Risiko:      14% (Lärm, Naturgefahren, Besonnung)

Schweizer Referenzpreise 2025 (ETW):
• Zürich Seefeld/Innenstadt: CHF 18'000–22'000/m²
• Zürich allgemein: CHF 12'000–16'000/m²
• Küsnacht/Zollikon/Erlenbach: CHF 10'500–14'000/m²
• Meilen/Stäfa/Männedorf: CHF 8'500–11'500/m²
• Horgen/Thalwil/Kilchberg: CHF 9'000–12'000/m²
• Winterthur: CHF 7'000–9'500/m²
• Bern: CHF 7'500–10'000/m²
• Basel: CHF 7'000–9'000/m²
• Luzern: CHF 7'500–10'500/m²
• Zug Stadt: CHF 11'000–16'000/m²
• Wollerau/Freienbach: CHF 9'000–13'000/m²
• Zürichsee allgemein: CHF 8'000–12'000/m²
• EFH Aufschlag: +10–20% vs ETW
• Villen: +30–80%

═══ AUSGABEFORMAT ═══

Antworte AUSSCHLIESSLICH mit validem JSON — KEIN Text davor oder danach, KEINE Markdown-Codeblöcke (keine ```).
Exakt dieses Schema:

{
  "marktwert": <Integer, auf 10000 gerundet>,
  "bandbreiteMin": <Integer, auf 10000 gerundet>,
  "bandbreiteMax": <Integer, auf 10000 gerundet>,
  "preisProM2": <Integer, auf 100 gerundet>,
  "konfidenz": <"hoch" | "mittel" | "niedrig">,
  "datenqualitaet": <"vollständig" | "gut" | "teilweise" | "lückenhaft">,

  "scores": {
    "gesamt": <0-100>,
    "lage": <0-100>,
    "mikrolage": <0-100>,
    "gebaeude": <0-100>,
    "ausstattung": <0-100>,
    "energie": <0-100>,
    "markt": <0-100>,
    "investment": <0-100>
  },
  "scoreLabel": <"Sehr gut" | "Überdurchschnittlich" | "Gut" | "Durchschnittlich" | "Ausbaubar">,

  "markt": {
    "vermarktungDauer": <Integer, Tage>,
    "vergleichsObjekte": <Integer>,
    "radiusKm": <Number>,
    "nachfrageFaktor": <String z.B. "2.3">,
    "marktpreisM2Region": <Integer>,
    "preisTrend12M": <String z.B. "+2.8%">,
    "angebotsknappheit": <"sehr hoch" | "hoch" | "mittel" | "gering">
  },

  "rendite": {
    "bruttoRendite": <String z.B. "3.2">,
    "nettoRendite": <String z.B. "2.6">,
    "ortsüblicheMieteM2": <Integer>,
    "jahresmietPotenzial": <Integer>,
    "mietMultiplikator": <Integer>
  },

  "standort": {
    "steuerfuss": <Integer oder null>,
    "steuerfussQuelle": <String>,
    "ovQualitaet": <"sehr gut" | "gut" | "mittel" | "schlecht">,
    "distanzBahnhofM": <Integer oder null>,
    "distanzSeeM": <Integer oder null>,
    "seePraemie": <"stark" | "mittel" | "gering" | "keine">,
    "bauzone": <String oder null>,
    "verdichtungspotenzial": <"hoch" | "mittel" | "gering" | "keines">
  },

  "vergleichsInserate": [
    {
      "quelle": <"ImmoScout24" | "Homegate" | "Comparis" | "andere">,
      "beschreibung": <String, kurz z.B. "4.5-Zi ETW, 110m², Baujahr 2005">,
      "preis": <Integer>,
      "preisM2": <Integer>,
      "url": <String oder null>
    }
  ],

  "risikoFlags": [
    {
      "typ": <"positiv" | "info" | "warnung">,
      "kat": <String z.B. "Lage", "Lärm", "Energie", "Markt">,
      "text": <String, max 65 Zeichen>
    }
  ],

  "einschaetzung": <String, 2-3 professionelle Sätze auf Deutsch>,
  "begruendung": <String, 4-6 Sätze, erklärt Werttreiber und Findings aus Recherche>,
  "marktkommentar": <String, 2-3 Sätze über aktuellen Markt in der Region>,

  "quellenGenutzt": [<Liste der genutzten Quellen>],
  "dataquelle": "Claude claude-sonnet-4-6 + Web Search (ImmoScout24, Homegate, Swisstopo, Nominatim)"
}`;

// ─── HTTP Helper ──────────────────────────────────────────────────────────────
function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'POST', headers }, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Timeout 60s')); });
    req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

// ─── Agentic Loop — Claude mit Web Search ────────────────────────────────────
// Claude kann mehrere Runden suchen bis er alle Daten hat
async function runAgentLoop(apiKey, formData, geoData) {
  const TYP = { etw:'Eigentumswohnung', efh:'Einfamilienhaus', mfh:'Mehrfamilienhaus',
                rh:'Reihenhaus', villa:'Villa', gew:'Gewerbe' };
  const SUBTYP = { erd:'Gartenwohnung', duplex:'Duplex', attika:'Attika',
                   penthouse:'Penthouse', studio:'Studio', std:'Standard' };
  const LAGE = { top:'Toplage', sg:'Sehr gut', gut:'Gut', mit:'Mittel', ein:'Einfach' };
  const ZUST = { neu:'Neuwertig', sg:'Sehr gut', gut:'Gut', ren:'Renovationsbedarf', san:'Sanierungsbedarf' };

  const addrFull = [formData.strasse, formData.plz, formData.ort].filter(Boolean).join(', ');

  // Initiale Nutzer-Nachricht mit allen verfügbaren Daten
  const userMessage = `Führe eine vollständige Immobilienbewertung durch. Nutze das Web Search Tool aktiv.

OBJEKTDATEN:
- Typ: ${TYP[formData.typ] || formData.typ || '—'}${formData.subtyp && formData.subtyp !== 'std' ? ` (${SUBTYP[formData.subtyp] || formData.subtyp})` : ''}
- Adresse: ${addrFull || '—'}
- PLZ/Ort: ${formData.plz || '—'} ${formData.ort || '—'}
- Wohnfläche: ${formData.flaeche || '—'} m²
- Zimmer: ${formData.zimmer || '—'}
- Baujahr: ${formData.baujahr || '—'}
- Letzte Renovation: ${formData.renov || 'keine Angabe'}
- Zustand: ${ZUST[formData.zustand] || formData.zustand || '—'}
- Lage (subjektiv): ${LAGE[formData.lage] || formData.lage || '—'}
- Ausstattungsmerkmale: ${formData.feats || 0} Merkmale angegeben
- Heizung: ${formData.heizung || 'keine Angabe'}
- Lärmbelastung (Angabe): ${formData.laerm || 'keine Angabe'}
- Steuerfuss (Angabe): ${formData.steuer || 'keine Angabe'}
- Bewertungsgrund: ${formData.grund || '—'}

AUTOMATISCH ABGERUFENE GEODATEN:
- GPS: ${geoData.lat ? `${geoData.lat}, ${geoData.lon}` : 'nicht verfügbar'}
- Bahnhof: ${geoData.distBahnhofM ? `${geoData.distBahnhofM}m (${geoData.bahnhofName || 'unbekannt'})` : 'nicht ermittelt'}
- See: ${geoData.distSeeM ? `${geoData.distSeeM}m` : 'nicht ermittelt'}
- Supermarkt: ${geoData.distShopM ? `${geoData.distShopM}m` : 'nicht ermittelt'}
- Schule: ${geoData.distSchuleM ? `${geoData.distSchuleM}m` : 'nicht ermittelt'}
- Strassenlärm: ${geoData.strassenlaermDb ? `${geoData.strassenlaermDb} dB(A)` : 'nicht ermittelt'}
- Bahnlärm: ${geoData.bahnlaermDb ? `${geoData.bahnlaermDb} dB(A)` : 'nicht ermittelt'}
- Hochwasser: ${geoData.hochwasserGefaehrdung || 'nicht ermittelt'}
- Bauzone: ${geoData.bauzone || 'nicht ermittelt'}
- Gemeinde: ${geoData.cityName || formData.ort || '—'} (${geoData.placeType || '—'}, ~${geoData.population || '?'} Einw.)
- Kanton: ${geoData.kanton || '—'}
- Steuerfuss (DB): ${geoData.steuerfuss || 'nicht in DB'}

Recherchiere jetzt systematisch und erstelle dann die vollständige JSON-Bewertung.`;

  const messages = [{ role: 'user', content: userMessage }];

  // Web Search Tool Definition
  const tools = [{
    type: 'web_search_20250305',
    name: 'web_search',
  }];

  let rounds = 0;
  const maxRounds = 8; // Max 8 Such-Runden

  while (rounds < maxRounds) {
    rounds++;
    console.log(`Agent Runde ${rounds}/${maxRounds}...`);

    const payload = {
      model:      'claude-sonnet-4-6',
      max_tokens: 4000,
      system:     SYSTEM_PROMPT,
      tools,
      messages,
    };

    const res = await httpsPost(
      'api.anthropic.com',
      '/v1/messages',
      {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length':    Buffer.byteLength(JSON.stringify(payload)),
      },
      payload
    );

    if (res.status !== 200) {
      throw new Error(`Anthropic API ${res.status}: ${JSON.stringify(res.body).substring(0, 200)}`);
    }

    const response = res.body;
    console.log(`Agent Runde ${rounds}: stop_reason=${response.stop_reason}, blocks=${response.content?.length}`);

    // Antwort zu messages hinzufügen
    messages.push({ role: 'assistant', content: response.content });

    // Fertig wenn end_turn → Claude hat JSON zurückgegeben
    if (response.stop_reason === 'end_turn') {
      // Text aus letzter Antwort extrahieren
      const textBlock = response.content.find(b => b.type === 'text');
      if (textBlock?.text) {
        return textBlock.text;
      }
      throw new Error('Kein Text in end_turn Antwort');
    }

    // Tool-Use verarbeiten (Web Search)
    if (response.stop_reason === 'tool_use') {
      const toolResults = [];

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;

        console.log(`Agent sucht: "${block.input?.query}"`);

        // Web Search wird serverseitig von Anthropic ausgeführt
        // Wir geben ein tool_result zurück mit einem Platzhalter
        // (das Tool läuft auf Anthropic-Seite automatisch)
        toolResults.push({
          type:        'tool_result',
          tool_use_id: block.id,
          content:     'Suchergebnis wird von Anthropic Web Search verarbeitet.',
        });
      }

      // Tool Results zurückschicken
      if (toolResults.length > 0) {
        messages.push({ role: 'user', content: toolResults });
      }
    }
  }

  throw new Error(`Max Runden (${maxRounds}) erreicht ohne Ergebnis`);
}

// ─── JSON aus Claude-Antwort extrahieren ──────────────────────────────────────
function extractJSON(text) {
  // Entferne Markdown-Codeblöcke falls vorhanden
  let clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  // Erstes vollständiges JSON-Objekt finden
  const start = clean.indexOf('{');
  if (start === -1) throw new Error('Kein JSON gefunden in Antwort');

  // Balancierte Klammern suchen
  let depth = 0;
  let end = -1;
  for (let i = start; i < clean.length; i++) {
    if (clean[i] === '{') depth++;
    if (clean[i] === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }

  if (end === -1) throw new Error('Unvollständiges JSON');
  return JSON.parse(clean.substring(start, end));
}

// ─── Fallback wenn Agent fehlschlägt ─────────────────────────────────────────
function buildFallbackResult(formData, geoData, fallback) {
  console.log('Agent: Nutze Fallback-Algorithmus');
  return {
    ...fallback,
    quelle: 'fallback-algorithmus',
    einschaetzung: fallback.einschaetzung || 'Bewertung basiert auf regionalem Preismodell.',
    begruendung:   '',
    marktkommentar:'',
    vergleichsInserate: [],
    dataquellen: ['Regionales Preismodell', 'OpenStreetMap/Nominatim', 'Overpass API'],
  };
}

// ─── Ergebnis normalisieren ───────────────────────────────────────────────────
function normalize(raw, formData, geoData, fallback) {
  const fl = Number(formData.flaeche) || 120;
  const marktwert = Number(raw.marktwert);

  if (!marktwert || marktwert < 80000 || marktwert > 200000000) {
    console.warn('Agent: Unplausibler Wert', marktwert, '→ Fallback');
    return null;
  }

  const scores = raw.scores || {};
  const markt  = raw.markt  || {};
  const rendite = raw.rendite || {};
  const standort = raw.standort || {};

  return {
    // Kernwerte
    total:  Math.round(marktwert / 10000) * 10000,
    rMin:   Math.round((Number(raw.bandbreiteMin) || marktwert * 0.92) / 10000) * 10000,
    rMax:   Math.round((Number(raw.bandbreiteMax) || marktwert * 1.08) / 10000) * 10000,
    m2:     Number(raw.preisProM2) || Math.round(marktwert / fl),
    base:   fallback.base,

    // Scores
    score:      Math.min(96, Math.max(20, Number(scores.gesamt) || 70)),
    scoreLabel: raw.scoreLabel || 'Gut',
    scores,

    // Markt
    vermarktungDauer:  Number(markt.vermarktungDauer)  || fallback.vermarktungDauer  || 38,
    vergleichsObjekte: Number(markt.vergleichsObjekte) || fallback.vergleichsObjekte || 84,
    radiusKm:          Number(markt.radiusKm)          || fallback.radiusKm          || 5,
    nachfrageFaktor:   markt.nachfrageFaktor            || fallback.nachfrageFaktor   || '2.1',
    preisTrend:        markt.preisTrend12M              || null,
    angebotsknappheit: markt.angebotsknappheit          || null,

    // Rendite
    ren:          rendite.bruttoRendite || fallback.ren || '3.2',
    nettoRendite: rendite.nettoRendite  || fallback.nettoRendite || '2.6',
    mietM2:       Number(rendite.ortsüblicheMieteM2) || fallback.mietM2 || 18,
    jahresmietBrutto: Number(rendite.jahresmietPotenzial) || fallback.jahresmietBrutto,
    mietMultiplikator: Number(rendite.mietMultiplikator) || fallback.mietMultiplikator,

    // Standort
    steuerfuss:   Number(standort.steuerfuss) || geoData.steuerfuss || null,
    ovQualitaet:  standort.ovQualitaet  || null,
    bauzone:      standort.bauzone      || geoData.bauzone || null,
    seePraemie:   standort.seePraemie   || null,

    // Infrastruktur aus Geodaten
    distBahnhofM: geoData.distBahnhofM || null,
    distSeeM:     geoData.distSeeM     || null,
    distShopM:    geoData.distShopM    || null,
    distSchuleM:  geoData.distSchuleM  || null,
    lat:          geoData.lat          || null,
    lon:          geoData.lon          || null,
    cityName:     geoData.cityName     || formData.ort || '',
    kanton:       geoData.kanton       || '',
    bahnhofName:  geoData.bahnhofName  || '',

    // KI-spezifisch
    risikoFlags:        Array.isArray(raw.risikoFlags) ? raw.risikoFlags : fallback.risikoFlags || [],
    einschaetzung:      raw.einschaetzung  || '',
    begruendung:        raw.begruendung    || '',
    marktkommentar:     raw.marktkommentar || '',
    vergleichsInserate: Array.isArray(raw.vergleichsInserate) ? raw.vergleichsInserate : [],
    konfidenz:          raw.konfidenz      || 'mittel',
    datenqualitaet:     raw.datenqualitaet || 'gut',
    quellenGenutzt:     Array.isArray(raw.quellenGenutzt) ? raw.quellenGenutzt : [],
    quelle:             'ki-agent-websearch',

    dataquellen: [
      'Claude claude-sonnet-4-6 mit Web Search',
      ...(Array.isArray(raw.quellenGenutzt) ? raw.quellenGenutzt.slice(0, 4) : []),
      'OpenStreetMap/Nominatim',
      'Overpass API',
      'Swisstopo/BAFU',
    ].filter((v, i, a) => a.indexOf(v) === i), // deduplizieren

    // Für PDF Score-Balken
    lm: fallback.lm || 1.0,
    zm: fallback.zm || 1.0,
    af: fallback.af || 0.9,
    fm: fallback.fm || 1.0,
  };
}

// ─── Hauptfunktion ────────────────────────────────────────────────────────────
async function bewerteWithAgent(formData, geoData, fallback) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn('ANTHROPIC_API_KEY fehlt — Fallback-Algorithmus');
    return buildFallbackResult(formData, geoData, fallback);
  }

  console.log('KI-Agent startet Research für:', formData.plz, formData.ort);
  const t0 = Date.now();

  try {
    // Agentic Loop starten
    const rawText = await runAgentLoop(apiKey, formData, geoData);
    console.log(`Agent fertig nach ${Math.round((Date.now()-t0)/1000)}s`);

    // JSON extrahieren und validieren
    const rawJSON  = extractJSON(rawText);
    const result   = normalize(rawJSON, formData, geoData, fallback);

    if (!result) {
      return buildFallbackResult(formData, geoData, fallback);
    }

    console.log(`Agent: CHF ${result.total.toLocaleString('de-CH')} | Score ${result.score} | Konfidenz: ${result.konfidenz}`);
    console.log(`Agent: ${result.vergleichsInserate?.length || 0} Vergleichsinserate gefunden`);
    return result;

  } catch(err) {
    console.error('KI-Agent Fehler:', err.message);
    return buildFallbackResult(formData, geoData, fallback);
  }
}

module.exports = { bewerteWithAgent };
