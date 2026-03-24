# Altera Immobilien — Komplette Deployment-Anleitung
# Von Null bis Live — Schritt für Schritt

---

## PHASE 1 — Website auf Vercel deployen (10 Min)

### 1.1 GitHub Account erstellen
1. Gehe zu **github.com**
2. Klicke **Sign up**
3. E-Mail, Passwort, Username eingeben
4. E-Mail bestätigen — fertig

### 1.2 Repository erstellen
1. Einloggen auf github.com
2. Oben rechts **+** → **New repository**
3. Repository name: `altera-immobilien`
4. Sichtbarkeit: **Private**
5. Klicke **Create repository**

### 1.3 Dateien hochladen
1. Im neuen Repository klicke **uploading an existing file**
2. Ziehe den entpackten Projektordner rein (alle Dateien)
3. Unten: **Commit changes** klicken
4. ✅ Alle Dateien sind jetzt auf GitHub

### 1.4 Vercel Account erstellen
1. Gehe zu **vercel.com**
2. Klicke **Sign Up**
3. Wähle **Continue with GitHub**
4. GitHub-Account verbinden — erlauben

### 1.5 Projekt deployen
1. Im Vercel Dashboard: **Add New Project**
2. Wähle `altera-immobilien` aus der Liste
3. Alles so lassen wie es ist
4. Klicke **Deploy**
5. Warten (~1 Minute)
6. ✅ Website ist live unter z.B. `altera-immobilien.vercel.app`

---

## PHASE 2 — E-Mail einrichten mit Resend (15 Min)

### 2.1 Resend Account erstellen
1. Gehe zu **resend.com**
2. Klicke **Get Started** — kostenlos
3. Mit E-Mail registrieren
4. E-Mail bestätigen

### 2.2 API Key holen
1. Einloggen auf resend.com
2. Linke Seite: klicke **API Keys**
3. Klicke **Create API Key**
4. Name: `altera-production`
5. Klicke **Add**
6. Es erscheint ein Key: `re_xxxxxxxxxxxxxxxx`
7. ⚠️ JETZT KOPIEREN — wird nur einmal angezeigt!
8. Irgendwo sicher abspeichern (Notizapp, etc.)

### 2.3 Domain verifizieren (optional aber empfohlen)
> Wenn ihr noch keine Domain habt, diesen Schritt überspringen.
> Dann sendet Resend von einer Test-Adresse.

Falls ihr `altera-immobilien.ch` bereits habt:
1. In Resend: **Domains** → **Add Domain**
2. `altera-immobilien.ch` eingeben
3. Resend zeigt euch DNS-Einträge
4. Diese beim Domain-Anbieter (Infomaniak) eintragen
5. ~10 Min warten → Domain ist verifiziert

---

## PHASE 3 — CRM mit Airtable einrichten (15 Min)

### 3.1 Airtable Account erstellen
1. Gehe zu **airtable.com**
2. Klicke **Sign up for free**
3. Mit E-Mail registrieren
4. E-Mail bestätigen

### 3.2 Base (Datenbank) erstellen
1. Einloggen auf airtable.com
2. Klicke **+ Create a base**
3. Wähle **Start from scratch**
4. Name: `Altera CRM`
5. Klicke **Create base**

### 3.3 Tabelle "Leads" einrichten
Die erste Tabelle heisst automatisch "Table 1" — umbenennen zu **Leads**:

Felder hinzufügen (+ Klicken):

| Feldname | Typ |
|---|---|
| Vorname | Single line text |
| Nachname | Single line text |
| E-Mail | Email |
| Telefon | Phone number |
| PLZ | Single line text |
| Ort | Single line text |
| Objekttyp | Single line text |
| Fläche (m²) | Number |
| Geschätzter Wert (CHF) | Number |
| Score | Number |
| Bewertungsgrund | Single line text |
| Status | Single select → Optionen: Neu / Kontaktiert / Abgeschlossen |
| Erstellt am | Date |
| Notizen | Long text |

### 3.4 Tabelle "Kontaktanfragen" erstellen
1. Unten links **+ Add or import**
2. **Create new table**
3. Name: `Kontaktanfragen`

Felder:

| Feldname | Typ |
|---|---|
| Name | Single line text |
| E-Mail | Email |
| Telefon | Phone number |
| Anliegen | Single line text |
| Adresse Liegenschaft | Single line text |
| Nachricht | Long text |
| Status | Single select → Neu / Beantwortet |
| Erstellt am | Date |

### 3.5 API Key holen
1. Gehe zu **airtable.com/create/tokens**
2. Klicke **Create new token**
3. Name: `altera-production`
4. Scopes (Berechtigungen) auswählen:
   - `data.records:read`
   - `data.records:write`
5. Access: **All current and future bases**
6. Klicke **Create token**
7. Token kopieren: `patxxxxxxxxxxxxxxxx`
8. ⚠️ Sofort sicher abspeichern!

### 3.6 Base ID holen
1. Öffne deine `Altera CRM` Base
2. Schaue die URL an: `airtable.com/appXXXXXXXXXXXXXX/...`
3. Der Teil `appXXXXXXXXXXXXXX` = deine Base ID
4. Kopieren und abspeichern

---

## PHASE 4 — Alles in Vercel verbinden (5 Min)

### 4.1 Environment Variables setzen
1. Gehe zu **vercel.com** → dein Projekt
2. Klicke oben auf **Settings**
3. Links: **Environment Variables**
4. Diese 4 Variables einzeln eintragen:

**Variable 1:**
- Name: `RESEND_API_KEY`
- Value: `re_xxxxxxxx` (dein Resend Key)
- Environment: All (Production, Preview, Development)
- Klicke **Save**

**Variable 2:**
- Name: `AIRTABLE_API_KEY`
- Value: `patxxxxxxxx` (dein Airtable Token)
- Environment: All
- Klicke **Save**

**Variable 3:**
- Name: `AIRTABLE_BASE_ID`
- Value: `appxxxxxxxx` (deine Base ID)
- Environment: All
- Klicke **Save**

**Variable 4:**
- Name: `NOTIFY_EMAIL`
- Value: `hallo@altera-immobilien.ch` (eure E-Mail)
- Environment: All
- Klicke **Save**

### 4.2 Neu deployen
1. In Vercel: oben **Deployments** klicken
2. Beim neusten Deployment: die **...** → **Redeploy**
3. Warten (~1 Minute)
4. ✅ Alles ist verbunden

---

## PHASE 5 — Domain einrichten (10 Min)

### 5.1 Domain kaufen (falls noch nicht vorhanden)
1. Gehe zu **infomaniak.com**
2. Domainsuche: `altera-immobilien.ch`
3. In den Warenkorb → kaufen (~CHF 12/Jahr)

### 5.2 Domain mit Vercel verbinden
1. In Vercel: **Settings** → **Domains**
2. Domain eingeben: `altera-immobilien.ch`
3. Klicke **Add**
4. Vercel zeigt dir DNS-Einträge

### 5.3 DNS bei Infomaniak setzen
1. Login auf **infomaniak.com**
2. **Domains** → deine Domain → **DNS verwalten**
3. Folgenden Eintrag hinzufügen:
   - Typ: `A`
   - Name: `@`
   - Wert: `76.76.21.21`
4. Zweiten Eintrag:
   - Typ: `CNAME`
   - Name: `www`
   - Wert: `cname.vercel-dns.com`
5. Speichern
6. ~10-30 Min warten → Domain ist live

---

## ✅ Checkliste

- [ ] GitHub Account erstellt
- [ ] Code auf GitHub hochgeladen
- [ ] Vercel Account erstellt & deployed
- [ ] Resend Account + API Key
- [ ] Airtable Account + Base + Token + Base ID
- [ ] 4 Environment Variables in Vercel gesetzt
- [ ] Redeploy gemacht
- [ ] Domain gekauft & verbunden

---

## 💰 Kosten Übersicht

| Dienst | Kosten |
|---|---|
| Vercel (Hosting) | CHF 0/Monat |
| Resend (E-Mail) | CHF 0/Monat (bis 3'000 Mails) |
| Airtable (CRM) | CHF 0/Monat (bis 1'000 Einträge) |
| Domain .ch | CHF 12/Jahr |
| **Total** | **CHF 1/Monat** |

---

## 🆘 Häufige Fehler

**"Environment Variable does not exist"**
→ vercel.json öffnen, den ganzen "env" Block löschen, neu pushen

**"API Key invalid"**
→ Key nochmals kopieren, keine Leerzeichen vorne/hinten

**Domain zeigt noch alte Seite**
→ Warten (bis 48h), Browser-Cache leeren (Ctrl+Shift+R)

**E-Mails kommen nicht an**
→ Spam-Ordner prüfen, bei Resend unter "Logs" schauen

---

## 📞 Bei Fragen

Alles was ihr braucht steht in den offiziellen Docs:
- vercel.com/docs
- resend.com/docs
- airtable.com/guides
