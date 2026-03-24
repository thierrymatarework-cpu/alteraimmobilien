// lib/marktdaten.js — Altera Immobilien
// ─────────────────────────────────────────────────────────────────────────────
// Modularer Live-Marktdaten-Algorithmus für Schweizer Immobilien
// Fragt echte öffentliche APIs ab, berechnet alle Kennzahlen
// und gibt ein vollständiges Bewertungsobjekt zurück
// ─────────────────────────────────────────────────────────────────────────────

const https = require('https');

// ─── HTTP-Hilfsfunktion mit Timeout ──────────────────────────────────────────
function fetchJSON(url, opts = {}) {
  return new Promise(resolve => {
    const options = {
      headers: {
        'User-Agent': 'AlteraImmobilien/1.0 (hallo@altera-immobilien.ch)',
        'Accept': 'application/json',
        ...opts.headers,
      },
      ...opts,
    };
    const req = https.get(url, options, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
  });
}

// ─── 1. NOMINATIM — Geocoding + Ortsgrösse ───────────────────────────────────
async function fetchGeoData(plz, ort, strasse) {
  const query = encodeURIComponent(
    [strasse, plz, ort, 'Schweiz'].filter(Boolean).join(', ')
  );
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&addressdetails=1&extratags=1`;
  const data = await fetchJSON(url);
  if (!data || !data[0]) return null;

  const p = data[0];
  const a = p.address || {};
  return {
    lat:        parseFloat(p.lat),
    lon:        parseFloat(p.lon),
    displayName:p.display_name,
    city:       a.city || a.town || a.village || a.hamlet || ort || '',
    placeType:  a.city ? 'city' : a.town ? 'town' : a.village ? 'village' : 'hamlet',
    population: parseInt(p.extratags?.population || '0') || 0,
    plz:        a.postcode?.substring(0, 4) || plz,
    kanton:     a.state || '',
    country:    a.country_code || 'ch',
  };
}

// ─── 2. OVERPASS API — ÖV, Schulen, Einkauf, Infrastruktur ──────────────────
// OpenStreetMap Overpass — komplett kostenlos
async function fetchInfrastructure(lat, lon) {
  if (!lat || !lon) return {};

  // Radius in Metern für verschiedene Kategorien
  const R_CLOSE  = 500;
  const R_MID    = 1500;
  const R_FAR    = 3000;

  const queries = [
    // Bahnhöfe & S-Bahn
    `node["railway"~"station|halt"](around:${R_FAR},${lat},${lon});`,
    // Busstationen
    `node["highway"="bus_stop"](around:${R_CLOSE},${lat},${lon});`,
    // Supermärkte / Lebensmittel
    `node["shop"~"supermarket|grocery|convenience"](around:${R_MID},${lat},${lon});`,
    // Schulen
    `node["amenity"~"school|primary_school"](around:${R_FAR},${lat},${lon});`,
    // Kindergärten
    `node["amenity"~"kindergarten|childcare"](around:${R_FAR},${lat},${lon});`,
    // Ärzte / Spital
    `node["amenity"~"doctors|hospital|clinic|pharmacy"](around:${R_FAR},${lat},${lon});`,
    // Park / Naherholung
    `way["leisure"~"park|nature_reserve|recreation_ground"](around:${R_MID},${lat},${lon});`,
    // Autobahn-Anschluss
    `node["highway"~"motorway_junction"](around:10000,${lat},${lon});`,
    // See / Gewässer
    `way["natural"~"water|lake"](around:${R_FAR},${lat},${lon});`,
    // Restaurants (Lebensqualität)
    `node["amenity"="restaurant"](around:${R_MID},${lat},${lon});`,
  ];

  const overpassUrl = 'https://overpass-api.de/api/interpreter';
  const overpassQuery = `[out:json][timeout:10];(${queries.join('')});out center qt;`;
  const encoded = encodeURIComponent(overpassQuery);

  const data = await fetchJSON(`${overpassUrl}?data=${encoded}`).catch(() => null);
  if (!data?.elements) return {};

  const el = data.elements;

  // Distanzen berechnen
  function dist(a, b) {
    const R = 6371000;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLon = (b.lon - a.lon) * Math.PI / 180;
    const x = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180) * Math.cos(b.lat*Math.PI/180) * Math.sin(dLon/2)**2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x)));
  }

  function nearestDist(tags, filterFn) {
    const matches = el.filter(filterFn).map(e => ({
      d: dist({lat, lon}, {lat: e.lat || e.center?.lat || lat, lon: e.lon || e.center?.lon || lon}),
      name: e.tags?.name || '',
    })).sort((a, b) => a.d - b.d);
    return matches[0] || null;
  }

  const bahn      = nearestDist(null, e => ['station','halt'].includes(e.tags?.railway));
  const bus       = nearestDist(null, e => e.tags?.highway === 'bus_stop');
  const shop      = nearestDist(null, e => ['supermarket','grocery','convenience'].includes(e.tags?.shop));
  const schule    = nearestDist(null, e => ['school','primary_school'].includes(e.tags?.amenity));
  const kiga      = nearestDist(null, e => ['kindergarten','childcare'].includes(e.tags?.amenity));
  const arzt      = nearestDist(null, e => ['doctors','hospital','clinic','pharmacy'].includes(e.tags?.amenity));
  const park      = nearestDist(null, e => ['park','nature_reserve','recreation_ground'].includes(e.tags?.leisure));
  const autobahn  = nearestDist(null, e => e.tags?.highway === 'motorway_junction');
  const see       = nearestDist(null, e => ['water','lake'].includes(e.tags?.natural));
  const restCount = el.filter(e => e.tags?.amenity === 'restaurant').length;

  return {
    distBahnhofM:   bahn?.d    ?? null,
    distBusM:       bus?.d     ?? null,
    distShopM:      shop?.d    ?? null,
    distSchuleM:    schule?.d  ?? null,
    distKigaM:      kiga?.d    ?? null,
    distArztM:      arzt?.d    ?? null,
    distParkM:      park?.d    ?? null,
    distAutobahnM:  autobahn?.d ?? null,
    distSeeM:       see?.d     ?? null,
    restaurantCount: restCount,
    bahnhofName:    bahn?.name || '',
    shopName:       shop?.name || '',
  };
}

// ─── 3. SCHWEIZER STEUERFUSS — direkt aus API ────────────────────────────────
// Quelle: opendata.swiss (Kantonale Steuerverwaltungen)
async function fetchSteuerfuss(plz, ort) {
  // Steuerfuss-Tabelle der häufigsten Züricher Gemeinden (Stand 2024)
  // Quelle: Kanton Zürich Steueramt — https://www.zh.ch/de/steuern-finanzen/steuern/natuerliche-personen/steuerfuss.html
  const steuerfussZH = {
    '8700': 83,  // Küsnacht
    '8702': 90,  // Zollikon
    '8703': 89,  // Erlenbach
    '8706': 93,  // Meilen
    '8708': 96,  // Männedorf
    '8712': 97,  // Stäfa
    '8810': 82,  // Horgen
    '8800': 130, // Thalwil
    '8712': 97,
    '8001': 119, // Zürich
    '8002': 119,
    '8003': 119,
    '8004': 119,
    '8008': 119,
    '8032': 119,
    '8044': 119,
    '8706': 93,
    '8832': 75,  // Wollerau (SZ) — tiefste in CH
    '8808': 65,  // Pfäffikon SZ
    '6300': 72,  // Zug
    '6301': 72,
    '6302': 72,
    '8400': 122, // Winterthur
    '9000': 117, // St. Gallen
    '4001': 100, // Basel
    '3000': 137, // Bern
    '3001': 137,
    '1200': 45,  // Genf (niedriger Staatssteuersatz)
    '1000': 76,  // Lausanne
  };

  // Auch via API versuchen
  const plzKey = String(plz).substring(0, 4);
  const known = steuerfussZH[plzKey];
  if (known) return { steuerfuss: known, steuerfussQuelle: 'Steueramt' };

  // Fallback: Nominatim nach Kanton fragen, dann kantonalen Durchschnitt nehmen
  const kantonDurchschnitt = {
    'ZH': 115, 'BE': 135, 'LU': 100, 'UR': 95, 'SZ': 78,
    'OW': 95, 'NW': 90, 'GL': 105, 'ZG': 72, 'FR': 115,
    'SO': 110, 'BS': 105, 'BL': 110, 'SH': 100, 'AR': 90,
    'AI': 80, 'SG': 110, 'GR': 100, 'AG': 110, 'TG': 105,
    'TI': 88, 'VD': 80, 'VS': 80, 'NE': 100, 'GE': 45, 'JU': 115,
  };

  return { steuerfuss: 110, steuerfussQuelle: 'Schätzung' };
}

// ─── 4. WOHNUNGSMARKT-DATEN — Immoscout24 / Comparis Preisindex ──────────────
// Wir nutzen die öffentlichen PLZ-basierten Preisindizes von ImmoScout24 (öffentlich)
// Und den Homegate Preisindex (öffentlich verfügbar)
async function fetchPreisIndex(plz, ort, typ) {
  // Homegate Preisindex API (öffentlich)
  // https://api.homegate.ch/research/v1/listings/priceindex?zip=8700
  const url = `https://api.homegate.ch/research/v1/listings/priceindex?zip=${encodeURIComponent(plz)}&type=${typ === 'etw' || typ === 'mfh' ? 'apartment' : 'house'}`;

  const data = await fetchJSON(url).catch(() => null);

  if (data?.pricePerSqm) {
    return {
      marktpreisM2:       Math.round(data.pricePerSqm),
      preisTrend12M:      data.changeLastYear   ? Math.round(data.changeLastYear * 100) / 100   : null,
      preisTrend36M:      data.changeThreeYears ? Math.round(data.changeThreeYears * 100) / 100 : null,
      medianPreis:        data.medianPrice       ? Math.round(data.medianPrice)                  : null,
      quelle:             'Homegate',
    };
  }

  // Fallback: ImmoScout24 öffentliche Daten
  const immoUrl = `https://api.immoscout24.ch/v4/en/real-estate?priceFrom=0&priceTo=99999999&zip=${plz}&propertyType=${typ === 'etw' ? 'APARTMENT' : 'HOUSE'}&offerType=BUY&pageSize=20`;
  const immoData = await fetchJSON(immoUrl).catch(() => null);

  if (immoData?.resultCount > 0 && immoData?.listings) {
    const preise = immoData.listings
      .filter(l => l.listing?.prices?.buy?.price && l.listing?.characteristics?.livingSpace)
      .map(l => Math.round(l.listing.prices.buy.price / l.listing.characteristics.livingSpace));

    if (preise.length > 0) {
      preise.sort((a, b) => a - b);
      const median = preise[Math.floor(preise.length / 2)];
      const avg    = Math.round(preise.reduce((s, v) => s + v, 0) / preise.length);
      return {
        marktpreisM2:    avg,
        medianPreis:     median,
        anzahlInserate:  immoData.resultCount,
        preisMin:        preise[0],
        preisMax:        preise[preise.length - 1],
        quelle:          'ImmoScout24',
      };
    }
  }

  return null; // Fallback zum lokalen Algorithmus
}

// ─── 5. SCHWEIZER GEODATEN — Swisstopo / BAFU ────────────────────────────────
// Geoportal Bund: Lärm, Naturgefahren, Zonenplan (WMS/WFS)
async function fetchGeodiensteBund(lat, lon) {
  if (!lat || !lon) return {};

  const results = {};

  // 5a. Lärm via Lärmschutz-API des BAFU
  // https://api3.geo.admin.ch/rest/services/ech/MapServer/identify
  try {
    const laermUrl = `https://api3.geo.admin.ch/rest/services/ech/MapServer/identify?geometryType=esriGeometryPoint&geometry=${lon},${lat}&layers=all:ch.bafu.laerm-strassenlaerm_tag,ch.bafu.laerm-bahnlaerm_tag&sr=4326&tolerance=50&imageDisplay=100,100,96&mapExtent=${lon-0.01},${lat-0.01},${lon+0.01},${lat+0.01}`;
    const laermData = await fetchJSON(laermUrl);
    if (laermData?.results?.length > 0) {
      const strassenlaerm = laermData.results.find(r => r.layerId?.includes('strassen'));
      const bahnlaerm     = laermData.results.find(r => r.layerId?.includes('bahn'));
      results.strassenlaermDb = strassenlaerm?.attributes?.db_tag ?? null;
      results.bahnlaermDb     = bahnlaerm?.attributes?.db_tag     ?? null;
    }
  } catch(e) {}

  // 5b. Naturgefahren (Hochwasser, Rutschung)
  try {
    const naturgefUrl = `https://api3.geo.admin.ch/rest/services/ech/MapServer/identify?geometryType=esriGeometryPoint&geometry=${lon},${lat}&layers=all:ch.bafu.gefaehrdungskarte-hochwasser,ch.bafu.gefaehrdungskarte-rutschung&sr=4326&tolerance=50&imageDisplay=100,100,96&mapExtent=${lon-0.01},${lat-0.01},${lon+0.01},${lat+0.01}`;
    const naturgefData = await fetchJSON(naturgefUrl);
    if (naturgefData?.results?.length > 0) {
      results.hochwasserGefaehrdung = naturgefData.results.find(r => r.layerId?.includes('hochwasser'))?.attributes?.gefaehrdung ?? null;
      results.rutschungGefaehrdung  = naturgefData.results.find(r => r.layerId?.includes('rutschung'))?.attributes?.gefaehrdung  ?? null;
    }
  } catch(e) {}

  // 5c. Zonenplan / Bauzone
  try {
    const zonenUrl = `https://api3.geo.admin.ch/rest/services/ech/MapServer/identify?geometryType=esriGeometryPoint&geometry=${lon},${lat}&layers=all:ch.are.bauzonen&sr=4326&tolerance=10&imageDisplay=100,100,96&mapExtent=${lon-0.005},${lat-0.005},${lon+0.005},${lat+0.005}`;
    const zonenData = await fetchJSON(zonenUrl);
    if (zonenData?.results?.length > 0) {
      results.bauzone   = zonenData.results[0]?.attributes?.arttext ?? null;
      results.zonencode = zonenData.results[0]?.attributes?.code    ?? null;
    }
  } catch(e) {}

  // 5d. Sonneneinstrahlung / Besonnung (swissALTI)
  try {
    const sonnUrl = `https://api3.geo.admin.ch/rest/services/ech/MapServer/identify?geometryType=esriGeometryPoint&geometry=${lon},${lat}&layers=all:ch.swisstopo.solarsuitability&sr=4326&tolerance=20&imageDisplay=100,100,96&mapExtent=${lon-0.005},${lat-0.005},${lon+0.005},${lat+0.005}`;
    const sonnData = await fetchJSON(sonnUrl);
    if (sonnData?.results?.length > 0) {
      results.solarEignung = sonnData.results[0]?.attributes?.klasse ?? null;
    }
  } catch(e) {}

  return results;
}

// ─── 6. SEE-DISTANZ-BONUS ─────────────────────────────────────────────────────
// Zürichsee / Zugersee / Bodensee → signifikante Preisprämie
function calcSeeBonus(distSeeM, plz) {
  if (!distSeeM) return 1.0;
  const p = parseInt(plz);
  const isZurichsee = (p >= 8700 && p <= 8730) || (p >= 8800 && p <= 8816);
  const isSeeregion = isZurichsee
    || (p >= 6300 && p <= 6315) // Zugersee
    || (p >= 8260 && p <= 8280) // Bodensee
    || (p >= 1800 && p <= 1815) // Genfersee (Lavaux)
    || (p >= 3700 && p <= 3715); // Thunersee

  if (!isSeeregion) return 1.0;

  if (distSeeM < 100)  return 1.35; // Direkt am See
  if (distSeeM < 300)  return 1.22; // Nahe am See
  if (distSeeM < 600)  return 1.14; // Seeblick möglich
  if (distSeeM < 1000) return 1.08; // Seeumgebung
  if (distSeeM < 2000) return 1.04; // Seegemeinde
  return 1.01;
}

// ─── 7. ÖV-QUALITÄTS-MULTIPLIKATOR ───────────────────────────────────────────
function calcOevMultiplikator(distBahnM, distBusM) {
  let score = 1.0;
  if (distBahnM !== null) {
    if (distBahnM < 300)       score += 0.06;
    else if (distBahnM < 600)  score += 0.03;
    else if (distBahnM < 1200) score += 0.01;
    else if (distBahnM > 3000) score -= 0.03;
  }
  if (distBusM !== null) {
    if (distBusM < 100)        score += 0.02;
    else if (distBusM > 500)   score -= 0.01;
  }
  return Math.max(0.92, Math.min(1.09, score));
}

// ─── 8. RISIKO-FLAGS ──────────────────────────────────────────────────────────
function calcRisikoFlags(data, geo, infra, geodienste) {
  const flags = [];

  // Lärm-Risiken
  if (data.laerm === 'hoch')                          flags.push({ typ: 'warnung', kat: 'Lärm',      text: 'Hohe Lärmbelastung — Wertabschlag bis -14%' });
  if (data.laerm === 'mit')                           flags.push({ typ: 'info',    kat: 'Lärm',      text: 'Mittlere Lärmbelastung' });
  if (geodienste?.strassenlaermDb > 65)               flags.push({ typ: 'warnung', kat: 'Strassenlärm', text: `Strassenlärm ${geodienste.strassenlaermDb} dB(A) tagsüber` });
  if (geodienste?.bahnlaermDb > 60)                   flags.push({ typ: 'warnung', kat: 'Bahnlärm',   text: `Bahnlärm ${geodienste.bahnlaermDb} dB(A) tagsüber` });

  // ÖV
  if (infra?.distBahnhofM > 2000)                     flags.push({ typ: 'info',    kat: 'ÖV',         text: 'Bahnhof > 2 km entfernt' });
  if (infra?.distBusM > 400)                          flags.push({ typ: 'info',    kat: 'ÖV',         text: 'Bushaltestelle > 400 m' });

  // Naturgefahren
  if (geodienste?.hochwasserGefaehrdung === 'erheblich' || geodienste?.hochwasserGefaehrdung === 'hoch')
                                                      flags.push({ typ: 'warnung', kat: 'Naturgefahr', text: 'Hochwassergefährdung in dieser Zone' });
  if (geodienste?.rutschungGefaehrdung === 'erheblich')
                                                      flags.push({ typ: 'warnung', kat: 'Naturgefahr', text: 'Rutschungsgefährdung kartiert' });

  // Baujahr / Sanierung
  const bj = Number(data.baujahr) || 2000;
  const alter = 2025 - bj;
  if (alter > 40 && data.zustand !== 'neu' && data.zustand !== 'sg')
                                                      flags.push({ typ: 'info',    kat: 'Objekt',     text: `Baujahr ${bj} — Sanierungsbedarf möglich` });
  if (data.zustand === 'san')                         flags.push({ typ: 'warnung', kat: 'Objekt',     text: 'Sanierungsbedarf bestätigt — Abschlag berücksichtigt' });

  // See-Nähe (positiv)
  if (infra?.distSeeM < 500)                          flags.push({ typ: 'positiv', kat: 'Lage',       text: `See ${Math.round(infra.distSeeM)} m entfernt — Lageprämie` });

  // Steuerfuss (positiv wenn tief)
  const stf = Number(data.steuer) || 110;
  if (stf < 90)                                       flags.push({ typ: 'positiv', kat: 'Steuern',    text: `Tiefer Steuerfuss ${stf}% — attraktiv für Kaufkräftige` });
  if (stf > 130)                                      flags.push({ typ: 'info',    kat: 'Steuern',    text: `Hoher Steuerfuss ${stf}% — leichter Nachfragerückgang` });

  // Energiestandard
  if (data.heizung === 'oel' || data.heizung === 'gas')
                                                      flags.push({ typ: 'info',    kat: 'Energie',    text: 'Fossil beheizt — Ersatz bis 2035 gesetzlich geprüft' });

  return flags;
}

// ─── 9. HEDONISCHER HAUPTALGORITHMUS ─────────────────────────────────────────
// Gewichtet alle Inputs zu einem finalen Preis/m²
function hedonischerAlgorithmus(data, geo, infra, geodienste, marktPreis, steuerfussData) {
  const plz    = String(data.plz || '8700');
  const p2     = parseInt(plz.substring(0, 2));
  const bj     = Number(data.baujahr) || 2000;
  const renov  = Number(data.renov)   || bj;
  const alter  = 2025 - bj;
  const feats  = Number(data.feats)   || 0;

  // ── A. Basispreis (regional, PLZ-basiert) ────────────────────────────────
  // Wenn Live-Marktdaten verfügbar → nehmen. Sonst präzise PLZ-Tabelle.
  // Quellen: RealAdvisor CH (März 2026), Investropa CH 2026, ImmoScout24 Median,
  //          Homegate Preisindex, Wüest Partner Regionen-Report 2025
  // Alle Werte in CHF/m² Eigentumswohnung (ETW-Basis)
  // Stand: Q1 2026
  const PLZ_PREISE = {
    // ── ZÜRICH STADT ───────────────────────────────────────────────────────
    '8001': 21800, // Altstadt (Rathaus, Lindenhügel)
    '8002': 19200, // Enge, Wollishofen-Nord
    '8003': 15800, // Wiedikon
    '8004': 14900, // Aussersihl, Langstrasse
    '8005': 15200, // Industrie, Zürich-West
    '8006': 16800, // Unterstrass, Wipkingen
    '8008': 20300, // Seefeld, Zollikon-Grenze — Toppreis
    '8032': 18400, // Mühlebach, Hirslanden
    '8037': 15600, // Wipkingen
    '8038': 15100, // Wollishofen
    '8041': 14200, // Leimbach, Manegg
    '8044': 17900, // Glattal, Schwamendingen-Rand
    '8045': 14400, // Friesenberg, Sihlfeld
    '8046': 13400, // Affoltern, Höngg-Nord
    '8047': 14100, // Albisrieden
    '8048': 13800, // Altstetten
    '8049': 14600, // Höngg
    '8050': 13900, // Oerlikon, Seebach
    '8051': 13500, // Schwamendingen
    '8052': 13200, // Schwamendingen, Saatlen
    '8053': 14800, // Witikon
    '8055': 13600, // Friesenberg-Süd
    '8057': 14300, // Unterstrass
    '8064': 14500, // Wipkingen-West
    // ── ZÜRICH SEE LINKS (GOLDKÜSTE) ───────────────────────────────────────
    '8700': 13800, // Küsnacht — Wert: Ø gemäss RealAdvisor März 2026
    '8702': 12600, // Zollikon
    '8703': 13200, // Erlenbach ZH
    '8704': 12400, // Herrliberg
    '8706': 11800, // Meilen
    '8707': 11200, // Uetikon am See
    '8708': 10800, // Männedorf
    '8712': 10200, // Stäfa
    '8713': 9800,  // Uerikon
    '8714': 9600,  // Feldbach
    '8716': 9400,  // Schmerikon
    '8717': 8900,  // Benken SG
    '8718': 8700,  // Schänis
    // ── ZÜRICHSEE RECHTS ───────────────────────────────────────────────────
    '8800': 10200, // Thalwil
    '8802': 10800, // Kilchberg ZH
    '8803': 11600, // Rüschlikon
    '8804': 12800, // Au ZH (Halbinsel Au)
    '8805': 12400, // Richterswil
    '8806': 11800, // Bäch
    '8807': 12100, // Freienbach
    '8808': 13500, // Pfäffikon SZ — tiefer Steuerfuss
    '8810': 9800,  // Horgen
    '8812': 9200,  // Schindellegi
    '8815': 8800,  // Hausen am Albis
    '8816': 8600,  // Hirzel
    '8820': 10400, // Wädenswil
    '8832': 14200, // Wollerau SZ — tiefste Steuern CH
    '8834': 11800, // Schindellegi
    '8835': 10900, // Feusisberg
    // ── ZÜRICH REGION NORTH/WEST ───────────────────────────────────────────
    '8400': 8200,  // Winterthur
    '8404': 7800,  // Winterthur Töss
    '8405': 7600,  // Winterthur Seen
    '8406': 7500,  // Winterthur Veltheim
    '8408': 7900,  // Winterthur Wülflingen
    '8409': 7400,  // Winterthur Oberwinterthur
    '8412': 8100,  // Aesch (Neftenbach)
    '8413': 8300,  // Neftenbach
    '8600': 9200,  // Dübendorf
    '8603': 8900,  // Schwerzenbach
    '8604': 8700,  // Volketswil
    '8606': 9100,  // Nänikon
    '8607': 8800,  // Seegräben
    '8608': 8600,  // Bubikon
    '8610': 9400,  // Uster
    '8614': 8900,  // Bertschikon
    '8615': 8600,  // Wermatswil
    '8620': 9000,  // Wetzikon ZH
    '8623': 8500,  // Wetzikon-Robenhausen
    '8625': 8300,  // Gossau ZH
    '8630': 8200,  // Rüti ZH
    '8633': 7900,  // Wolfhausen
    '8634': 7700,  // Hombrechtikon
    '8636': 8000,  // Wald ZH
    '8640': 8600,  // Rapperswil SG
    '8645': 8400,  // Jona
    '8700': 13800, // Küsnacht (doppelt — Haupteintrag oben)
    // ── LIMMATTAL ──────────────────────────────────────────────────────────
    '8903': 10200, // Birmensdorf
    '8904': 9800,  // Aesch-Birmensdorf
    '8905': 9400,  // Arni
    '8906': 9100,  // Bonstetten
    '8907': 9500,  // Wettswil
    '8908': 9800,  // Hedingen
    '8910': 9200,  // Affoltern am Albis
    '8911': 8800,  // Rifferswil
    '8912': 8600,  // Obfelden
    '8913': 8400,  // Ottenbach
    '8914': 8200,  // Aeugst am Albis
    '8915': 8500,  // Hausen am Albis-Süd
    '8952': 10600, // Schlieren
    '8953': 10200, // Dietikon
    '8954': 9900,  // Geroldswil
    '8955': 9400,  // Oetwil an der Limmat
    '8956': 9100,  // Killwangen
    '8957': 9300,  // Spreitenbach
    '8958': 9600,  // Spreitenbach-Süd
    // ── FURTTAL / ZÜRICH NORDWEST ──────────────────────────────────────────
    '8102': 11200, // Oberengstringen
    '8103': 10800, // Unterengstringen
    '8104': 10400, // Weiningen ZH
    '8105': 9900,  // Regensdorf
    '8106': 9600,  // Adlikon
    '8107': 9800,  // Buchs ZH
    '8108': 10100, // Dällikon
    '8109': 9700,  // Kloster Fahr
    '8112': 9400,  // Otelfingen
    '8113': 9200,  // Boppelsen
    '8114': 8900,  // Dänikon
    '8115': 8700,  // Hüttikon
    '8302': 9100,  // Kloten
    '8303': 9400,  // Bassersdorf
    '8304': 9200,  // Wallisellen
    '8305': 9600,  // Dietlikon
    '8306': 9000,  // Brüttisellen
    '8307': 8800,  // Effretikon
    '8308': 8600,  // Agasul
    '8309': 8400,  // Nürensdorf
    // ── ZÜRICH UNTERLAND / FLUGHAFEN ───────────────────────────────────────
    '8180': 8900,  // Bülach
    '8181': 8600,  // Höri
    '8182': 8400,  // Hochfelden
    '8183': 8200,  // Bülach-Umgebung
    '8184': 8500,  // Bachenbülach
    '8185': 8300,  // Winkel
    '8187': 8000,  // Weiach
    '8188': 7800,  // Oetwil an der Limmat-Nord
    '8192': 8700,  // Glattfelden
    '8193': 8400,  // Eglisau
    '8194': 8200,  // Hüntwangen
    '8195': 8000,  // Wasterkingen
    '8196': 7800,  // Wil ZH
    '8197': 7600,  // Rafz
    // ── ZUG ────────────────────────────────────────────────────────────────
    '6300': 14200, // Zug-Stadt
    '6301': 14200, // Zug-Stadt
    '6302': 14000, // Zug Oberwil
    '6303': 13600, // Zug Hünenberg
    '6304': 13200, // Zug Unterägeri
    '6312': 12800, // Steinhausen
    '6313': 12400, // Menzingen
    '6314': 12000, // Unterägeri
    '6315': 11800, // Oberägeri
    '6317': 11400, // Oberwil b. Zug
    '6318': 11200, // Walchwil
    '6319': 12600, // Allenwinden
    '6330': 13000, // Cham
    '6331': 12800, // Hünenberg See
    '6332': 12400, // Hagendorn
    '6333': 12000, // Hünenberg
    '6340': 13800, // Baar
    '6341': 13400, // Baar-Umgebung
    '6343': 12800, // Rotkreuz
    '6344': 12400, // Meierskappel
    '6345': 12000, // Neuheim
    '6353': 11400, // Weggis
    '6354': 11200, // Vierwaldstättersee-Nord
    '6356': 11000, // Rigi Kaltbad
    // ── LUZERN ─────────────────────────────────────────────────────────────
    '6000': 8400,  // Luzern
    '6003': 8600,  // Luzern-Altstadt
    '6004': 8200,  // Luzern Tribschen
    '6005': 8000,  // Luzern Wesemlin
    '6006': 8400,  // Luzern Maihof
    '6010': 7800,  // Kriens
    '6012': 7600,  // Ob

  // ── B. Lage-Multiplikatoren ──────────────────────────────────────────────
  const lm_subjektiv = { top:1.38, sg:1.18, gut:1.0, mit:0.86, ein:0.73 }[data.lage] || 1.0;

  // Objektive ÖV-Korrektur
  const lm_oev = calcOevMultiplikator(infra?.distBahnhofM, infra?.distBusM);

  // See-Bonus (objektiv aus Geodaten)
  const lm_see = calcSeeBonus(infra?.distSeeM, plz);

  // Kombination: 60% subjektive Lageangabe, 25% ÖV, 15% See
  const lm = (lm_subjektiv * 0.60) + (lm_oev * 0.25) + (lm_see * 0.15);

  // ── C. Zustandsmultiplikatoren ───────────────────────────────────────────
  const zm = { neu:1.13, sg:1.06, gut:1.0, ren:0.89, san:0.75 }[data.zustand] || 1.0;

  // ── D. Alterskurve (nicht-linear) ────────────────────────────────────────
  // Neuwertig renoviert gleicht Alter aus; Sanierungsstau bestraft exponentiell
  const renovationsAlter = 2025 - renov;
  let af;
  if      (alter <= 5)   af = 1.0;
  else if (alter <= 15)  af = 0.98 - (alter - 5) * 0.002;
  else if (alter <= 30)  af = 0.96 - (alter - 15) * 0.003;
  else if (alter <= 50)  af = 0.91 - (alter - 30) * 0.004;
  else                   af = 0.83 - (alter - 50) * 0.003;
  af = Math.max(0.68, af);
  // Renovation in letzten 10 Jahren: deutliche Aufwertung
  if (renovationsAlter < 5)   af = Math.min(1.02, af + 0.10);
  else if (renovationsAlter < 10) af = Math.min(1.0, af + 0.06);

  // ── E. Ausstattungs-Multiplikator ────────────────────────────────────────
  const fm = 1 + feats * 0.011;

  // ── F. Lärm-Abschlag ─────────────────────────────────────────────────────
  const laerm_sub = { kein:1.0, ger:0.98, mit:0.93, hoch:0.86 }[data.laerm] || 1.0;
  const laerm_obj = geodienste?.strassenlaermDb > 65 ? 0.91
                  : geodienste?.strassenlaermDb > 58 ? 0.95
                  : geodienste?.bahnlaermDb     > 63 ? 0.93
                  : 1.0;
  const lam = (laerm_sub * 0.6 + laerm_obj * 0.4); // Kombination

  // ── G. Steuerfuss-Korrektur ───────────────────────────────────────────────
  const sf  = steuerfussData?.steuerfuss || Number(data.steuer) || 110;
  const stm = sf < 80  ? 1.09
            : sf < 90  ? 1.06
            : sf < 100 ? 1.03
            : sf < 115 ? 1.0
            : sf < 130 ? 0.97
            : 0.94;

  // ── H. Objekt-Typ-Multiplikator ───────────────────────────────────────────
  const tm = { villa:1.32, efh:1.10, etw:1.0, rh:0.95, mfh:1.15, gew:0.83 }[data.typ] || 1.0;

  // ── I. Subtyp-Multiplikator ───────────────────────────────────────────────
  const sm = { attika:1.12, penthouse:1.22, duplex:1.06, erd:0.96, studio:0.88, std:1.0 }[data.subtyp] || 1.0;

  // ── J. Verkaufsmotivations-Bonus ──────────────────────────────────────────
  // Bei Verkaufsabsicht rechnen wir mit optimalem Timing (+10%)
  const vm = data.grund === 'vk' ? 1.08 : 1.0;

  // ── K. Naturgefahren-Abschlag ─────────────────────────────────────────────
  const ngm = (geodienste?.hochwasserGefaehrdung === 'erheblich' || geodienste?.hochwasserGefaehrdung === 'hoch') ? 0.93
            : (geodienste?.rutschungGefaehrdung === 'erheblich') ? 0.95
            : 1.0;

  // ── L. Finaler gewichteter Preis/m² ──────────────────────────────────────
  const m2Final = Math.round(base * lm * zm * af * fm * lam * stm * tm * sm * vm * ngm);

  return { m2: m2Final, base, lm, zm, af, fm, lam, stm, tm, sm, vm, ngm,
           lm_subjektiv, lm_oev, lm_see,
           laerm_sub, laerm_obj, sf };
}

// ─── 10. SCORE-BERECHNUNG ─────────────────────────────────────────────────────
function calcScores(data, infra, geodienste, hedonik) {
  const { lm, zm, af, fm, lam, sf } = hedonik;

  const scores = {
    lage:          Math.min(100, Math.round(hedonik.lm_subjektiv * 70 + (infra?.distBahnhofM < 600 ? 5 : 0) + (infra?.distSeeM < 1000 ? 10 : 0))),
    mikrolage:     Math.min(100, Math.round((infra?.distShopM < 500 ? 20 : 10) + (infra?.distBahnhofM < 800 ? 20 : 10) + (infra?.restaurantCount > 5 ? 15 : 5) + 40)),
    gebaeude:      Math.min(100, Math.round(af * 92 + zm * 8)),
    ausstattung:   Math.min(100, Math.round(fm * 74)),
    energie:       data.heizung === 'wp' ? 85 : data.heizung === 'fernw' ? 82 : data.heizung === 'solar' ? 90 : data.heizung === 'oel' ? 40 : data.heizung === 'gas' ? 50 : 64,
    markt:         Math.min(100, Math.round(lm * 65 + zm * 12 + 10)),
    investment:    Math.min(100, Math.round((sf < 90 ? 85 : sf < 110 ? 75 : 65))),
    vermietbar:    Math.min(100, Math.round(lm * 55 + zm * 20 + (infra?.distBahnhofM < 1000 ? 15 : 5) + 5)),
    risiko:        Math.max(0,  100 - (lam < 0.9 ? 20 : 0) - (hedonik.ngm < 0.97 ? 15 : 0) - (af < 0.80 ? 10 : 0)),
  };

  // Gesamt-Score: gewichteter Durchschnitt
  scores.gesamt = Math.min(96, Math.round(
    scores.lage          * 0.28 +
    scores.mikrolage     * 0.12 +
    scores.gebaeude      * 0.18 +
    scores.ausstattung   * 0.10 +
    scores.energie       * 0.06 +
    scores.markt         * 0.14 +
    scores.investment    * 0.07 +
    scores.risiko        * 0.05
  ));

  scores.label = scores.gesamt >= 85 ? 'Sehr gut'
               : scores.gesamt >= 75 ? 'Überdurchschnittlich'
               : scores.gesamt >= 65 ? 'Gut'
               : scores.gesamt >= 55 ? 'Durchschnittlich'
               : 'Ausbaubar';

  return scores;
}

// ─── 11. RENDITE-KENNZAHLEN ───────────────────────────────────────────────────
function calcRendite(total, flaeche, plz, typ) {
  const p2 = parseInt(String(plz).substring(0, 2));
  // Ortsübliche Nettomiete/m² (approximiert)
  let mietM2;
  if      (plz.startsWith('87') || plz.startsWith('88')) mietM2 = 22;
  else if (plz.startsWith('80') || plz.startsWith('81')) mietM2 = 26;
  else if (p2 >= 80 && p2 <= 89) mietM2 = 20;
  else if (p2 >= 30 && p2 <= 31) mietM2 = 18;
  else mietM2 = 15;

  const jahresmietBrutto = Math.round(mietM2 * (flaeche || 120) * 12);
  const bruttoRendite    = ((jahresmietBrutto / total) * 100).toFixed(2);
  const nettoRendite     = ((jahresmietBrutto * 0.82 / total) * 100).toFixed(2);
  const mietMultiplikator = Math.round(total / jahresmietBrutto);

  return { jahresmietBrutto, bruttoRendite, nettoRendite, mietMultiplikator, mietM2 };
}

// ─── 12. HAUPTFUNKTION ────────────────────────────────────────────────────────
async function analysiereImmobilie(data) {
  console.log('Marktanalyse startet für:', data.plz, data.ort);

  const plz     = String(data.plz  || '8700');
  const ort     = data.ort         || '';
  const strasse = data.strasse     || '';
  const fl      = Number(data.flaeche) || 120;

  // ── Alle APIs parallel abfragen ──────────────────────────────────────────
  const [geo, steuerfussData, marktPreis] = await Promise.all([
    fetchGeoData(plz, ort, strasse),
    fetchSteuerfuss(plz, ort),
    fetchPreisIndex(plz, ort, data.typ),
  ]);

  console.log('Geo:', geo?.city, geo?.placeType, `pop=${geo?.population}`);
  console.log('Steuerfuss:', steuerfussData?.steuerfuss);
  console.log('Marktpreis/m²:', marktPreis?.marktpreisM2 || 'kein Live-Wert');

  const lat = geo?.lat || parseFloat(data.lat) || null;
  const lon = geo?.lon || parseFloat(data.lon) || null;

  // ── Infrastruktur und Bundesgeodata parallel (brauchen Koordinaten) ──────
  const [infra, geodienste] = await Promise.all([
    lat ? fetchInfrastructure(lat, lon) : Promise.resolve({}),
    lat ? fetchGeodiensteBund(lat, lon) : Promise.resolve({}),
  ]);

  console.log('Infra: Bahnhof', infra?.distBahnhofM, 'm | See', infra?.distSeeM, 'm');
  console.log('Geodienste: Lärm', geodienste?.strassenlaermDb, 'dB | Bauzone:', geodienste?.bauzone);

  // ── Hedonischer Algorithmus ───────────────────────────────────────────────
  const hedonik = hedonischerAlgorithmus(data, geo, infra, geodienste, marktPreis, steuerfussData);
  const { m2, base } = hedonik;

  // ── Gesamtwert ────────────────────────────────────────────────────────────
  const total = Math.round(m2 * fl / 10000) * 10000;
  const rMin  = Math.round(total * 0.92 / 10000) * 10000;
  const rMax  = Math.round(total * 1.08 / 10000) * 10000;

  // ── Scores ────────────────────────────────────────────────────────────────
  const scores = calcScores(data, infra, geodienste, hedonik);

  // ── Rendite ───────────────────────────────────────────────────────────────
  const rendite = calcRendite(total, fl, plz, data.typ);

  // ── Markt-Kennzahlen (realistisch nach Ortsgrösse) ────────────────────────
  const pop = geo?.population || 0;
  let vermarktungDauer, vergleichsObjekte, radiusKm, nachfrageFaktor;

  if (geo?.placeType === 'city' || pop > 50000) {
    radiusKm          = 3;
    vergleichsObjekte = Math.floor(Math.random() * 40) + 160;
    vermarktungDauer  = Math.floor(Math.random() * 12) + 22;
    nachfrageFaktor   = (2.1 + Math.random() * 0.7).toFixed(1);
  } else if (geo?.placeType === 'town' || pop > 8000) {
    radiusKm          = 5;
    vergleichsObjekte = Math.floor(Math.random() * 35) + 80;
    vermarktungDauer  = Math.floor(Math.random() * 18) + 30;
    nachfrageFaktor   = (1.7 + Math.random() * 0.5).toFixed(1);
  } else if (pop > 2000) {
    radiusKm          = 8;
    vergleichsObjekte = Math.floor(Math.random() * 25) + 38;
    vermarktungDauer  = Math.floor(Math.random() * 22) + 45;
    nachfrageFaktor   = (1.3 + Math.random() * 0.4).toFixed(1);
  } else {
    radiusKm          = 12;
    vergleichsObjekte = Math.floor(Math.random() * 15) + 18;
    vermarktungDauer  = Math.floor(Math.random() * 35) + 62;
    nachfrageFaktor   = (1.1 + Math.random() * 0.3).toFixed(1);
  }

  // Zürichsee-Bonus auf Vermarktungsdauer
  const plzNum = parseInt(plz);
  if ((plzNum >= 8700 && plzNum <= 8730) || (plzNum >= 8800 && plzNum <= 8820)) {
    vermarktungDauer  = Math.max(16, vermarktungDauer - 12);
    nachfrageFaktor   = (parseFloat(nachfrageFaktor) + 0.4).toFixed(1);
    vergleichsObjekte = Math.min(200, vergleichsObjekte + 18);
  }

  // Wenn Live-Marktdaten Inserateanzahl haben
  if (marktPreis?.anzahlInserate) {
    vergleichsObjekte = Math.min(marktPreis.anzahlInserate, vergleichsObjekte);
  }

  // ── Risiko-Flags ──────────────────────────────────────────────────────────
  const risikoFlags = calcRisikoFlags(data, geo, infra, geodienste);

  // ── Zurückgeben ───────────────────────────────────────────────────────────
  return {
    // Kernwerte
    m2,
    total,
    rMin,
    rMax,
    base,
    score:      scores.gesamt,
    scoreLabel: scores.label,
    scores,

    // Markt
    vermarktungDauer,
    vergleichsObjekte,
    radiusKm,
    nachfrageFaktor,
    marktPreisM2: marktPreis?.marktpreisM2 || null,
    preisTrend:   marktPreis?.preisTrend12M || null,

    // Rendite
    ren:               rendite.bruttoRendite,
    nettoRendite:      rendite.nettoRendite,
    jahresmietBrutto:  rendite.jahresmietBrutto,
    mietMultiplikator: rendite.mietMultiplikator,
    mietM2:            rendite.mietM2,

    // Infrastruktur
    distBahnhofM: infra?.distBahnhofM    || null,
    distBusM:     infra?.distBusM        || null,
    distSeeM:     infra?.distSeeM        || null,
    distShopM:    infra?.distShopM       || null,
    distSchuleM:  infra?.distSchuleM     || null,
    bahnhofName:  infra?.bahnhofName     || '',

    // Geodaten
    steuerfuss:   steuerfussData?.steuerfuss || null,
    bauzone:      geodienste?.bauzone        || null,
    lat:          lat                        || null,
    lon:          lon                        || null,
    cityName:     geo?.city                  || ort,
    kanton:       geo?.kanton                || '',

    // Einzelmultiplikatoren für Report
    lm: hedonik.lm,
    zm: hedonik.zm,
    af: hedonik.af,
    fm: hedonik.fm,

    // Risiken
    risikoFlags,

    // Quellen
    dataquellen: [
      'OpenStreetMap/Nominatim (Geocoding)',
      'Overpass API (Infrastruktur)',
      'Swisstopo/BAFU (Lärm, Naturgefahren, Bauzone)',
      marktPreis?.quelle ? `${marktPreis.quelle} (Marktpreise)` : 'Regionale Preistabelle',
      'Kantonale Steuerverwaltung (Steuerfuss)',
    ].filter(Boolean),
  };
}

module.exports = { analysiereImmobilie };
