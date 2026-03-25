# Altera Immobilien — Vercel Environment Variables

## Erforderliche Keys (alle in Vercel Settings → Environment Variables)

| Variable              | Wo holen                                      | Wofür                          |
|-----------------------|-----------------------------------------------|--------------------------------|
| `RESEND_API_KEY`      | resend.com → API Keys                         | E-Mail Versand                 |
| `AIRTABLE_API_KEY`    | airtable.com → Developer Hub → Personal Token | CRM / Lead-Speicherung         |
| `AIRTABLE_BASE_ID`    | Airtable URL: app...                          | Welche Base                    |
| `NOTIFY_EMAIL`        | Deine E-Mail                                  | Team-Benachrichtigung          |
| `PDFSHIFT_API_KEY`    | pdfshift.io → Dashboard                       | PDF-Generierung                |
| **`ANTHROPIC_API_KEY`** | **console.anthropic.com → API Keys**        | **KI-Bewertungsagent ✨**       |

## ANTHROPIC_API_KEY einrichten

1. Gehe auf https://console.anthropic.com
2. Registrieren / Einloggen
3. Links: "API Keys" → "Create Key"
4. Key kopieren (beginnt mit `sk-ant-...`)
5. In Vercel: Settings → Environment Variables → `ANTHROPIC_API_KEY` = sk-ant-...

## Kosten KI-Agent (claude-sonnet-4-6)
- ~$0.003 pro Bewertung (Input ~800 Tokens + Output ~400 Tokens)
- 1000 Bewertungen/Monat = ~$3 total
- Kein Minimum, pay-as-you-go

## Fallback
Wenn ANTHROPIC_API_KEY fehlt oder Claude nicht erreichbar ist,
fällt das System automatisch auf den klassischen Algorithmus zurück.
Kein Ausfall, keine Fehlermeldung an den Nutzer.
