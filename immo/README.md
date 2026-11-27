# Ozko Immo

Mandantenfähige Makler-Software: Portfolio, Kontakte, Käufer-Matching und Marktwert-Einschätzung.
Arbeitstitel – Name, Logo und Design sind eigenständig und vor dem Verkauf final festzulegen.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `core/` | Fachlogik ohne Framework: Validierung (zod), Matching, Bewertung, CSV-Import, Rechte. Wird von Web und später der Expo-App geteilt. |
| `web/` | Next.js-App (App Router), Postgres über Drizzle. `src/lib/data/` ist die einzige Schicht mit Datenbankzugriff; jede Funktion verlangt eine `Session` und filtert nach `orgId`. |

## Lokal starten

Voraussetzung: Node 22, Postgres 16.

```bash
npm install
cp web/.env.example web/.env.local   # DATABASE_URL anpassen
npm run db:migrate
npm run dev
```

## Prüfen

```bash
npm run typecheck
npm run lint
npm test          # core: Unit-Tests · web: Integrationstests gegen TEST_DATABASE_URL (Standard: Datenbank immo_test)
npm run build
```

Die Integrationstests leeren die Test-Datenbank. `TEST_DATABASE_URL` darf nie auf echte Daten zeigen.

## Rollen

- **Inhaber / Büroleitung**: sehen und bearbeiten alle Objekte und Kontakte des Büros.
- **Makler**: sieht alle Objekte des Büros, bearbeitet nur eigene. Sieht nur eigene Kontakte; bei Treffern auf Suchaufträge von Kollegen erscheint nur „Kunde von …", nie der Name.

## Stand

Fertig und getestet: Registrierung/Login, Mandantentrennung, Portfolio (Liste, Filter, Detail, Formular, CSV-Import, Preisverlauf), Kontakte, Suchaufträge, Matching in beide Richtungen, Marktwert-Einschätzung aus eigenen Vergleichsobjekten, Audit-Log.

Offen: PDF-Präsentationen, Marktanalyse als PDF, Expo-App mit API, Team-Einladungen, Passwort-Reset, Objektfotos (braucht Dateispeicher), Abos/Zahlung, Mehrsprachigkeit (TR/EN), Datenschutz-Funktionen (Auskunft, Löschung).
