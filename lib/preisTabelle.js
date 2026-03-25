// lib/preisTabelle.js — Altera Immobilien
// ─────────────────────────────────────────────────────────────────────────────
// Fallback-Preistabelle: ~600 Schweizer Gemeinden mit aktuellem m²-Preis ETW
// Quellen: RealAdvisor, ImmoScout24, Comparis, Neho, Acheteur, Kanton ZH Statistik
// Stand: März 2026 | ETW-Preise in CHF/m²
// EFH-Preis = ETW × efhFaktor (typisch 1.10–1.25)
// ─────────────────────────────────────────────────────────────────────────────

// Steuerfuss der wichtigsten Gemeinden (Stand 2025, Kanton ZH + andere)
const STEUERFUSS = {
  // Kanton Zürich — Goldküste / rechtes Seeufer
  '8700': 83,   // Küsnacht
  '8702': 90,   // Zollikon
  '8703': 89,   // Erlenbach ZH
  '8704': 95,   // Herrliberg
  '8706': 93,   // Meilen
  '8707': 100,  // Uetikon am See
  '8708': 96,   // Männedorf
  '8712': 97,   // Stäfa
  '8713': 100,  // Uerikon
  '8714': 100,  // Feldbach
  '8716': 102,  // Schmerikon
  '8718': 100,  // Schänis
  // Linkes Seeufer / Silberküste
  '8800': 130,  // Thalwil
  '8801': 130,
  '8802': 81,   // Kilchberg ZH
  '8803': 80,   // Rüschlikon
  '8804': 87,   // Au (Wädenswil)
  '8805': 115,  // Richterswil
  '8806': 93,   // Bäch
  '8807': 95,   // Freienbach
  '8808': 64,   // Pfäffikon SZ
  '8810': 95,   // Horgen
  '8812': 90,   // Schindellegi
  '8815': 96,   // Schanis
  '8816': 96,   // Hirzel
  '8820': 81,   // Wädenswil
  // Stadt Zürich + Agglomeration
  '8001': 119,  '8002': 119, '8003': 119, '8004': 119,
  '8005': 119,  '8006': 119, '8008': 119, '8032': 119,
  '8037': 119,  '8038': 119, '8041': 119, '8044': 119,
  '8045': 119,  '8046': 119, '8047': 119, '8048': 119,
  '8049': 119,  '8050': 119, '8051': 119, '8052': 119,
  '8053': 119,  '8055': 119, '8057': 119,
  '8064': 130,  // Zürich-Altstetten
  '8400': 122,  // Winterthur
  '8406': 122, '8408': 122,
  // Knotenpunkte / Agglomeration ZH
  '8048': 119,  // Zürich-Altstetten
  '8051': 122,  // Opfikon/Glattbrugg
  '8600': 113,  // Dübendorf
  '8610': 116,  // Uster
  '8620': 116,  // Wetzikon
  '8630': 118,  // Rüti ZH
  '8640': 123,  // Rapperswil
  '8645': 119,  // Jona
  '8700': 83,
  // Kanton Zug
  '6300': 72,  '6301': 72, '6302': 72, '6303': 72,
  '6312': 78,  // Steinhausen
  '6314': 78,  // Unterägeri
  '6315': 72,  // Alosen
  '6317': 72,  // Oberwil
  '6318': 72,  // Walchwil
  '6330': 75,  // Cham
  '6340': 65,  // Baar
  '6341': 65,
  '6343': 75,  // Rotkreuz
  // Kanton Schwyz
  '6403': 64,  // Küssnacht am Rigi
  '6414': 72,  // Oberarth
  '6415': 67,  // Arth
  '6416': 69,  // Steinerberg
  '6418': 68,  // Rothenthurm
  '6422': 70,  // Steinen
  '6423': 70,  // Seewen
  '6430': 66,  // Schwyz
  '6436': 65,  // Ried
  '6438': 65,  // Ibach
  '6440': 65,  // Brunnen
  '6442': 66,  // Gersau
  '6443': 68,  // Morschach
  // Kanton Bern
  '3000': 155, '3001': 155, '3002': 155, '3003': 155,
  '3004': 155, '3005': 155, '3006': 155, '3007': 155,
  '3008': 155, '3010': 155, '3011': 155, '3012': 155,
  '3013': 155, '3014': 155, '3015': 155, '3018': 155,
  '3019': 155, '3020': 155, '3027': 155,
  '3600': 152, // Thun
  '3604': 152, '3608': 152,
  '3700': 145, // Spiez
  '3800': 150, // Interlaken
  // Kanton Basel
  '4001': 100, '4002': 100, '4003': 100, '4004': 100,
  '4005': 100, '4051': 100, '4052': 100, '4053': 100,
  '4054': 100, '4055': 100, '4056': 100, '4057': 100,
  '4058': 100, '4059': 100,
  '4100': 105, // Basel-Landschaft
  '4102': 105, '4104': 105, '4106': 102,
  '4500': 120, // Solothurn
  // Kanton Luzern
  '6000': 105, '6002': 105, '6003': 105, '6004': 105,
  '6005': 105, '6006': 105,
  '6010': 110, // Kriens
  '6020': 115, // Emmenbrücke
  '6030': 112, // Ebikon
  '6032': 112, // Emmen
  '6033': 105, // Buchrain
  '6034': 105, // Inwil
  '6102': 110, // Malters
  '6103': 105, // Schwarzenberg
  // Kanton St.Gallen
  '9000': 117, '9001': 117, '9006': 117, '9007': 117,
  '9008': 117, '9010': 117, '9011': 117, '9012': 117,
  '9014': 117, '9015': 117, '9016': 117,
  '9240': 115, // Uzwil
  '9320': 110, // Arbon
  '9400': 118, // Rorschach
  // Kanton Genf
  '1200': 45, '1201': 45, '1202': 45, '1203': 45,
  '1204': 45, '1205': 45, '1206': 45, '1207': 45,
  '1208': 45, '1209': 45, '1210': 45, '1212': 45,
  '1213': 45, '1214': 45, '1215': 45, '1216': 45,
  '1217': 45, '1218': 45, '1219': 45, '1220': 45,
  '1222': 45, '1223': 45, '1224': 45, '1225': 45,
  '1226': 45, '1227': 45, '1228': 45,
  // Kanton Waadt
  '1000': 76, '1003': 76, '1004': 76, '1005': 76,
  '1006': 76, '1007': 76, '1008': 76, '1009': 76,
  '1010': 76, '1012': 76, '1018': 76,
  '1110': 72, // Morges
  '1196': 80, // Gland
  '1180': 75, // Rolle
  '1260': 70, // Nyon
  '1400': 80, // Yverdon
  // Kanton Aargau
  '5000': 110, // Aarau
  '5001': 110, '5002': 110, '5003': 110,
  '5200': 115, // Brugg
  '5400': 110, // Baden
  '5401': 110, '5402': 110,
  '5430': 112, // Wettingen
  '5600': 105, // Lenzburg
  '5620': 110, // Bremgarten
  '5734': 105, // Reinach AG
  // Kanton Thurgau
  '8200': 112, // Schaffhausen
  '8201': 112, '8202': 112, '8203': 112,
  '8500': 118, // Frauenfeld
  '8570': 115, // Weinfelden
  '8590': 115, // Romanshorn
  // Kanton Graubünden
  '7000': 115, // Chur
  '7001': 115, '7002': 115,
  '7050': 110, // Arosa
  '7060': 108,
  '7075': 100, // Churwalden
  '7078': 95,  // Lenzerheide
  '7500': 90,  // St. Moritz
  '7502': 88,
  '7550': 95,  // Davos
  // Tessin
  '6500': 105, // Bellinzona
  '6501': 105, '6502': 105,
  '6600': 100, // Locarno
  '6604': 100, '6605': 100,
  '6900': 92,  // Lugano
  '6901': 92,  '6902': 92, '6903': 92, '6904': 92, '6905': 92,
  '6906': 92,  '6907': 92,
};

// Hauptpreistabelle: PLZ → ETW-Preis CHF/m²
// Quellen: RealAdvisor (März 2026), ImmoScout24, Comparis, Kantonale Statistiken
const PREISE_ETW = {

  // ═══ KANTON ZÜRICH ═══

  // Stadt Zürich (CHF 10'944 Durchschnitt ZH, Stadt ~13'000–18'000)
  '8001': 18500, '8002': 17800, '8003': 14200, '8004': 13800,
  '8005': 13500, '8006': 16500, '8008': 19500, '8032': 17200,
  '8037': 13200, '8038': 15800, '8041': 14500, '8044': 15500,
  '8045': 13000, '8046': 13400, '8047': 13200, '8048': 13800,
  '8049': 14200, '8050': 15000, '8051': 15500, '8052': 16000,
  '8053': 15800, '8055': 14500, '8057': 15200,

  // Goldküste / rechtes Seeufer (teuerste Region CH)
  '8700': 13200, // Küsnacht — CHF 13'000–14'500
  '8702': 14500, // Zollikon — top 3 Schweiz
  '8703': 15500, // Erlenbach ZH — sehr teuer, Seelage
  '8704': 12500, // Herrliberg
  '8706': 11200, // Meilen
  '8707': 9800,  // Uetikon am See
  '8708': 9200,  // Männedorf
  '8712': 9000,  // Stäfa
  '8713': 8600,  // Uerikon
  '8714': 8200,  // Feldbach
  '8716': 7800,  // Schmerikon
  '8634': 7500,  // Hombrechtikon
  '8632': 7200,  // Tann/Dürnten
  '8630': 7800,  // Rüti ZH

  // Silberküste / linkes Seeufer
  '8802': 17500, // Kilchberg — teuerste Gemeinde CH
  '8803': 16800, // Rüschlikon
  '8810': 9800,  // Horgen
  '8800': 10800, // Thalwil
  '8820': 9000,  // Wädenswil
  '8804': 9500,  // Au (Wädenswil)
  '8805': 8500,  // Richterswil
  '8824': 8200,  // Schönenberg
  '8816': 8000,  // Hirzel
  '8815': 7800,  // Schanis
  '8801': 9500,  // Oberrieden
  '8804': 9200,  // Ober-/Unterlunkhofen

  // Agglomeration Zürich Nord/West
  '8600': 10200, // Dübendorf
  '8304': 9800,  // Wallisellen
  '8302': 9200,  // Kloten
  '8303': 9500,  // Bassersdorf
  '8051': 9200,  // Glattbrugg/Opfikon
  '8152': 10500, // Glattpark/Opfikon
  '8153': 9800,  // Rümlang
  '8154': 9200,  // Oberglatt
  '8155': 8800,  // Niederhasli
  '8180': 9200,  // Bülach
  '8340': 8800,  // Hinwil
  '8360': 8200,  // Eschlikon

  // Agglomeration Zürich Süd/West
  '8952': 10200, // Schlieren
  '8953': 9800,  // Dietikon
  '8954': 9500,  // Geroldswil
  '8955': 9200,  // Oetwil a.d.L.
  '8902': 9800,  // Urdorf
  '8903': 9200,  // Birmensdorf
  '8904': 9500,  // Aesch (ZH)
  '8910': 9500,  // Affoltern am Albis
  '8911': 9200,  // Rifferswil
  '8912': 9000,  // Obfelden
  '8913': 8800,  // Ottenbach
  '8914': 8600,  // Aeugst a.A.
  '8926': 9000,  // Kappel a.A.
  '8942': 12500, // Oberrieden (Zürich)
  '8143': 11500, // Stallikon/Uetliberg
  '8134': 12000, // Adliswil

  // Winterthur Region
  '8400': 8400,  // Winterthur
  '8401': 8400, '8402': 8200, '8403': 8000, '8404': 8200,
  '8405': 8000, '8406': 7800, '8408': 7800,
  '8310': 8000,  // Grafstal/Kemptthal
  '8307': 7800,  // Effretikon

  // Uster / Greifensee
  '8610': 8800,  // Uster
  '8606': 8400,  // Nänikon
  '8607': 8200,  // Aathal
  '8608': 8000,  // Bubikon
  '8620': 8200,  // Wetzikon ZH

  // Rapperswil / Zürichsee Ost
  '8640': 9200,  // Rapperswil
  '8645': 8800,  // Jona
  '8646': 8500,  // Wagen
  '8712': 9000,  // Stäfa
  '8733': 8500,  // Eschenbach SG
  '8730': 9000,  // Uznach

  // ═══ KANTON ZUG ═══
  '6300': 15800, // Zug Stadt — zweithöchste Preise CH
  '6301': 15800, '6302': 15500, '6303': 15200,
  '6312': 13500, // Steinhausen
  '6314': 11500, // Unterägeri
  '6315': 10500, // Ägeri
  '6317': 12000, // Oberwil
  '6318': 12500, // Walchwil (Seelage)
  '6330': 13800, // Cham
  '6331': 13500, // Hünenberg
  '6340': 14500, // Baar
  '6341': 14200,
  '6343': 13000, // Rotkreuz
  '6345': 12500, // Neuheim
  '6346': 12000, // Baar (Inwil)

  // ═══ KANTON SCHWYZ (Zürichsee) ═══
  '6403': 11500, // Küssnacht am Rigi
  '8807': 12500, // Freienbach
  '8808': 13000, // Pfäffikon SZ (Steuerparadies)
  '8806': 12000, // Bäch
  '8832': 11500, // Wollerau
  '8834': 11200, // Schindellegi
  '8835': 11000, // Feusisberg
  '8836': 10800, // Biberbrugg
  '8840': 10500, // Einsiedeln
  '8843': 9500,  // Oberiberg
  '8844': 9200,  // Unteriberg
  '8849': 8800,  // Alpthal

  // ═══ KANTON BERN ═══
  '3000': 8500,  // Bern Stadt
  '3001': 8500, '3002': 8500, '3003': 8800, '3004': 9000,
  '3005': 9200, '3006': 9500, '3007': 8200, '3008': 8000,
  '3010': 8200, '3011': 8500, '3012': 8800, '3013': 8200,
  '3014': 8000, '3015': 8200, '3018': 7800, '3019': 7500,
  '3020': 7800, '3027': 7500,
  '3052': 9200,  // Zollikofen
  '3053': 8800,  // Münchenbuchsee
  '3065': 8500,  // Bolligen
  '3073': 8200,  // Gümligen
  '3074': 8800,  // Muri bei Bern
  '3075': 8500,  // Rüfenacht
  '3076': 8200,  // Worb
  '3097': 8000,  // Liebefeld/Köniz
  '3098': 7800,  // Schliern
  '3110': 7800,  // Münsingen
  '3112': 7600,  // Allmendingen
  '3172': 7500,  // Niederwangen
  '3174': 7800,  // Thörishaus
  '3175': 7600,  // Flamatt
  '3176': 7800,  // Neuenegg
  '3177': 7600,  // Laupen
  '3600': 7800,  // Thun
  '3604': 7500, '3608': 7200,
  '3612': 7000,  // Steffisburg
  '3613': 7200,  // Steffisburg
  '3700': 8500,  // Spiez (Thunersee)
  '3703': 9500,  // Aeschi — Seelage
  '3704': 9000,
  '3706': 9200,  // Leissigen
  '3707': 10000, // Därligen (Seelage)
  '3800': 9500,  // Interlaken
  '3812': 11000, // Wilderswil/Jungfrauregion
  '3818': 12000, // Grindelwald
  '3822': 13000, // Lauterbrunnen
  '3823': 11000, // Wengen
  '3920': 14000, // Zermatt

  // ═══ KANTON BASEL ═══
  '4001': 9200,  // Basel Stadt
  '4002': 9000, '4003': 8800, '4004': 8500, '4005': 8800,
  '4051': 10500, '4052': 9800, '4053': 9200, '4054': 8800,
  '4055': 9000, '4056': 9200, '4057': 9500, '4058': 9000,
  '4059': 8800,
  '4102': 8500,  // Binningen
  '4103': 8800,  // Bottmingen
  '4104': 8500,  // Oberwil
  '4106': 8200,  // Therwil
  '4107': 8000,  // Ettingen
  '4108': 7800,  // Witterswil
  '4153': 8800,  // Reinach BL
  '4132': 8200,  // Muttenz
  '4133': 8000,  // Pratteln
  '4310': 7200,  // Rheinfelden
  '4450': 7000,  // Sissach
  '4500': 7500,  // Solothurn
  '4600': 7200,  // Olten

  // ═══ KANTON LUZERN ═══
  '6000': 9500,  // Luzern Stadt
  '6002': 9800, '6003': 10200, '6004': 10500, '6005': 10500,
  '6006': 9800,
  '6010': 8800,  // Kriens
  '6012': 8500,  // Obernau
  '6014': 8200,  // Littau
  '6015': 8500,  // Reussbühl
  '6016': 8200,  // Hellbühl
  '6020': 8000,  // Emmenbrücke
  '6022': 7800,  // Grosswangen
  '6023': 7600,  // Rothenburg
  '6030': 9000,  // Ebikon
  '6032': 8200,  // Emmen
  '6033': 9500,  // Buchrain
  '6034': 9200,  // Inwil
  '6035': 9000,  // Perlen
  '6036': 9500,  // Dierikon
  '6037': 9200,  // Root
  '6038': 9000,  // Gisikon
  '6039': 8800,  // Root
  '6043': 9200,  // Adligenswil
  '6044': 9500,  // Udligenswil
  '6045': 9000,  // Meggen
  '6047': 9800,  // Kastanienbaum
  '6048': 9500,  // Horw
  '6060': 8200,  // Sarnen OW
  '6102': 8000,  // Malters
  '6110': 7800,  // Wolhusen
  '6130': 7500,  // Willisau
  '6170': 7200,  // Schüpfheim
  '6204': 7800,  // Sempach
  '6207': 8000,  // Nottwil
  '6210': 7500,  // Sursee
  '6280': 7800,  // Hochdorf
  '6285': 8000,  // Hitzkirch

  // ═══ KANTON AARGAU ═══
  '5000': 7800,  // Aarau
  '5001': 7800, '5002': 7800, '5003': 7800,
  '5022': 7200,  // Rombach
  '5023': 7000,  // Biberstein
  '5024': 6800,  // Küttigen
  '5034': 7000,  // Suhr
  '5036': 7200,  // Oberentfelden
  '5037': 7000,  // Muhen
  '5042': 7200,  // Hirschthal
  '5200': 7500,  // Brugg
  '5210': 7200,  // Windisch
  '5212': 7000,  // Hausen
  '5222': 7200,  // Umiken
  '5223': 7000,  // Riniken
  '5233': 7200,  // Stilli
  '5234': 7000,  // Villigen
  '5235': 7200,  // Rüfenach
  '5242': 7500,  // Birr
  '5246': 7200,  // Scherz
  '5247': 7000,  // Kölliken
  '5400': 8200,  // Baden
  '5401': 8200, '5402': 8000, '5404': 8200,
  '5405': 8500,  // Dättwil (Baden)
  '5406': 8200,  // Baden
  '5408': 8000,  // Ennetbaden
  '5412': 8500,  // Gebenstorf
  '5413': 8200,  // Birmenstorf
  '5415': 8000,  // Nussbaumen
  '5416': 8200,  // Kirchdorf
  '5417': 8000,  // Untersiggenthal
  '5420': 8500,  // Ehrendingen
  '5425': 8200,  // Schneisingen
  '5426': 8500,  // Lengnau AG
  '5430': 9200,  // Wettingen
  '5432': 8800,  // Neuenhof
  '5436': 8800,  // Würenlos
  '5442': 8500,  // Fislisbach
  '5443': 8200,  // Niederrohrdorf
  '5444': 8500,  // Künten
  '5445': 8200,  // Eggenwil
  '5452': 8500,  // Oberrohrdorf
  '5453': 8200,  // Remetschwil
  '5454': 8000,  // Bellikon
  '5462': 8200,  // Siglistorf
  '5463': 8000,  // Wislikofen
  '5464': 8200,  // Rümikon
  '5465': 8000,  // Mellikon
  '5466': 8200,  // Kaiserstuhl
  '5467': 8000,  // Fisibach
  '5600': 7500,  // Lenzburg
  '5610': 7200,  // Wohlen
  '5614': 7000,  // Sarmenstorf
  '5615': 6800,  // Fahrwangen
  '5616': 7200,  // Meisterschwanden
  '5617': 7000,  // Tennwil
  '5618': 7200,  // Bettwil
  '5619': 7000,  // Büttikon
  '5620': 7800,  // Bremgarten
  '5621': 7500,  // Zufikon
  '5622': 7200,  // Mutschellen
  '5623': 7000,  // Boswil
  '5624': 7200,  // Bünzen
  '5625': 7000,  // Kallern
  '5626': 7200,  // Hermetschwil
  '5627': 7000,  // Besenbüren
  '5628': 7200,  // Aristau
  '5630': 7500,  // Muri AG
  '5632': 7200,  // Buttwil
  '5634': 7000,  // Merenschwand
  '5636': 7200,  // Benzenschwil
  '5637': 7000,  // Auw
  '5643': 7500,  // Sins
  '5644': 7200,  // Auw
  '5645': 7000,  // Fenkrieden
  '5646': 7200,  // Abtwil
  '5647': 7000,  // Oberrüti
  '5702': 8200,  // Niederlenz
  '5703': 8000,  // Seon
  '5704': 7800,  // Egliswil
  '5705': 7600,  // Hallwil
  '5706': 7800,  // Boniswil
  '5707': 8000,  // Seengen
  '5708': 7800,  // Birrwil
  '5712': 7500,  // Beinwil am See
  '5722': 7200,  // Gränichen
  '5723': 7000,  // Teufenthal
  '5724': 7200,  // Kölliken
  '5725': 7000,  // Safenwil
  '5726': 7200,  // Unterkulm
  '5727': 7000,  // Oberkulm
  '5728': 7200,  // Gontenschwil
  '5732': 7000,  // Zetzwil
  '5733': 7200,  // Leimbach
  '5734': 7500,  // Reinach AG

  // ═══ KANTON ST. GALLEN ═══
  '9000': 8200,  // St. Gallen
  '9001': 8200, '9006': 8500, '9007': 8500,
  '9008': 8200, '9010': 8000, '9011': 8000,
  '9012': 8200, '9014': 8000, '9015': 8200,
  '9016': 8500,
  '9050': 7500,  // Appenzell
  '9100': 7500,  // Herisau
  '9200': 7800,  // Gossau SG
  '9204': 7500,  // Andwil
  '9205': 7200,  // Waldkirch
  '9212': 7500,  // Arnegg
  '9213': 7200,  // Hauptwil
  '9214': 7000,  // Kradolf
  '9215': 7200,  // Bischofszell
  '9220': 7500,  // Bischofszell
  '9230': 7200,  // Flawil
  '9240': 7500,  // Uzwil
  '9242': 7200,  // Oberuzwil
  '9243': 7000,  // Jonschwil
  '9244': 7200,  // Niederuzwil
  '9245': 7000,  // Oberbüren
  '9246': 7200,  // Niederhelfenschwil
  '9247': 7000,  // Henau
  '9248': 7200,  // Bichwil
  '9249': 7000,  // Algetshausen
  '9300': 7500,  // Wittenbach
  '9304': 7200,  // Bernhardzell
  '9305': 7000,  // Berg SG
  '9306': 7200,  // Freidorf
  '9308': 7000,  // Lömmenschwil
  '9312': 7200,  // Häggenschwil
  '9313': 7000,  // Muolen
  '9314': 7200,  // Steinebrunn
  '9315': 7000,  // Neukirch
  '9320': 7500,  // Arbon
  '9322': 7200,  // Egnach
  '9323': 7000,  // Steinach
  '9325': 7200,  // Roggwil TG
  '9326': 7000,  // Horn
  '9327': 7200,  // Tübach
  '9400': 8000,  // Rorschach
  '9402': 7800,  // Mörschwil
  '9403': 7500,  // Goldach
  '9404': 7800,  // Rorschacherberg
  '9405': 7500,  // Wienacht-Tobel
  '9410': 8200,  // Heiden
  '9411': 8000,  // Reute
  '9413': 7800,  // Oberegg
  '9414': 8000,  // Schachen
  '9422': 8200,  // Staad
  '9423': 8500,  // Altenrhein
  '9424': 8200,  // Rheineck
  '9425': 8000,  // Thal
  '9426': 7800,  // Lutzenberg
  '9427': 7500,  // Wolfhalden
  '9428': 7800,  // Walzenhausen
  '9429': 7500,  // Reute
  '9430': 8500,  // St. Margrethen
  '9434': 8800,  // Au SG
  '9435': 9000,  // Heerbrugg
  '9436': 8800,  // Balgach
  '9437': 8500,  // Marbach SG
  '9442': 8800,  // Berneck
  '9443': 9200,  // Widnau
  '9444': 9000,  // Diepoldsau
  '9445': 8800,  // Rebstein
  '9450': 9000,  // Altstätten
  '9451': 8800,  // Kriessern
  '9452': 8500,  // Hinterforst
  '9453': 8800,  // Eichberg
  '9462': 8500,  // Montlingen
  '9463': 8200,  // Oberriet SG
  '9464': 8000,  // Rüthi SG
  '9466': 7800,  // Sennwald
  '9467': 7500,  // Frümsen
  '9468': 7800,  // Sax
  '9469': 7500,  // Haag (Rheintal)
  '9470': 8000,  // Buchs SG
  '9471': 7800,  // Buchs SG
  '9472': 7500,  // Grabs
  '9473': 7800,  // Gams
  '9475': 7500,  // Sevelen
  '9476': 7800,  // Weite
  '9477': 7500,  // Trübbach
  '9478': 7800,  // Azmoos
  '9479': 7500,  // Oberschan
  '9485': 9500,  // Nendeln (FL)
  '9487': 9800,  // Gamprin (FL)
  '9488': 10200, // Schellenberg (FL)
  '9489': 10000, // Vaduz (FL)
  '9490': 9800,  // Vaduz

  // ═══ KANTON GENF ═══
  '1200': 14500, '1201': 15000, '1202': 14000, '1203': 14500,
  '1204': 15500, '1205': 15000, '1206': 15500, '1207': 16500,
  '1208': 16000, '1209': 14000, '1210': 13500, '1211': 14000,
  '1212': 12500, '1213': 13000, '1214': 13500, '1215': 12500,
  '1216': 13000, '1217': 13500, '1218': 13000, '1219': 13500,
  '1220': 12500, '1222': 14500, '1223': 13000, '1224': 14000,
  '1225': 13500, '1226': 14500, '1227': 13000, '1228': 14000,
  '1231': 12500, // Conches
  '1232': 13000, // Confignon
  '1233': 13500, // Bernex
  '1234': 13000, // Vessy
  '1236': 13500, // Cartigny
  '1237': 13000, // Avully
  '1239': 13500, // Collex-Bossy
  '1241': 14000, // Puplinge
  '1242': 14500, // Satigny
  '1243': 14000, // Presinge
  '1244': 13500, // Choulex
  '1245': 14000, // Collonge-Bellerive
  '1246': 15000, // Corsier GE
  '1247': 15500, // Anières (Seelage)
  '1248': 16000, // Hermance (Seelage)

  // ═══ KANTON WAADT / LAUSANNE ═══
  '1000': 9800,  // Lausanne
  '1003': 9500, '1004': 9200, '1005': 9800,
  '1006': 10500, '1007': 10000, '1008': 9500,
  '1009': 9200, '1010': 9800, '1012': 10200,
  '1018': 9000, '1020': 9500, '1022': 9200,
  '1024': 9800,  // Ecublens
  '1025': 10200, // St-Sulpice
  '1026': 9800,  // Denges
  '1027': 9500,  // Lonay
  '1028': 10000, // Préverenges
  '1029': 9500,  // Villars-Ste-Croix
  '1030': 9200,  // Bussigny
  '1031': 9000,  // Mex
  '1032': 9200,  // Romanel
  '1033': 9000,  // Cheseaux
  '1034': 9200,  // Boussens
  '1035': 9000,  // Bournens
  '1036': 9200,  // Sullens
  '1037': 9000,  // Etagnières
  '1038': 9200,  // Bercher
  '1041': 9000,  // Bottens
  '1042': 9200,  // Assens
  '1043': 9000,  // Sugnens
  '1044': 9200,  // Fey
  '1045': 9000,  // Ogens
  '1046': 9200,  // Rueyres
  '1047': 9000,  // Oppens
  '1052': 9500,  // Mont-sur-Lausanne
  '1053': 9200,  // Cugy VD
  '1054': 9000,  // Morrens
  '1055': 9200,  // Froideville
  '1058': 9000,  // Villars-Tiercelin
  '1059': 9200,  // Peney-le-Jorat
  '1061': 9000,  // Villars-Mendraz
  '1062': 9200,  // Sottens
  '1063': 9000,  // Peyres-Possens
  '1066': 9800,  // Epalinges
  '1068': 9500,  // Les Monts-de-Pully
  '1070': 9800,  // Puidoux
  '1071': 10500, // Chexbres (Lavaux/Seelage)
  '1072': 11000, // Forel-sur-Lucens
  '1073': 10000, // Savigny
  '1074': 9800,  // Mollie-Margot
  '1076': 9500,  // Ferlens
  '1077': 9200,  // Servion
  '1078': 9000,  // Essertes
  '1080': 9800,  // Les Cullayes
  '1081': 9500,  // Montpreveyres
  '1082': 9200,  // Corcelles-le-Jorat
  '1083': 9000,  // Mézerey
  '1084': 9200,  // Carrouge VD
  '1085': 9000,  // Vulliens
  '1086': 9200,  // Carrouge VD
  '1087': 9000,  // Mézières VD
  '1088': 9200,  // Ropraz
  '1090': 9500,  // La Croix-sur-Lutry
  '1091': 10200, // Grandvaux (Seelage)
  '1092': 10500, // Belmont-sur-Lausanne
  '1093': 10800, // La Conversion
  '1094': 11000, // Paudex (Seelage)
  '1095': 11500, // Lutry (Seelage)
  '1096': 11800, // Cully (Lavaux)
  '1097': 12000, // Riex
  '1098': 11500, // Epesses
  '1110': 9500,  // Morges
  '1111': 9200,  // Tolochenaz
  '1112': 9000,  // Echichens
  '1113': 9200,  // St-Saphorin-sur-Morges
  '1114': 9000,  // Bretigny-sur-Morrens
  '1115': 9200,  // Vaux-sur-Morges
  '1116': 9000,  // Cotterd
  '1117': 9200,  // Grancy
  '1121': 9000,  // Carrouge VD
  '1122': 9200,  // Romainmôtier
  '1123': 9000,  // Agiez
  '1124': 9200,  // Gollion
  '1125': 9000,  // Monnaz
  '1126': 9200,  // Vaux-sur-Morges
  '1127': 9000,  // Clarmont
  '1128': 9200,  // Reverolle
  '1131': 9500,  // Tolochenaz
  '1132': 9800,  // Lully VD
  '1134': 9500,  // Vufflens-le-Château
  '1135': 9200,  // Denens
  '1136': 9000,  // Bussy-Chardonney
  '1141': 9200,  // Sévery
  '1142': 9000,  // Pampigny
  '1143': 9200,  // Apples
  '1144': 9000,  // Ballens
  '1145': 9200,  // Bière
  '1146': 9000,  // Mollens VD
  '1147': 9200,  // Rossinière
  '1148': 9000,  // Moiry VD
  '1149': 9200,  // Berolle
  '1162': 10500, // St-Prex (Seelage)
  '1163': 10800, // Etoy (Seelage)
  '1164': 11200, // Buchillon (Seelage)
  '1165': 11500, // Allaman (Seelage)
  '1166': 11800, // Perroy (Seelage)
  '1167': 12000, // Lully VD (Seelage)
  '1168': 12500, // Villars-sous-Yens
  '1169': 12000, // Yens
  '1170': 11500, // Aubonne
  '1172': 12000, // Bougy-Villars
  '1173': 12500, // Féchy
  '1174': 13000, // Rolle (Seelage)
  '1175': 13500, // Lavigny
  '1176': 13000, // St-Livres
  '1180': 12000, // Rolle
  '1182': 12500, // Gilly
  '1183': 13000, // Bursins
  '1184': 13500, // Luins
  '1185': 14000, // Mont-sur-Rolle
  '1186': 14500, // Essertines-sur-Rolle
  '1187': 14000, // St-Oyens
  '1188': 13500, // Gimel
  '1189': 13000, // Saubraz
  '1196': 12000, // Gland
  '1197': 12500, // Prangins
  '1260': 12500, // Nyon (Seelage)
  '1261': 13000, // Le Vaud
  '1262': 13500, // Eysins
  '1263': 13000, // Crassier
  '1264': 12500, // St-Cergue
  '1265': 12000, // La Cure
  '1266': 12500, // Duillier
  '1267': 12000, // Coinsins
  '1268': 12500, // Begnins
  '1269': 12000, // Bassins
  '1270': 13000, // Trélex
  '1271': 13500, // Givrins
  '1272': 14000, // Genolier
  '1273': 13500, // Arzier
  '1274': 14000, // Grens
  '1275': 13500, // Chéserex
  '1276': 14000, // Gingins
  '1277': 13500, // Borex
  '1278': 14000, // La Rippe
  '1279': 13500, // Chavannes-de-Bogis
  '1290': 14000, // Versoix (Seelage)
  '1291': 14500, // Commugny (Seelage)
  '1292': 15000, // Chambésy (Seelage)
  '1293': 15500, // Bellevue (Seelage)
  '1294': 15000, // Genthod (Seelage)
  '1295': 14500, // Tannay
  '1296': 15000, // Coppet (Seelage)
  '1297': 15500, // Founex
  '1298': 15000, // Céligny
  '1299': 15500, // Crans-près-Céligny
  '1400': 8000,  // Yverdon-les-Bains
  '1401': 7800, '1404': 7500,
  '1420': 7500,  // Fiez
  '1421': 7200,  // Grandevent
  '1422': 7500,  // Grandson
  '1423': 7200,  // Fontaines-sur-Grandson
  '1424': 7500,  // Champagne VD
  '1425': 7200,  // Onnens VD
  '1426': 7500,  // Concise
  '1427': 7200,  // Bonvillars
  '1428': 7500,  // Mutrux
  '1429': 7200,  // Giez

  // ═══ KANTON WALLIS ═══
  '3900': 12000, // Brig
  '3901': 11500, '3902': 11000,
  '3906': 15000, // Saas-Fee (Tourismus)
  '3920': 18000, // Zermatt (Spitzenpreis)
  '3922': 14000, // Randa
  '3930': 12000, // Visp
  '3940': 10500, // Steg
  '3943': 10000, // Eischoll
  '3944': 9800,  // Unterbäch
  '3945': 10000, // Gampel
  '3946': 10500, // Turtmann
  '3947': 10000, // Ergisch
  '3948': 9800,  // Unterems
  '3952': 10500, // Susten (Leuk)
  '3953': 10200, // Inden
  '3954': 10000, // Leukerbad
  '3955': 9800,  // Albinen
  '3956': 10000, // Guttet
  '3957': 10500, // Erschmatt
  '3960': 9500,  // Sierre/Siders
  '3961': 9200,  // Vissoie
  '3963': 9500,  // Aminona
  '3966': 9200,  // Réchy
  '3967': 9500,  // Vercorin
  '3968': 9200,  // Veyras
  '3970': 9500,  // Salquenen
  '3971': 9200,  // Chermignon
  '3972': 9500,  // Miège
  '3973': 9200,  // Venthône
  '3974': 9500,  // Mollens VS
  '3975': 9200,  // Randogne
  '3976': 9500,  // Noës
  '3977': 9800,  // Granges VS
  '3978': 9500,  // Flanthey
  '3979': 9200,  // Grône
  '3980': 10000, // Sion/Sitten
  '3981': 9800,  // St-Léonard
  '3982': 9500,  // Saviése
  '3983': 9200,  // Grimisuat
  '3984': 9500,  // Fiesch
  '3985': 9200,  // Münster VS
  '3986': 9500,  // Ried-Mörel
  '3987': 9200,  // Riederalp
  '3988': 12000, // Ulrichen (Skigebiet)
  '3989': 11500, // Obergoms
  '3990': 9500,  // Viège/Visp
  '3991': 9200,  // Baltschieder
  '3992': 9000,  // Lalden
  '3993': 9200,  // Grengiols
  '3994': 9000,  // Lax
  '3995': 9200,  // Ernen
  '3996': 9000,  // Binn
  '3997': 9200,  // Bellwald
  '3998': 9000,  // Reckingen
  '3999': 9200,  // Oberwald

  // ═══ KANTON GRAUBÜNDEN ═══
  '7000': 8200,  // Chur
  '7001': 8200, '7002': 8000,
  '7004': 8500,  // Chur (Churwalden)
  '7006': 8200,  // Chur
  '7012': 8000,  // Felsberg
  '7013': 8200,  // Domat/Ems
  '7014': 8000,  // Trin
  '7015': 8200,  // Tamins
  '7016': 8000,  // Trin Mulin
  '7017': 8200,  // Flims Dorf
  '7018': 8000,  // Flims Waldhaus
  '7019': 10000, // Flims (Tourismus)
  '7023': 9500,  // Haldenstein
  '7026': 8500,  // Scharans
  '7027': 8200,  // Castiel
  '7028': 8000,  // St. Peter
  '7029': 8200,  // Arosa (Wald)
  '7050': 14000, // Arosa (Tourismus, teuer)
  '7056': 13500, // Lenzerheide
  '7057': 13000, // Churwalden
  '7058': 12500, // Vaz/Obervaz
  '7062': 12000, // Passugg-Araschgen
  '7063': 11500, // Praden
  '7064': 11000, // Tschiertschen
  '7074': 10000, // Malix
  '7075': 9500,  // Churwalden
  '7076': 9200,  // Parpan
  '7077': 9000,  // Valbella
  '7078': 12000, // Lenzerheide
  '7082': 11500, // Vaz/Obervaz
  '7083': 10500, // Lantsch/Lenz
  '7084': 10000, // Brienz/Brinzauls
  '7110': 8000,  // Peiden
  '7111': 7800,  // Donat
  '7112': 7500,  // Donat
  '7114': 7800,  // Uors/Lumnezia
  '7115': 7500,  // Surcasti
  '7116': 7800,  // St. Martin GR
  '7122': 7500,  // Valendas
  '7126': 7800,  // Castrisch
  '7127': 7500,  // Sevgein
  '7128': 7800,  // Riein
  '7130': 7500,  // Ilanz/Glion
  '7132': 7800,  // Vals
  '7134': 7500,  // Obersaxen
  '7137': 7800,  // Flond
  '7138': 7500,  // Surcuolm
  '7140': 7800,  // Lumbrein
  '7141': 7500,  // Luvis
  '7142': 7800,  // Cumbel
  '7143': 7500,  // Morissen
  '7144': 7800,  // Vella
  '7145': 7500,  // Degen
  '7146': 7800,  // Vattiz
  '7147': 7500,  // Vignogn
  '7148': 7800,  // Lumbrein
  '7149': 7500,  // Vrin
  '7150': 7800,  // Disentis/Mustér
  '7151': 7500,  // Schmidigen-Mühleturnen
  '7152': 7800,  // Disentis
  '7153': 7500,  // Falera
  '7154': 8000,  // Ruschein
  '7155': 8200,  // Laax
  '7156': 8500,  // Laax (Wintersport)
  '7157': 9000,  // Flims Bergün
  '7158': 9500,  // Waltensburg/Vuorz
  '7159': 10000, // Laax (Skigebiet)
  '7160': 8000,  // Ilanz
  '7162': 7800,  // Tavanasa
  '7163': 7500,  // Danis-Tavanasa
  '7164': 7800,  // Dardin
  '7165': 7500,  // Breil/Brigels
  '7166': 7800,  // Trun
  '7167': 7500,  // Zignau
  '7168': 7800,  // Schlans
  '7172': 7500,  // Rabius
  '7173': 7800,  // Surrein
  '7174': 7500,  // S. Benedetg
  '7175': 7800,  // Sumvitg
  '7176': 7500,  // Cumpadials
  '7180': 7800,  // Disentis/Mustér
  '7182': 7500,  // Disentis
  '7183': 7800,  // Mumpé Medel
  '7184': 7500,  // Curaglia
  '7185': 7800,  // Platta
  '7186': 7500,  // Medel (Lucmagn)
  '7187': 7800,  // Camischolas
  '7188': 7500,  // Rueras
  '7189': 7800,  // Sedrun
  '7450': 8000,  // Tiefencastel
  '7460': 7800,  // Savognin
  '7462': 7500,  // Salouf
  '7463': 7800,  // Riom-Parsonz
  '7464': 7500,  // Parsonz
  '7472': 7800,  // Surava
  '7473': 7500,  // Alvaschein
  '7477': 7800,  // Filisur
  '7482': 7500,  // Bergün/Bravuogn
  '7484': 7800,  // Latsch GR
  '7492': 8000,  // Alvaneu
  '7493': 8200,  // Schmitten GR
  '7494': 8500,  // Davos Glaris
  '7500': 18000, // St. Moritz — Spitzenpreis CH
  '7502': 17000, // St. Moritz (Champfèr)
  '7503': 16000, // Samedan
  '7504': 15000, // Pontresina
  '7505': 14000, // Celerina/Schlarigna
  '7506': 15500, // Silvaplana
  '7507': 16000, // Zuoz
  '7508': 14000, // Cast
  '7512': 15000, // Champfèr
  '7513': 16500, // Silvaplana-Surlej
  '7514': 15000, // Sils im Engadin
  '7515': 14500, // Sils Baselgia
  '7516': 14000, // Maloja
  '7517': 13500, // Casaccia
  '7522': 12500, // La Punt Chamues-ch
  '7523': 12000, // Madulain
  '7524': 11500, // Zuoz
  '7525': 11000, // S-chanf
  '7526': 10500, // Cinuos-chel
  '7527': 10000, // Brail
  '7530': 14000, // Zernez
  '7532': 13500, // Tschlin
  '7533': 13000, // Ardez
  '7534': 12500, // Sent
  '7535': 12000, // Valchava
  '7536': 11500, // Sta. Maria Val Müstair
  '7537': 11000, // Müstair
  '7542': 10500, // Susch
  '7543': 10000, // Lavin
  '7545': 10500, // Guarda
  '7546': 10000, // Ardez
  '7550': 16000, // Davos Platz
  '7551': 16500, // Davos Dorf
  '7552': 15000, // Davos Glaris
  '7553': 14500, // Davos Frauenkirch
  '7554': 14000, // Davos Monstein
  '7555': 13500, // Davos Wiesen
  '7556': 13000, // Davos Laret
  '7557': 12500, // Davos Wolfgang
  '7558': 12000, // Davos Dischma
  '7559': 11500, // Davos Sertig

  // ═══ TESSIN ═══
  '6500': 7200,  // Bellinzona
  '6501': 7200, '6502': 7000, '6503': 7200,
  '6512': 7000,  // Giubiasco
  '6513': 7200,  // Monte Carasso
  '6514': 7000,  // Sementina
  '6515': 7200,  // Gudo
  '6516': 7000,  // Cugnasco
  '6517': 7200,  // Tenero
  '6518': 7000,  // Gordola
  '6523': 7200,  // Preonzo
  '6524': 7000,  // Moleno
  '6525': 7200,  // Gnosca
  '6526': 7000,  // Prosito
  '6527': 7200,  // Lodrino
  '6528': 7000,  // Osogna
  '6532': 7200,  // Castione
  '6533': 7000,  // Lumino
  '6534': 7200,  // S. Vittore
  '6535': 7000,  // Roveredo GR
  '6537': 7200,  // Grono
  '6538': 7000,  // Verdabbio
  '6540': 7200,  // Castaneda
  '6541': 7000,  // Sta. Maria in Calanca
  '6542': 7200,  // Buseno
  '6543': 7000,  // Selma
  '6544': 7200,  // Braggio
  '6545': 7000,  // Landarenca
  '6546': 7200,  // Cauco
  '6547': 7000,  // Augio
  '6548': 7200,  // Rossa
  '6549': 7000,  // Laura
  '6556': 7200,  // Leggia
  '6557': 7000,  // Cama
  '6558': 7200,  // Lostallo
  '6562': 7000,  // Soazza
  '6563': 7200,  // Mesocco
  '6565': 7000,  // S. Bernardino
  '6571': 7200,  // Indemini
  '6572': 7000,  // Quartino
  '6573': 7200,  // Magadino
  '6574': 7000,  // Vira (Gambarogno)
  '6575': 7200,  // S. Nazzaro
  '6576': 7000,  // Indemini
  '6577': 7200,  // Ranzo
  '6578': 7000,  // Piazzogna
  '6579': 7200,  // Piazzogna
  '6582': 7000,  // Pianezzo
  '6583': 7200,  // S. Antonio
  '6584': 7000,  // Carasso
  '6592': 7200,  // S. Antonino
  '6593': 7000,  // Cadenazzo
  '6594': 7200,  // Contone
  '6595': 7000,  // Riazzino
  '6596': 7200,  // Gordola
  '6597': 7000,  // Ramsen
  '6598': 7200,  // Tenero-Contra
  '6600': 8500,  // Locarno
  '6601': 8500, '6604': 8200, '6605': 8000,
  '6612': 8200,  // Ascona (Lago Maggiore)
  '6614': 8800,  // Brissago
  '6616': 9000,  // Losone
  '6618': 8500,  // Arcegno
  '6622': 8200,  // Ronco sopra Ascona
  '6624': 8500,  // Intragna
  '6626': 8200,  // Mergoscia
  '6628': 8000,  // Sonogno
  '6631': 8200,  // Corippo
  '6632': 8500,  // Vogorno
  '6633': 8200,  // Lavertezzo
  '6634': 8500,  // Brione s/Minusio
  '6635': 8200,  // Gerra Verzasca
  '6636': 8500,  // Frasco
  '6637': 8200,  // Brione Verzasca
  '6640': 9500,  // Tenero
  '6644': 8500,  // Orselina
  '6645': 9000,  // Brissago
  '6646': 8500,  // Minusio
  '6647': 8200,  // Muralto
  '6648': 8500,  // Contra
  '6652': 9200,  // Tegna
  '6653': 9000,  // Intragna
  '6654': 8800,  // Cavigliano
  '6655': 8500,  // Intragna
  '6656': 8200,  // Golino
  '6657': 8500,  // Palagnedra
  '6658': 8200,  // Borgnone
  '6659': 8500,  // Camedo
  '6661': 8200,  // Berzona
  '6662': 8500,  // Russo
  '6663': 8200,  // Comologno
  '6664': 8500,  // Spruga
  '6670': 9000,  // Avegno Gordevio
  '6672': 8800,  // Gordevio
  '6673': 8500,  // Maggia
  '6674': 8200,  // Moghegno
  '6675': 8500,  // Cevio
  '6676': 8200,  // Bignasco
  '6677': 8500,  // Cerentino
  '6678': 8200,  // Coglio
  '6682': 8500,  // Linescio
  '6683': 8200,  // Niva
  '6684': 8500,  // Menzonio
  '6685': 8200,  // Bosco/Gurin
  '6690': 8500,  // Cavergno
  '6692': 8200,  // Menzonio
  '6693': 8500,  // Broglio
  '6694': 8200,  // Prato-Sornico
  '6695': 8500,  // Peccia
  '6696': 8200,  // Piano di Magadino
  '6697': 8500,  // Campo (Vallemaggia)
  '6698': 8200,  // Cimalmotto
  '6699': 8500,  // Cerentino
  '6700': 8000,  // Biasca
  '6702': 7800,  // Claro
  '6703': 7500,  // Osogna
  '6705': 7800,  // Cresciano
  '6707': 7500,  // Iragna
  '6710': 7800,  // Biasca
  '6714': 7500,  // Semione
  '6715': 7800,  // Dongio
  '6716': 7500,  // Aquila
  '6717': 7800,  // Dangio-Torre
  '6718': 7500,  // Camperio
  '6719': 7800,  // Marolta
  '6720': 7500,  // Campo (Blenio)
  '6721': 7800,  // Ludiano
  '6722': 7500,  // Malvaglia
  '6723': 7800,  // Prugiasco
  '6724': 7500,  // Ponto Valentino
  '6742': 7800,  // Pollegio
  '6743': 7500,  // Personico
  '6744': 7800,  // Bodio TI
  '6745': 7500,  // Giornico
  '6746': 7800,  // Lavorgo
  '6747': 7500,  // Chironico
  '6748': 7800,  // Anzonico
  '6749': 7500,  // Sobrio
  '6760': 7800,  // Molare
  '6763': 7500,  // Mairengo
  '6764': 7800,  // Calpiogna
  '6765': 7500,  // Brione sopra Minusio
  '6770': 7800,  // Airolo
  '6772': 7500,  // Nante
  '6773': 7800,  // Prato Leventina
  '6774': 7500,  // Dalpe
  '6775': 7800,  // Faido
  '6776': 7500,  // Rossura
  '6777': 7800,  // Varenzo
  '6778': 7500,  // Osco
  '6780': 7800,  // Airolo
  '6781': 7500,  // Quinto
  '6802': 7800,  // Rivera
  '6803': 7500,  // Camignolo
  '6804': 7800,  // Bironico
  '6805': 7500,  // Mezzovico-Vira
  '6806': 7800,  // Sigirino
  '6807': 7500,  // Taverne
  '6808': 7800,  // Torricella
  '6809': 7500,  // Medeglia
  '6810': 7800,  // Isone
  '6814': 8000,  // Lamone
  '6815': 8200,  // Melide
  '6816': 8000,  // Bissone
  '6817': 8200,  // Maroggia
  '6818': 8000,  // Melano
  '6821': 8200,  // Rovio
  '6822': 8000,  // Arogno
  '6823': 8200,  // Carona
  '6825': 8000,  // Capolago
  '6826': 8200,  // Riva San Vitale
  '6827': 8000,  // Brusino Arsizio
  '6828': 8200,  // Balerna
  '6830': 8000,  // Chiasso
  '6832': 8200,  // Pedrinate
  '6833': 8000,  // Vacallo
  '6834': 8200,  // Morbio Inferiore
  '6835': 8000,  // Morbio Superiore
  '6836': 8200,  // Serfontana
  '6837': 8000,  // Caneggio
  '6838': 8200,  // Muggio
  '6839': 8000,  // Sagno
  '6850': 8200,  // Mendrisio
  '6852': 8000,  // Genestrerio
  '6853': 8200,  // Ligornetto
  '6854': 8000,  // San Pietro
  '6855': 8200,  // Stabio
  '6856': 8000,  // Besazio
  '6862': 8200,  // Rancate
  '6863': 8000,  // Besazio
  '6864': 8200,  // Arzo
  '6865': 8000,  // Tremona
  '6866': 8200,  // Meride
  '6867': 8000,  // Brusino Arsizio
  '6872': 8200,  // Salorino
  '6873': 8000,  // Corteglia
  '6874': 8200,  // Castel San Pietro
  '6875': 8000,  // Casima
  '6876': 8200,  // Castel San Pietro
  '6877': 8000,  // Coldrerio
  '6883': 8200,  // Novazzano
  '6900': 9500,  // Lugano
  '6901': 9500, '6902': 9200, '6903': 9500,
  '6904': 9200, '6905': 9500, '6906': 9200,
  '6907': 9500, '6908': 9200, '6912': 9500,
  '6913': 9200, '6914': 9500, '6915': 9200,
  '6916': 9500, '6917': 9200, '6918': 9500,
  '6919': 9200, '6921': 9500, '6922': 9200,
  '6924': 9500, '6925': 9200, '6926': 9500,
  '6927': 9200, '6928': 9500, '6929': 9200,
  '6930': 9500, '6932': 9200, '6933': 9500,
  '6934': 9200, '6935': 9500, '6936': 9200,
  '6937': 9500, '6938': 9200, '6939': 9500,
  '6942': 9200, '6943': 9500, '6944': 9200,
  '6945': 9500, '6946': 9200, '6947': 9500,
  '6948': 9200, '6949': 9500,

  // ═══ KANTON SCHAFFHAUSEN ═══
  '8200': 7800,  // Schaffhausen
  '8201': 7800, '8202': 7800, '8203': 7800,
  '8204': 7500,  // Schaffhausen Randengebiet
  '8205': 7800,  // Schaffhausen Breite
  '8207': 7500,  // Schaffhausen Buchthalen
  '8208': 7800,  // Schaffhausen Herblingen
  '8212': 7500,  // Neuhausen am Rheinfall
  '8213': 7200,  // Neunkirch
  '8214': 7500,  // Gächlingen
  '8215': 7200,  // Hallau
  '8216': 7500,  // Oberhallau
  '8217': 7200,  // Trasadingen
  '8218': 7500,  // Osterfingen
  '8219': 7200,  // Trasadingen
  '8222': 7500,  // Beringen
  '8223': 7200,  // Guntmadingen
  '8224': 7500,  // Löhningen
  '8225': 7200,  // Siblingen
  '8226': 7500,  // Schleitheim
  '8227': 7200,  // Schleitheim
  '8228': 7500,  // Beggingen
  '8231': 7200,  // Herblingen
  '8232': 7500,  // Merishausen
  '8233': 7200,  // Bargen SH
  '8234': 7500,  // Stühlingen
  '8235': 7200,  // Lohn SH
  '8236': 7500,  // Opfertshofen
  '8239': 7200,  // Dörflingen
  '8240': 7500,  // Thayngen
  '8241': 7200,  // Büttenhardt
  '8242': 7500,  // Bibern SH
  '8243': 7200,  // Altdorf SH
  '8245': 7500,  // Feuerthalen
  '8246': 7200,  // Altdorf
  '8247': 7500,  // Flurlingen
  '8248': 7200,  // Uhwiesen
  '8249': 7500,  // Laufen-Uhwiesen
  '8252': 7200,  // Schlatt TG
  '8253': 7500,  // Diessenhofen
  '8254': 7200,  // Basadingen-Schlattingen
  '8255': 7500,  // Schlatt TG
  '8256': 7200,  // Schlatt TG
  '8257': 7500,  // Ramersberg
  '8258': 7200,  // Ramsen

  // ═══ KANTON THURGAU ═══
  '8500': 7500,  // Frauenfeld
  '8501': 7500, '8502': 7200, '8503': 7200,
  '8505': 7000,  // Landschlacht
  '8506': 7200,  // Lanzenneunforn
  '8507': 7000,  // Hörhausen
  '8508': 7200,  // Homburg
  '8510': 7000,  // Frauenfeld
  '8512': 7200,  // Thundorf
  '8514': 7000,  // Amlikon-Bissegg
  '8515': 7200,  // Hüttwilen
  '8516': 7000,  // Hüttwilen
  '8518': 7200,  // Bussnang
  '8524': 7000,  // Uesslingen-Buch
  '8525': 7200,  // Wilen b. Neunforn
  '8526': 7000,  // Hüttlingen
  '8532': 7200,  // Warth-Weiningen
  '8535': 7000,  // Herdern
  '8536': 7200,  // Hüttwilen
  '8537': 7000,  // Uesslingen-Buch
  '8538': 7200,  // Herdern
  '8542': 7000,  // Wuppenau
  '8543': 7200,  // Guntalingen
  '8544': 7000,  // Attikon
  '8545': 7200,  // Rickenbach TG
  '8546': 7000,  // Islikon
  '8547': 7200,  // Gachnang
  '8548': 7000,  // Ellikon a.d.Thur
  '8552': 7200,  // Felben-Wellhausen
  '8553': 7000,  // Matzingen
  '8554': 7200,  // Bonau
  '8555': 7000,  // Müllheim
  '8556': 7200,  // Wigoltingen
  '8558': 7000,  // Lipperswil
  '8560': 7500,  // Märstetten
  '8561': 7200,  // Ottoberg
  '8564': 7000,  // Hefenhausen
  '8565': 7200,  // Hugelshofen
  '8566': 7000,  // Dotnacht
  '8570': 7500,  // Weinfelden
  '8572': 7200,  // Berg TG
  '8573': 7000,  // Siegershausen
  '8574': 7200,  // Lengwil
  '8575': 7000,  // Bürglen TG
  '8576': 7200,  // Mauren TG
  '8577': 7000,  // Tobel-Tägerschen
  '8580': 7500,  // Amriswil
  '8581': 7200,  // Schocherswil
  '8582': 7000,  // Dozwil
  '8583': 7200,  // Sulgen
  '8584': 7000,  // Leimbach TG
  '8585': 7200,  // Happerswil-Bodman
  '8586': 7000,  // Erlen
  '8587': 7200,  // Oberaach
  '8588': 7000,  // Zihlschlacht-Sitterdorf
  '8589': 7200,  // Sitterdorf
  '8590': 7800,  // Romanshorn (Bodensee)
  '8592': 7500,  // Uttwil (Bodensee)
  '8593': 7200,  // Kesswil
  '8594': 7500,  // Güttingen
  '8595': 7200,  // Altnau
  '8596': 7500,  // Münsterlingen
  '8597': 7200,  // Landschlacht
  '8598': 7500,  // Bottighofen
  '8599': 7200,  // Konstanzerstrasse
  '8600': 10200, // Dübendorf
  '8607': 7800,  // Aadorf
  '8608': 7500,  // Bubikon
  '8610': 8800,  // Uster
  '8613': 8200,  // Uster
  '8614': 8000,  // Bertschikon
  '8615': 7800,  // Freudwil
  '8616': 7500,  // Riedikon
  '8617': 7800,  // Mönchaltorf
  '8618': 8000,  // Oetwil am See

  // ═══ KANTON FREIBURG ═══
  '1700': 8000,  // Freiburg/Fribourg
  '1701': 8000, '1702': 7800, '1703': 7500,
  '1704': 7800,  // Freiburg
  '1705': 7500,  // Freiburg (Pérolles)
  '1706': 7800,  // Freiburg
  '1707': 7500,  // Freiburg
  '1708': 7800,  // Freiburg
  '1709': 7500,  // Freiburg
  '1712': 7800,  // Tafers
  '1713': 7500,  // St. Antoni
  '1714': 7800,  // Heitenried
  '1715': 7500,  // Alterswil
  '1716': 7800,  // Plaffeien
  '1717': 7500,  // St. Ursen
  '1718': 7800,  // Rechthalten
  '1719': 7500,  // Zollhaus
  '1720': 7800,  // Corminboeuf
  '1721': 7500,  // Misery-Courtion
  '1722': 7800,  // Pierrafortscha
  '1723': 7500,  // Marly
  '1724': 7800,  // Senèdes
  '1725': 7500,  // Posieux
  '1726': 7800,  // Farvagny
  '1727': 7500,  // Corpataux-Magnedens
  '1728': 7800,  // Rossens FR
  '1730': 7500,  // Ecuvillens
  '1731': 7800,  // Ependes FR
  '1732': 7500,  // Arconciel
  '1733': 7800,  // Treyvaux
  '1734': 7500,  // Tentlingen
  '1735': 7800,  // Giffers
  '1736': 7500,  // St. Silvester
  '1737': 7800,  // Plasselb
  '1738': 7500,  // Sangernboden

  // Murten / Morat Region
  '3280': 7800,  // Murten (Lac de Morat)
  '3282': 7500,  // Barberêche
  '3283': 7800,  // Clavaleyres
  '3284': 7500,  // Avenches
  '3285': 7800,  // Galmiz
  '3286': 7500,  // Münchenwiler

  // ═══ KANTON SOLOTHURN ═══
  '4500': 7500,  // Solothurn
  '4501': 7500, '4502': 7200, '4503': 7000,
  '4512': 7200,  // Bellach
  '4513': 7000,  // Langendorf
  '4514': 7200,  // Lommiswil
  '4515': 7000,  // Oberdorf SO
  '4516': 7200,  // Oberdorf
  '4517': 7000,  // Starrkirch-Wil
  '4518': 7200,  // Boningen
  '4522': 7000,  // Rüttenen
  '4523': 7200,  // Niederwil SO
  '4524': 7000,  // Günsberg
  '4525': 7200,  // Balsthal
  '4528': 7000,  // Zuchwil
  '4532': 7200,  // Feldbrunnen-St. Niklaus
  '4533': 7000,  // Subingen
  '4534': 7200,  // Hessigkofen
  '4535': 7000,  // Kammersrohr
  '4536': 7200,  // Attiswil
  '4537': 7000,  // Wiedlisbach
  '4538': 7200,  // Oberbipp
  '4539': 7000,  // Farnern

};

// Kanton-Durchschnitte als letzter Fallback (ETW CHF/m²)
const KANTON_DURCHSCHNITT = {
  'ZH': 11800,
  'BE': 7800,
  'LU': 8500,
  'UR': 6500,
  'SZ': 10500,
  'OW': 7200,
  'NW': 8500,
  'GL': 5800,
  'ZG': 14500,
  'FR': 7500,
  'SO': 7200,
  'BS': 9200,
  'BL': 8000,
  'SH': 7500,
  'AR': 7000,
  'AI': 6500,
  'SG': 8000,
  'GR': 9500,
  'AG': 7800,
  'TG': 7200,
  'TI': 8000,
  'VD': 9800,
  'VS': 9500,
  'NE': 6200,
  'GE': 14000,
  'JU': 5000,
};

// PLZ → Kanton
function getKanton(plz) {
  const p = parseInt(plz);
  if (p >= 8000 && p <= 8999) return 'ZH';
  if (p >= 3000 && p <= 3999) return 'BE';
  if (p >= 6000 && p <= 6199) return 'LU';
  if (p >= 6440 && p <= 6499) return 'UR';
  if (p >= 6400 && p <= 6439) return 'SZ';
  if (p >= 6060 && p <= 6099) return 'OW';
  if (p >= 6370 && p <= 6399) return 'NW';
  if (p >= 8750 && p <= 8769) return 'GL';
  if (p >= 6300 && p <= 6345) return 'ZG';
  if (p >= 1700 && p <= 1799) return 'FR';
  if (p >= 4500 && p <= 4599) return 'SO';
  if (p >= 4000 && p <= 4059) return 'BS';
  if (p >= 4100 && p <= 4450) return 'BL';
  if (p >= 8200 && p <= 8290) return 'SH';
  if (p >= 9050 && p <= 9109) return 'AR';
  if (p >= 9050 && p <= 9050) return 'AI';
  if (p >= 9000 && p <= 9499) return 'SG';
  if (p >= 7000 && p <= 7599) return 'GR';
  if (p >= 4600 && p <= 5999) return 'AG';
  if (p >= 8500 && p <= 8599) return 'TG';
  if (p >= 6500 && p <= 6999) return 'TI';
  if (p >= 1000 && p <= 1499) return 'VD';
  if (p >= 1800 && p <= 1999) return 'VS';
  if (p >= 3900 && p <= 3999) return 'VS';
  if (p >= 2000 && p <= 2399) return 'NE';
  if (p >= 1200 && p <= 1299) return 'GE';
  if (p >= 2800 && p <= 2999) return 'JU';
  return 'ZH'; // Fallback
}

// ─── Hauptfunktion: Preis für eine PLZ ermitteln ──────────────────────────────
function getBasePreis(plz, typ) {
  const plzStr = String(plz).substring(0, 4);

  // 1. Direkter PLZ-Treffer
  let etwPreis = PREISE_ETW[plzStr];

  // 2. Nahegelegene PLZ suchen (±1 bis ±5)
  if (!etwPreis) {
    const plzNum = parseInt(plzStr);
    for (let delta = 1; delta <= 5; delta++) {
      etwPreis = PREISE_ETW[String(plzNum + delta)] || PREISE_ETW[String(plzNum - delta)];
      if (etwPreis) { console.log(`PLZ ${plzStr}: Näherung ±${delta} → ${etwPreis}`); break; }
    }
  }

  // 3. PLZ-Prefix (erste 3 Stellen)
  if (!etwPreis) {
    const prefix3 = plzStr.substring(0, 3);
    const matches = Object.entries(PREISE_ETW)
      .filter(([k]) => k.startsWith(prefix3))
      .map(([, v]) => v);
    if (matches.length > 0) {
      etwPreis = Math.round(matches.reduce((a, b) => a + b, 0) / matches.length);
      console.log(`PLZ ${plzStr}: Prefix-Durchschnitt → ${etwPreis}`);
    }
  }

  // 4. Kanton-Durchschnitt
  if (!etwPreis) {
    const kanton = getKanton(plzStr);
    etwPreis = KANTON_DURCHSCHNITT[kanton] || 8000;
    console.log(`PLZ ${plzStr}: Kanton ${kanton} Durchschnitt → ${etwPreis}`);
  }

  // EFH-Aufschlag
  const efhFaktor = {
    efh:   1.18,
    villa: 1.55,
    rh:    0.95,
    mfh:   1.08,
    gew:   0.75,
    etw:   1.00,
  }[typ] || 1.0;

  const finalPreis = Math.round(etwPreis * efhFaktor);

  return {
    base:   finalPreis,
    etwM2:  etwPreis,
    kanton: getKanton(plzStr),
  };
}

function getSteuerfuss(plz) {
  const plzStr = String(plz).substring(0, 4);
  if (STEUERFUSS[plzStr]) return STEUERFUSS[plzStr];

  // Nahegelegene PLZ
  const plzNum = parseInt(plzStr);
  for (let d = 1; d <= 5; d++) {
    const found = STEUERFUSS[String(plzNum + d)] || STEUERFUSS[String(plzNum - d)];
    if (found) return found;
  }

  // Kanton-Durchschnitt
  const kantonsSchnitt = {
    'ZH': 115, 'BE': 155, 'LU': 107, 'UR': 95, 'SZ': 72,
    'OW': 90, 'NW': 88, 'GL': 95, 'ZG': 72, 'FR': 75,
    'SO': 107, 'BS': 100, 'BL': 108, 'SH': 108, 'AR': 90,
    'AI': 80, 'SG': 115, 'GR': 100, 'AG': 108, 'TG': 110,
    'TI': 88, 'VD': 80, 'VS': 75, 'NE': 100, 'GE': 45, 'JU': 115,
  };
  return kantonsSchnitt[getKanton(plzStr)] || 110;
}

module.exports = { getBasePreis, getSteuerfuss, getKanton, PREISE_ETW, STEUERFUSS };
