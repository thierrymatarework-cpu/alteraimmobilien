# Altera Immobilien — Setup & Deployment Guide

## Übersicht

```
altera-project/
├── public/
│   └── index.html          ← Die Website (fertig)
├── api/
│   ├── submit.js           ← Bewertungsformular API (PDF + E-Mail + Airtable)
│   └── contact.js          ← Kontaktformular API
├── lib/
│   └── generatePDF.js      ← PDF-Template & Generator
├── package.json
├── vercel.json
└── SETUP.md (diese Datei)
```

---

## Schritt 1 — GitHub Repository erstellen

1. Gehe zu [github.com](https://github.com) → **New repository**
2. Name: `altera-immobilien`
3. Sichtbarkeit: **Private**
4. Klicke **Create repository**

Dann im Terminal (einmalig installieren: [git-scm.com](https://git-scm.com)):

```bash
cd altera-project
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/DEIN-USERNAME/altera-immobilien.git
git push -u origin main
```

---

## Schritt 2 — Vercel einrichten (kostenlos)

1. Gehe zu [vercel.com](https://vercel.com) → **Sign up with GitHub**
2. **Add New Project** → Wähle `altera-immobilien`
3. Framework Preset: **Other**
4. Klicke **Deploy** → Die Website ist live! 🎉

**Deine URL:** `altera-immobilien.vercel.app`  
**Eigene Domain:** In Vercel unter Settings → Domains → `altera-immobilien.ch` eintragen

---

## Schritt 3 — E-Mail (Resend) einrichten

1. Gehe zu [resend.com](https://resend.com) → Kostenlos registrieren
2. **Add Domain** → `altera-immobilien.ch` eintragen
3. DNS-Einträge beim Domain-Anbieter (Infomaniak etc.) setzen — Resend zeigt dir genau welche
4. **API Keys** → Neuen Key erstellen → kopieren

**Kosten:** Kostenlos bis 3'000 E-Mails/Monat (reicht für den Start)

---

## Schritt 4 — Airtable (Lead-CRM) einrichten

1. Gehe zu [airtable.com](https://airtable.com) → Kostenlos registrieren
2. **Add a base** → "Altera CRM" benennen
3. Zwei Tabellen erstellen:

### Tabelle 1: "Leads" (Bewertungsanfragen)
Felder:
- Vorname (Text)
- Nachname (Text)
- E-Mail (E-Mail)
- Telefon (Text)
- PLZ (Text)
- Ort (Text)
- Objekttyp (Text)
- Fläche (m²) (Zahl)
- Geschätzter Wert (CHF) (Zahl)
- Preis/m² (CHF) (Zahl)
- Score (Zahl)
- Bewertungsgrund (Text)
- Status (Single Select: Neu / Kontaktiert / In Bearbeitung / Abgeschlossen)
- Erstellt am (Datum/Zeit)
- Notizen (Long Text)

### Tabelle 2: "Kontaktanfragen"
Felder:
- Name (Text)
- E-Mail (E-Mail)
- Telefon (Text)
- Anliegen (Text)
- Adresse Liegenschaft (Text)
- Wunschtermin (Text)
- Nachricht (Long Text)
- Status (Single Select: Neu / Beantwortet)
- Erstellt am (Datum/Zeit)

4. **API-Key holen:**
   - Gehe zu [airtable.com/account](https://airtable.com/account) → **Create API Key**
   - Base-ID: In der Browser-URL, beginnt mit `app...`

---

## Schritt 5 — Environment Variables in Vercel setzen

In Vercel → dein Projekt → **Settings** → **Environment Variables**:

| Variable | Wert | Woher |
|---|---|---|
| `RESEND_API_KEY` | `re_xxxxx...` | Resend Dashboard |
| `AIRTABLE_API_KEY` | `patxxxxx...` | Airtable Account |
| `AIRTABLE_BASE_ID` | `appxxxxx...` | URL der Base |
| `NOTIFY_EMAIL` | `hallo@altera-immobilien.ch` | Eure E-Mail |

Nach dem Setzen: **Redeploy** klicken.

---

## Schritt 6 — Website mit API verbinden

Im `public/index.html` die `submit()` und `submitContact()` Funktionen anpassen:

```javascript
// In der submit() Funktion, nach calc():
async function submitToAPI(formData, calcResult) {
  try {
    const response = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Formular-Daten
        vorname: document.getElementById('vorname').value,
        nachname: document.getElementById('nachname').value,
        email: document.getElementById('email').value,
        tel: document.getElementById('tel').value,
        plz: document.getElementById('plz').value,
        ort: document.getElementById('ort').value,
        // Berechnungsparameter
        flaeche: parseInt(document.getElementById('flaeche').value) || 120,
        baujahr: parseInt(document.getElementById('baujahr').value) || 2000,
        renov: parseInt(document.getElementById('renov').value) || null,
        typ: document.querySelector('#tt .sel')?.dataset.v || 'etw',
        subtyp: document.querySelector('#sub-tt .sel')?.dataset.v || 'std',
        lage: document.querySelector('#tl .sel')?.dataset.v || 'gut',
        zustand: document.querySelector('#tz .sel')?.dataset.v || 'gut',
        laerm: document.querySelector('#tlm .sel')?.dataset.v || 'kein',
        grund: document.querySelector('#tg .sel')?.dataset.v || 'ori',
        feats: document.querySelectorAll('#step2 .chk.on').length + document.querySelectorAll('#step3 .chk.on').length,
        steuer: parseInt(document.getElementById('steuer').value) || 100,
        miete: document.getElementById('miete')?.value || '',
        kaufpreis: document.getElementById('kaufpreis')?.value || '',
      })
    });
    const data = await response.json();
    console.log('API Response:', data);
  } catch (err) {
    console.error('API Error:', err);
    // Stille Fehler — Bewertung läuft trotzdem lokal weiter
  }
}
```

---

## Schritt 7 — Domain (optional aber empfohlen)

**Domain kaufen** (z.B. bei Infomaniak.com):
- `altera-immobilien.ch` oder `altera.ch`

**DNS-Einstellungen:**
1. In Infomaniak: DNS-Einträge → CNAME: `www` → `cname.vercel-dns.com`
2. In Vercel: Settings → Domains → Domain eintragen → DNS-Einträge folgen

---

## Kosten-Übersicht

| Dienst | Kostenlos | Bezahlt |
|---|---|---|
| Vercel (Hosting) | ✅ Kostenlos (bis 100GB) | — |
| Resend (E-Mail) | ✅ 3'000/Monat | CHF 20/Monat für mehr |
| Airtable (CRM) | ✅ Kostenlos (bis 1'000 Einträge) | CHF 20/Monat |
| Domain (.ch) | — | CHF 12/Jahr |
| **Total** | **CHF 0/Monat** zum Start | — |

---

## Updates deployen

Nach jeder Änderung an der Website:

```bash
git add .
git commit -m "Update: Beschreibung der Änderung"
git push
```

Vercel deployt automatisch innerhalb von ~30 Sekunden.

---

## Wichtige URLs nach Go-Live

- Website: `https://altera-immobilien.ch`
- Vercel Dashboard: `https://vercel.com/dashboard`
- Airtable CRM: `https://airtable.com`
- Resend E-Mail: `https://resend.com/emails`

---

## Support

Bei Fragen zum Setup: [vercel.com/docs](https://vercel.com/docs) | [resend.com/docs](https://resend.com/docs) | [airtable.com/guides](https://airtable.com/guides)
