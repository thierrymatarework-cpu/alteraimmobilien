// lib/bewertungsAgent.js — Altera Immobilien
// ─────────────────────────────────────────────────────────────────────────────
// KORREKTE Implementierung des Anthropic Web Search Tool (web_search_20250305)
//
// WICHTIG — wie web_search_20250305 wirklich funktioniert:
// 1. Wir schicken Request mit tools=[{type:"web_search_20250305"}]
// 2. Claude antwortet mit stop_reason="tool_use" und content=[tool_use blocks]
// 3. Anthropic führt die Suche serverseitig aus
// 4. WIR müssen die tool_result Blöcke zurückschicken (leer ist ok —
//    Anthropic füllt die Resultate selbst aus)
// 5. Nächste Runde: Claude sieht die Ergebnisse und schreibt weiter
// Loop: user → tool_use → [wir: tool_result] → Claude liest → end_turn
// ─────────────────────────────────────────────────────────────────────────────

const https = require('https');

const SYSTEM_PROMPT = `Du bist ein zertifizierter Schweizer Immobiliengutachter mit 20 Jahren Erfahrung.
Spezialisierung: Deutschschweiz, Zürichsee, hedonische Bewertung.

PFLICHT: Nutze web_search für JEDE Bewertung. Führe diese Suchen durch:
1. "[Ort] Eigentumswohnung kaufen CHF m2 2025 2026"
2. "[Ort] Immobilienpreise aktuell Quadratmeter"
3. Mindestens 2 echte Inserate auf immoscout24 oder homegate

Preisreferenzen 2026 (ETW CHF/m²):
Kilchberg 17500|Rüschlikon 16800|Zollikon 14500|Erlenbach 15500|Küsnacht 13200
Zürich Seefeld 19500|Zürich allg 13000-16000|Horgen 9800|Meilen 11200|Wollerau 11500
Pfäffikon SZ 13000|Zug 15800|Bern 8500|Basel 9200|Luzern 9500|Winterthur 8400|Genf 14500

Korrekturfaktoren: See<200m +30%|See<500m +15%|Steuerfuss<80% +8%|Penthouse +20%|Lärm stark -15%

AUSGABE: Nur valides JSON, kein Text, keine Backticks:
{"marktwert":<Int>,"bandbreiteMin":<Int>,"bandbreiteMax":<Int>,"preisProM2":<Int>,"konfidenz":"hoch","scores":{"gesamt":<0-100>,"lage":<0-100>,"mikrolage":<0-100>,"gebaeude":<0-100>,"ausstattung":<0-100>,"energie":<0-100>,"markt":<0-100>},"scoreLabel":"Gut","markt":{"vermarktungDauer":<Int>,"vergleichsObjekte":<Int>,"radiusKm":<Num>,"nachfrageFaktor":"<Str>","marktpreisM2Region":<Int>,"preisTrend12M":"<Str>","angebotsknappheit":"hoch"},"rendite":{"bruttoRendite":"<Str>","nettoRendite":"<Str>","ortsüblicheMieteM2":<Int>,"jahresmietPotenzial":<Int>,"mietMultiplikator":<Int>},"standort":{"steuerfuss":<Int>,"ovQualitaet":"gut","distanzBahnhofM":<Int>,"distanzSeeM":<Int>,"seePraemie":"keine","bauzone":"<Str>","verdichtungspotenzial":"gering"},"vergleichsInserate":[{"quelle":"ImmoScout24","beschreibung":"<Str>","preis":<Int>,"preisM2":<Int>,"url":null}],"risikoFlags":[{"typ":"positiv","kat":"Lage","text":"<max 65 Zeichen>"}],"einschaetzung":"<2-3 Sätze DE>","begruendung":"<4-6 Sätze DE>","marktkommentar":"<2-3 Sätze DE>","quellenGenutzt":["ImmoScout24"],"dataquelle":"Claude claude-sonnet-4-6 + Web Search"}`;

function httpsPost(hostname, path, headersObj, bodyStr) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'POST', headers: headersObj }, res => {
      const bufs = [];
      res.on('data', c => bufs.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(bufs).toString('utf8');
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(90000, () => { req.destroy(); reject(new Error('Timeout 90s')); });
    req.write(bodyStr); req.end();
  });
}

async function runAgentLoop(apiKey, userMessage) {
  const messages = [{ role: 'user', content: userMessage }];
  const tools = [{ type: 'web_search_20250305', name: 'web_search' }];
  const MAX = 12;

  for (let round = 1; round <= MAX; round++) {
    const payload = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    console.log(`Agent Runde ${round} (${messages.length} msgs)...`);

    const res = await httpsPost(
      'api.anthropic.com', '/v1/messages',
      {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(payload, 'utf8'),
      },
      payload
    );

    if (res.status !== 200) {
      const errText = typeof res.body === 'string' ? res.body : JSON.stringify(res.body);
      throw new Error(`API ${res.status}: ${errText.substring(0, 300)}`);
    }

    const { stop_reason, content = [] } = res.body;
    const types = content.map(b => b.type).join(',');
    console.log(`  → stop=${stop_reason} blocks=[${types}]`);

    // Antwort in History
    messages.push({ role: 'assistant', content });

    if (stop_reason === 'end_turn') {
      const text = content.filter(b => b.type === 'text').map(b => b.text).join('\n');
      if (text.trim()) { console.log(`Agent fertig nach ${round} Runden`); return text; }
      throw new Error('end_turn ohne Text');
    }

    if (stop_reason === 'tool_use') {
      // WICHTIG: tool_result zurückschicken damit Anthropic die Suche ausführt
      // Der content Array enthält tool_use Blöcke — wir bestätigen jeden
      const toolResults = content
        .filter(b => b.type === 'tool_use')
        .map(b => {
          console.log(`  Suche: "${b.input?.query}"`);
          return {
            type: 'tool_result',
            tool_use_id: b.id,
            content: '', // Leer — Anthropic füllt die echten Ergebnisse ein
          };
        });

      if (toolResults.length > 0) {
        messages.push({ role: 'user', content: toolResults });
      }
      continue;
    }

    if (stop_reason === 'max_tokens') { continue; }
    console.warn(`stop_reason unbekannt: ${stop_reason}`); break;
  }

  throw new Error(`Agent: ${MAX} Runden ohne end_turn`);
}

function buildUserMessage(formData, geoData) {
  const TYP  ={etw:'Eigentumswohnung',efh:'Einfamilienhaus',mfh:'Mehrfamilienhaus',rh:'Reihenhaus',villa:'Villa',gew:'Gewerbe'};
  const SUBTYP={erd:'Gartenwohnung',duplex:'Duplex',attika:'Attika',penthouse:'Penthouse',studio:'Studio',std:''};
  const LAGE ={top:'Toplage',sg:'Sehr gut',gut:'Gut',mit:'Mittel',ein:'Einfach'};
  const ZUST ={neu:'Neuwertig',sg:'Sehr gut',gut:'Gut',ren:'Renovationsbedarf',san:'Sanierungsbedarf'};

  const addr = [formData.strasse, formData.plz, formData.ort].filter(Boolean).join(', ') || 'unbekannt';
  const typ  = (TYP[formData.typ]||formData.typ||'—') + (formData.subtyp&&formData.subtyp!=='std'?` (${SUBTYP[formData.subtyp]||formData.subtyp})`:'');
  const ort  = formData.ort || formData.plz || 'Schweiz';

  return `Bewerte diese Immobilie. Suche sofort nach Marktpreisen!

OBJEKT: ${typ} | ${addr}
Fläche: ${formData.flaeche||'?'} m² | Zimmer: ${formData.zimmer||'?'} | Baujahr: ${formData.baujahr||'?'}
Renovation: ${formData.renov||'keine'} | Zustand: ${ZUST[formData.zustand]||formData.zustand||'?'}
Lage (Eigenangabe): ${LAGE[formData.lage]||formData.lage||'?'}
Ausstattungsmerkmale: ${formData.feats||0} | Heizung: ${formData.heizung||'?'}
Lärmbelastung: ${formData.laerm||'?'} | Steuerfuss: ${formData.steuer||'?'}%

GEODATEN:
GPS: ${geoData.lat&&geoData.lon?`${geoData.lat}, ${geoData.lon}`:'n.v.'}
Bahnhof: ${geoData.distBahnhofM!=null?`${geoData.distBahnhofM}m (${geoData.bahnhofName||''})` :'n.v.'}
See: ${geoData.distSeeM!=null?`${geoData.distSeeM}m`:'n.v.'}
Lärm: ${geoData.strassenlaermDb!=null?`${geoData.strassenlaermDb} dB(A)`:'n.v.'}
Bauzone: ${geoData.bauzone||'n.v.'} | Steuerfuss DB: ${geoData.steuerfuss!=null?`${geoData.steuerfuss}%`:'n.v.'}
Gemeinde: ${geoData.cityName||ort} (${geoData.placeType||'?'}, ~${geoData.population||'?'} Einw.)

Suche mindestens 3 Vergleichsinserate und gib dann JSON-Bewertung aus.`;
}

function extractJSON(text) {
  const s = text.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim();
  let depth=0, start=-1, end=-1;
  for(let i=0;i<s.length;i++){
    if(s[i]==='{'){if(start===-1)start=i;depth++;}
    else if(s[i]==='}'&&start!==-1){depth--;if(depth===0){end=i+1;break;}}
  }
  if(start===-1||end===-1) throw new Error('Kein JSON');
  return JSON.parse(s.substring(start,end).replace(/,\s*([\]}])/g,'$1'));
}

function normalize(raw, formData, geoData, fallback) {
  const val = Number(raw.marktwert);
  if(!val||val<80000||val>200000000) return null;
  const fl=Number(formData.flaeche)||120, m=raw.markt||{}, r=raw.rendite||{}, s=raw.standort||{};
  return {
    total: Math.round(val/10000)*10000,
    rMin:  Math.round((Number(raw.bandbreiteMin)||val*0.92)/10000)*10000,
    rMax:  Math.round((Number(raw.bandbreiteMax)||val*1.08)/10000)*10000,
    m2:    Number(raw.preisProM2)||Math.round(val/fl),
    base:  fallback.base,
    score: Math.min(96,Math.max(20,Number(raw.scores?.gesamt)||70)),
    scoreLabel: raw.scoreLabel||'Gut',
    scores: raw.scores||{},
    vermarktungDauer:  Number(m.vermarktungDauer) ||fallback.vermarktungDauer ||38,
    vergleichsObjekte: Number(m.vergleichsObjekte)||fallback.vergleichsObjekte||84,
    radiusKm:          Number(m.radiusKm)         ||fallback.radiusKm         ||5,
    nachfrageFaktor:   m.nachfrageFaktor           ||fallback.nachfrageFaktor  ||'2.1',
    preisTrend:        m.preisTrend12M             ||null,
    ren:          r.bruttoRendite             ||fallback.ren         ||'3.2',
    nettoRendite: r.nettoRendite              ||fallback.nettoRendite||'2.6',
    mietM2:       Number(r.ortsüblicheMieteM2)||fallback.mietM2      ||18,
    jahresmietBrutto: Number(r.jahresmietPotenzial)||fallback.jahresmietBrutto,
    steuerfuss:   Number(s.steuerfuss)||geoData.steuerfuss||null,
    bauzone:      s.bauzone||geoData.bauzone||null,
    ovQualitaet:  s.ovQualitaet||null,
    distBahnhofM: geoData.distBahnhofM||null, distSeeM: geoData.distSeeM||null,
    distShopM:    geoData.distShopM||null,
    lat:geoData.lat||null, lon:geoData.lon||null,
    cityName:    geoData.cityName    ||formData.ort||'',
    kanton:      geoData.kanton      ||'',
    bahnhofName: geoData.bahnhofName ||'',
    risikoFlags:       Array.isArray(raw.risikoFlags)?raw.risikoFlags:(fallback.risikoFlags||[]),
    einschaetzung:     raw.einschaetzung ||'',
    begruendung:       raw.begruendung   ||'',
    marktkommentar:    raw.marktkommentar||'',
    vergleichsInserate:Array.isArray(raw.vergleichsInserate)?raw.vergleichsInserate:[],
    konfidenz:         raw.konfidenz||'mittel',
    quellenGenutzt:    Array.isArray(raw.quellenGenutzt)?raw.quellenGenutzt:[],
    quelle: 'ki-agent-websearch',
    dataquellen:['Claude claude-sonnet-4-6 + Web Search','OpenStreetMap/Nominatim','Overpass API','Swisstopo/BAFU']
      .concat(Array.isArray(raw.quellenGenutzt)?raw.quellenGenutzt.slice(0,3):[])
      .filter((v,i,a)=>a.indexOf(v)===i),
    lm:fallback.lm||1, zm:fallback.zm||1, af:fallback.af||0.9, fm:fallback.fm||1,
  };
}

async function bewerteWithAgent(formData, geoData, fallback) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const FB = {...fallback, quelle:'fallback', vergleichsInserate:[], einschaetzung:'', begruendung:''};
  if(!apiKey){ console.warn('ANTHROPIC_API_KEY fehlt — Fallback'); return FB; }

  console.log(`KI-Agent: ${formData.plz} ${formData.ort||''}`);
  const t0 = Date.now();
  try {
    const text   = await runAgentLoop(apiKey, buildUserMessage(formData, geoData));
    const raw    = extractJSON(text);
    const result = normalize(raw, formData, geoData, fallback);
    if(!result){ console.warn('Agent: unplausibler Wert → Fallback'); return FB; }
    console.log(`Agent: CHF ${result.total.toLocaleString('de-CH')} | Score ${result.score} | ${result.vergleichsInserate?.length||0} Inserate | ${Math.round((Date.now()-t0)/1000)}s`);
    return result;
  } catch(err){
    console.error('Agent Fehler:', err.message); return FB;
  }
}

module.exports = { bewerteWithAgent };
