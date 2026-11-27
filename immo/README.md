# Ozko Emlak

Mandantenfähige Makler-Software für den türkischen Markt: Portfolio, Kunden, Käufer-Matching, Marktwert-Einschätzung und PDF-Dokumente.
Arbeitstitel – Name, Logo und Design sind eigenständig und vor dem Verkauf final festzulegen.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `core/` | Fachlogik ohne Framework: Validierung (zod), Matching, Bewertung, CSV-Import, Rechte. Wird von Web und später der Expo-App geteilt. |
| `web/` | Next.js-App (App Router), Postgres über Drizzle. `src/lib/data/` ist die einzige Schicht mit Datenbankzugriff; jede Funktion verlangt eine `Session` und filtert nach `orgId`. |
| `web/src/i18n/` | Türkisch (Standard, maßgeblich für die Struktur) und Deutsch. `core/` enthält keine Texte, nur Fehlercodes. |
| `web/src/lib/pdf/` | Käuferpräsentation und Marktanalyse als PDF. Die Schrift liegt in `web/assets/fonts/` (Inter, OFL). |

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

## Markt-Besonderheiten

- Standardwährung TRY; Beträge sind ganze Zahlen ohne Umrechnung zwischen Währungen.
- Zimmer im Format „3+1" (Zimmer + Wohnzimmer), auch im CSV-Import.
- Ortsnamen, CSV-Spalten und CSV-Werte werden über `placeKey()` verglichen, nie über `toLowerCase()`: „İ" und „I" verhalten sich im Türkischen anders.

## Stand

Fertig und getestet: Registrierung/Login, Mandantentrennung, Portfolio (Liste, Filter, Detail, Formular, CSV-Import, Preisverlauf), Kunden, Suchaufträge, Matching in beide Richtungen, Marktwert-Einschätzung aus eigenen Vergleichsobjekten, Käuferpräsentation und Marktanalyse als PDF, Profil mit Telefonnummer, Sprachumschaltung TR/DE, Audit-Log.

Offen: Expo-App mit API, Team-Einladungen, Passwort-Reset, Objektfotos und Bürologo (brauchen Dateispeicher), Abos/Zahlung, KVKK-Funktionen (Aydınlatma, Auskunft, Löschung), Begrenzung der PDF-Erzeugung pro Nutzer.

Bekannt: `npm audit` meldet 4 mittlere Funde in `drizzle-kit` (nur Entwicklungswerkzeug, nicht im Produktions-Build).
