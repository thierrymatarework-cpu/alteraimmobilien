# API Keys hinterlegen — Schritt für Schritt

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCHRITT 1 — RESEND API KEY HOLEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Gehe zu: https://resend.com
2. Konto erstellen (kostenlos)
3. Links im Menu: "API Keys" klicken
4. "Create API Key" klicken
5. Name: "Altera Immobilien"
6. Permission: "Full Access"
7. "Add" klicken
8. KEY KOPIEREN — sieht so aus:
   re_AbCdEfGhIjKlMnOpQrStUvWxYz_123456

⚠️  WICHTIG: Wird nur einmal angezeigt!
    Sofort in Notizblock speichern.

HINWEIS zur Absenderadresse:
Vorerst sendet Resend von "onboarding@resend.dev"
Das funktioniert für Tests. Für echte E-Mails von
"hallo@altera-immobilien.ch" muss die Domain in
Resend verifiziert werden (nach Kauf der Domain).


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCHRITT 2 — AIRTABLE API KEY & BASE ID
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TOKEN ERSTELLEN:
1. Gehe zu: https://airtable.com/create/tokens
2. "Create new token" klicken
3. Name: "Altera API"
4. Unter "Scopes" diese anklicken:
   ✓ data.records:read
   ✓ data.records:write
   ✓ schema.bases:read
5. Unter "Access": "All current and future bases"
6. "Create token" klicken
7. TOKEN KOPIEREN — sieht so aus:
   patXXXXXXXXXXXXXX.xxxxxxxxxxxxxxxxxxxxxxxx

BASE ID FINDEN:
1. Gehe zu: https://airtable.com
2. Öffne deine Base "Altera CRM"
3. Schau in die Browser-URL:
   https://airtable.com/appXXXXXXXXXXXXXX/tbl...
                         ^^^^^^^^^^^^^^^^
4. Den Teil nach "/app" bis zum "/" kopieren
   Sieht so aus: appXXXXXXXXXXXXXX

TABELLEN IN AIRTABLE ERSTELLEN:
Tabelle 1 heisst: "Leads"
  Felder:
  - Vorname (Single line text)
  - Nachname (Single line text)
  - E-Mail (Email)
  - Telefon (Phone number)
  - PLZ (Single line text)
  - Ort (Single line text)
  - Objekttyp (Single line text)
  - Flaeche m2 (Number)
  - Geschaetzter Wert CHF (Number)
  - Score (Number)
  - Bewertungsgrund (Single line text)
  - Status (Single select: Neu / Kontaktiert / Abgeschlossen)
  - Erstellt am (Date)

Tabelle 2 heisst: "Kontaktanfragen"
  Felder:
  - Name (Single line text)
  - E-Mail (Email)
  - Telefon (Phone number)
  - Anliegen (Single line text)
  - Adresse (Single line text)
  - Termin (Single line text)
  - Nachricht (Long text)
  - Status (Single select: Neu / Beantwortet)
  - Erstellt (Date)


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCHRITT 3 — KEYS IN VERCEL EINTRAGEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Gehe zu: https://vercel.com
2. Dein Projekt anklicken
3. Oben: "Settings" klicken
4. Links: "Environment Variables" klicken
5. Diese 4 Variables eintragen:

┌─────────────────────┬─────────────────────────────────────┐
│ NAME                │ VALUE                               │
├─────────────────────┼─────────────────────────────────────┤
│ RESEND_API_KEY      │ re_xxxx... (dein Resend Key)        │
│ AIRTABLE_API_KEY    │ patxxxx... (dein Airtable Token)    │
│ AIRTABLE_BASE_ID    │ appxxxx... (deine Base ID)          │
│ NOTIFY_EMAIL        │ deine@email.ch (wo Leads ankommen)  │
└─────────────────────┴─────────────────────────────────────┘

Für jede Variable:
  a) Name eingeben
  b) Value eingeben
  c) "Save" klicken

6. Nach allen 4: Oben "Deployments" → neuestes → "..." → "Redeploy"


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TESTEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Website öffnen
2. Formular komplett ausfüllen (echte E-Mail verwenden!)
3. "Wertschätzung erhalten" klicken
4. Ergebnis erscheint → "Report senden" klicken

Erwartetes Ergebnis:
  ✓ E-Mail an dich (Kunde) von "onboarding@resend.dev"
  ✓ Team-Benachrichtigung an NOTIFY_EMAIL
  ✓ Neuer Eintrag in Airtable Tabelle "Leads"

Falls nichts kommt:
  → Vercel → dein Projekt → "Deployments" → neuestes → "Functions"
  → Dort siehst du die Logs der API und eventuelle Fehler


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HÄUFIGE FEHLER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"Airtable 404" → Base ID falsch (mit app... beginnen)
"Airtable 422" → Feldname stimmt nicht überein
                 → Feldnamen exakt wie oben eingeben!
"Resend 403"   → API Key falsch oder abgelaufen
"E-Mail kommt nicht" → Spam-Ordner prüfen!

