# Altera Immobilien — Komplette Anleitung von A bis Z
# Kein Vorwissen nötig. Jeden Schritt genau so ausführen.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCHRITT 1 — GITHUB KONTO (einmalig, 5 Min.)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Gehe zu: https://github.com
2. Klicke "Sign up"
3. E-Mail eingeben, Passwort wählen, Username wählen
4. Konto bestätigen (E-Mail)
5. Fertig ✓


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCHRITT 2 — REPOSITORY ERSTELLEN (5 Min.)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Eingeloggt auf github.com
2. Oben rechts "+" → "New repository"
3. Repository name: altera-immobilien
4. Visibility: Private
5. Klicke "Create repository"
6. Fertig ✓


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCHRITT 3 — DATEIEN HOCHLADEN (5 Min.)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WICHTIG: Zuerst das ZIP entpacken auf deinem Computer.
Du solltest dann diesen Ordner haben:
  altera-project/
    ├── public/
    │   └── index.html
    ├── api/
    │   ├── submit.js
    │   └── contact.js
    ├── lib/
    │   └── generatePDF.js
    ├── package.json
    └── vercel.json

Dateien auf GitHub hochladen:
1. Gehe zu deinem Repository auf github.com
2. Klicke "uploading an existing file"
3. Ziehe den ganzen Ordner "altera-project" rein
   ODER klicke "choose your files" und wähle alle Dateien
4. Unten: "Commit changes" klicken
5. Fertig ✓

WICHTIG — vercel.json anpassen:
Öffne die Datei vercel.json auf GitHub (draufklicken)
Klicke das Stift-Symbol (Edit)
Ersetze den ganzen Inhalt mit diesem hier:

{
  "version": 2,
  "routes": [
    { "src": "/api/(.*)", "dest": "/api/$1" },
    { "src": "/(.*)", "dest": "/public/$1" }
  ]
}

Klicke "Commit changes" → Bestätigen


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCHRITT 4 — VERCEL (Website live schalten, 5 Min.)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Gehe zu: https://vercel.com
2. Klicke "Sign Up"
3. Wähle "Continue with GitHub" → mit GitHub-Konto einloggen
4. Klicke "Add New Project"
5. Du siehst dein Repository "altera-immobilien" → klicke "Import"
6. Alles so lassen wie es ist → klicke "Deploy"
7. Warten (~1 Minute)
8. Fertig! ✓

Deine Website ist jetzt live unter:
→ https://altera-immobilien.vercel.app

Du kannst sie im Browser öffnen und testen.
Das Formular funktioniert bereits — E-Mails noch nicht (kommt in Schritt 6)


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCHRITT 5 — RESEND (E-Mails versenden, 10 Min.)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Resend ist der Dienst der automatisch E-Mails versendet.
Kostenlos bis 3000 E-Mails pro Monat.

KONTO ERSTELLEN:
1. Gehe zu: https://resend.com
2. Klicke "Sign Up"
3. Mit E-Mail registrieren
4. E-Mail bestätigen

API KEY HOLEN:
1. Eingeloggt auf resend.com
2. Linkes Menu: "API Keys"
3. Klicke "Create API Key"
4. Name: "Altera Immobilien"
5. Permission: "Full Access"
6. Klicke "Add"
7. Ein langer Code erscheint — sieht so aus:
   re_123AbCdEfGhIjKlMnOpQrStUvWxYz
8. WICHTIG: Diesen Code sofort kopieren und irgendwo speichern
   (wird nur einmal angezeigt!)
9. Fertig ✓

DOMAIN EINRICHTEN (damit E-Mails von eurer Adresse kommen):
→ Das können wir später machen wenn die Domain gekauft ist
→ Vorerst funktioniert es auch mit der Test-Adresse von Resend


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCHRITT 6 — AIRTABLE (Lead-Verwaltung, 10 Min.)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Airtable ist wie Excel in der Cloud — dort landen alle Anfragen.
Kostenlos bis 1000 Einträge (reicht für den Start locker).

KONTO ERSTELLEN:
1. Gehe zu: https://airtable.com
2. Klicke "Sign up for free"
3. Mit E-Mail registrieren

BASE ERSTELLEN:
1. Klicke "Add a base"
2. "Start from scratch"
3. Name eingeben: Altera CRM
4. Klicke "Create base"

TABELLE "Leads" einrichten:
Die erste Tabelle heisst automatisch "Table 1"
1. Rechtsklick auf "Table 1" → Rename → "Leads" eingeben
2. Die Spalten so anpassen (+ Symbol für neue Spalte):
   - Name (Text) ← bereits vorhanden, umbenennen
   - Vorname (Text)
   - Nachname (Text)
   - E-Mail (Email)
   - Telefon (Phone)
   - PLZ (Text)
   - Ort (Text)
   - Objekttyp (Text)
   - Geschätzter Wert CHF (Number)
   - Score (Number)
   - Bewertungsgrund (Text)
   - Status (Single select: Neu / Kontaktiert / Abgeschlossen)
   - Erstellt am (Date)
   - Notizen (Long text)

ZWEITE TABELLE "Kontaktanfragen":
1. Unten links "+" für neue Tabelle
2. Name: Kontaktanfragen
3. Spalten: Name, E-Mail, Telefon, Anliegen, Nachricht, Status, Erstellt am

API KEY HOLEN:
1. Gehe zu: https://airtable.com/create/tokens
2. Klicke "Create new token"
3. Name: "Altera API"
4. Scopes: data.records:read und data.records:write anklicken
5. Access: "All current and future bases" wählen
6. Klicke "Create token"
7. Den langen Code kopieren und speichern:
   patXXXXXXXXXXXXXX.XXXXXXX...

BASE ID HOLEN:
1. Öffne deine Base "Altera CRM" in Airtable
2. Schau in die Browser-URL oben
3. Die URL sieht so aus:
   https://airtable.com/appXXXXXXXXXXXXXX/...
4. Der Teil "appXXXXXXXXXXXXXX" ist deine Base ID
5. Kopieren und speichern


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCHRITT 7 — KEYS IN VERCEL EINGEBEN (5 Min.)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Jetzt verbinden wir alles.

1. Gehe zu: https://vercel.com
2. Klicke auf dein Projekt "altera-immobilien"
3. Oben: "Settings" klicken
4. Links: "Environment Variables" klicken
5. Diese 4 Variables einzeln eingeben:

   ┌─────────────────────┬──────────────────────────────────┐
   │ Name                │ Value                            │
   ├─────────────────────┼──────────────────────────────────┤
   │ RESEND_API_KEY      │ re_xxxx... (dein Resend Key)     │
   │ AIRTABLE_API_KEY    │ patxxxx... (dein Airtable Key)   │
   │ AIRTABLE_BASE_ID    │ appxxxx... (deine Base ID)       │
   │ NOTIFY_EMAIL        │ deine@email.ch                   │
   └─────────────────────┴──────────────────────────────────┘

   Für jede Variable:
   - Name eingeben
   - Value eingeben
   - "Save" klicken

6. Nachdem alle 4 gespeichert sind:
   Oben auf "Deployments" klicken
   Beim neusten Deployment: "..." → "Redeploy"
   Bestätigen → Warten (~1 Min.)

7. Fertig! ✓


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCHRITT 8 — TESTEN (5 Min.)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Öffne deine Website: https://altera-immobilien.vercel.app
2. Fülle das Bewertungsformular komplett aus
3. Verwende eine echte E-Mail-Adresse von dir
4. Klicke "Wertschätzung erhalten"
5. Prüfen:
   ✓ Ergebnisseite erscheint
   ✓ E-Mail kommt an (auch Spam prüfen!)
   ✓ In Airtable erscheint ein neuer Eintrag
   ✓ Ihr erhaltet die Team-Benachrichtigung


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCHRITT 9 — EIGENE DOMAIN (optional, 15 Min.)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Domain kaufen (z.B. amara-immobilien.ch):
1. Gehe zu: https://www.infomaniak.com/de/domains
2. Domain eingeben und prüfen ob verfügbar
3. Kaufen (~12 CHF/Jahr für .ch)

Domain mit Vercel verbinden:
1. Vercel → dein Projekt → Settings → Domains
2. Domain eingeben: amara-immobilien.ch → Add
3. Vercel zeigt dir DNS-Einträge die du setzen musst
4. Bei Infomaniak: Domain → DNS-Einträge → die Werte von Vercel eintragen
5. Nach 5-30 Min. ist die Domain aktiv


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ZUSAMMENFASSUNG — WAS IHR BRAUCHT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Konten die ihr erstellt:
  ✓ GitHub (github.com) — kostenlos
  ✓ Vercel (vercel.com) — kostenlos
  ✓ Resend (resend.com) — kostenlos
  ✓ Airtable (airtable.com) — kostenlos
  ○ Infomaniak (infomaniak.com) — 12 CHF/Jahr für Domain

Keys die ihr sammelt:
  ✓ Resend API Key:    re_xxxxx...
  ✓ Airtable API Key:  patxxxxx...
  ✓ Airtable Base ID:  appxxxxx...
  ✓ Notify Email:      eure E-Mail-Adresse

Gesamtkosten:
  Monatlich: CHF 0
  Domain:    CHF 12/Jahr


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROBLEME? HÄUFIGE FEHLER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Problem: "Environment Variable references Secret which does not exist"
Lösung:  vercel.json wie in Schritt 3 beschrieben anpassen

Problem: E-Mail kommt nicht an
Lösung:  Spam-Ordner prüfen. Resend Dashboard → Logs prüfen

Problem: Airtable bekommt keine Einträge
Lösung:  Base ID nochmals prüfen (beginnt mit "app")
         API Key Permissions prüfen (braucht write-Zugriff)

Problem: Website zeigt 404
Lösung:  vercel.json prüfen ob die Routes korrekt sind

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
