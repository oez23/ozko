# Self-Hosting-Stack

Deploy-Dateien für die selbst gehosteten Werkzeuge. GitHub speichert hier nur die
Konfiguration – die Dienste laufen auf einem eigenen Rechner (Server, NAS, Mini-PC)
mit Docker und Docker Compose.

| Werkzeug | Zweck | Status in diesem Repo |
|---|---|---|
| Immich | Foto- und Videoverwaltung | `immich/` – offizielle Compose-Datei |
| Twenty | CRM | `twenty/` – offizielle Compose-Datei |
| Jellyfin | Medienserver (Filme, Serien, Musik) | `jellyfin/` – Compose nach offizieller Anleitung |
| Documenso | Dokumente digital signieren | `documenso/` – offizielle Compose-Datei |
| Anytype | Notizen / Wissensbasis | Desktop-App, kein Server nötig – siehe unten |
| Papermark | Dokumente teilen mit Tracking | kein Compose – siehe unten |
| tldraw | Whiteboard | kein Compose – siehe unten |

Die Compose-Dateien für Immich, Twenty und Documenso sind unverändert von den Projekten übernommen
(Stand 2026-11-19); für Updates die Datei neu von der Quelle laden, nicht von Hand
anpassen. Jellyfin liefert keine fertige Datei – die hier folgt der offiziellen Anleitung.

## Immich

Quelle: <https://github.com/immich-app/immich/releases/latest> · Doku: <https://docs.immich.app/install/docker-compose>

```bash
cd selfhost/immich
cp .env.example .env
```

In `.env` setzen: `DB_PASSWORD` (zufällig, nur `A-Za-z0-9`), `UPLOAD_LOCATION`
(Pfad mit genug Speicher), optional `TZ=Europe/Berlin`.

```bash
docker compose up -d
```

Danach <http://localhost:2283> öffnen und den Admin-Account anlegen.
Bedarf: mindestens 4 GB RAM (empfohlen 6 GB+), Datenbank auf SSD, nicht auf Netzlaufwerk.

## Twenty CRM

Quelle: <https://github.com/twentyhq/twenty/tree/main/packages/twenty-docker> · Doku: <https://docs.twenty.com>

```bash
cd selfhost/twenty
cp .env.example .env
```

In `.env` die Kommentarzeichen entfernen und setzen:

- `PG_DATABASE_PASSWORD` – Ausgabe von `openssl rand -hex 32`
- `ENCRYPTION_KEY` – Ausgabe von `openssl rand -base64 32`
- `SERVER_URL` – die Adresse, unter der Twenty erreichbar sein wird
- `TAG` – auf eine feste Version setzen statt `latest`, damit Updates bewusst passieren

```bash
docker compose up -d
```

Danach <http://localhost:3000> öffnen. Bedarf: mindestens 2 GB RAM.

## Jellyfin

Doku: <https://jellyfin.org/docs/general/installation/container>

```bash
cd selfhost/jellyfin
cp .env.example .env
```

In `.env` setzen: `MEDIA_LOCATION` (Ordner mit den Medien), `PUID`/`PGID`
(Ausgabe von `id -u` und `id -g`), `JELLYFIN_VERSION` auf eine feste Version.

```bash
mkdir -p config cache
docker compose up -d
```

Danach <http://localhost:8096> öffnen und den Einrichtungsassistenten durchlaufen.
Hardware-Transcoding (GPU) ist nicht konfiguriert; bei Bedarf nach der Jellyfin-Doku ergänzen.

## Documenso

Quelle: <https://github.com/documenso/documenso/tree/main/docker/production> · Doku: <https://docs.documenso.com/docs/self-hosting/deployment/docker-compose>

Documenso braucht mehr Vorarbeit als die anderen Dienste:

1. **Signaturzertifikat** als `/opt/documenso/cert.p12` auf dem Host ablegen (der Pfad ist
   in der offiziellen Compose-Datei fest eingetragen). Anleitung:
   <https://docs.documenso.com/docs/self-hosting/configuration/signing-certificate>
2. **SMTP-Zugang** – ohne E-Mail-Versand erreichen Signatur-Anfragen niemanden.

```bash
cd selfhost/documenso
cp .env.example .env
```

In `.env` alle `CHANGE_ME`-Werte ersetzen (Datenbank-Passwort in beiden Zeilen gleich).

```bash
docker compose up -d
```

Danach <http://localhost:3001> öffnen, Konto anlegen und anschließend
`NEXT_PUBLIC_DISABLE_SIGNUP=true` setzen.

Rechtlicher Hinweis: Ein selbst erzeugtes Zertifikat ergibt eine einfache elektronische
Signatur. Für Verträge, die Schriftform oder eine qualifizierte Signatur (eIDAS) verlangen,
reicht das nicht – das vor dem Einsatz für Immobilien- oder Arbeitsverträge klären.

## Anytype

Anytype ist eine lokale Desktop- und Mobil-App mit Ende-zu-Ende-verschlüsselter
Synchronisation – es gibt nichts auf einem Server zu installieren.
Download: <https://anytype.io>. Ein eigener Sync-Server (any-sync) ist möglich,
aber für eine Einzelperson unnötiger Betriebsaufwand.

Anbindung an Claude über den offiziellen MCP-Server `@anyproto/anytype-mcp`
(<https://github.com/anyproto/anytype-mcp>). Er spricht mit der lokal laufenden
Anytype-App und funktioniert daher nur auf dem Rechner, auf dem Anytype läuft –
nicht in Cloud-Sessions. Deshalb ist er bewusst nicht in einer `.mcp.json` im Repo
eingetragen. Einrichtung auf dem eigenen Rechner:

1. In Anytype: Einstellungen → API Keys → neuen Key erzeugen.
2. Den Key als Umgebungsvariable setzen, nicht in eine Datei im Repo schreiben.
3. MCP-Server in Claude Code hinzufügen wie in der README des Projekts beschrieben.

## Papermark

Papermark (<https://github.com/mfts/papermark>) liefert weder Dockerfile noch
Compose-Datei. Die App setzt neben Postgres eine Reihe externer Dienste voraus:
Vercel Blob oder S3, Resend, Tinybird, Upstash QStash und Redis, Trigger.dev, Hanko.
Selbst hosten heißt also: sieben Konten anlegen und eine Next.js-App selbst bauen
und betreiben.

Empfehlung: die gehostete Version (<https://www.papermark.com>) nutzen. Ein eigenes
Deployment lohnt erst, wenn Datenhoheit oder Kosten es klar verlangen – dann am
einfachsten als Fork auf Vercel, nicht per Docker.

## tldraw

tldraw (<https://github.com/tldraw/tldraw>) ist in erster Linie ein SDK, um ein
Whiteboard in eine eigene React-App einzubauen – kein fertiger Server. Für die
App hinter tldraw.com gibt es kein offizielles Docker-Image und keine
Self-Hosting-Anleitung. Die Lizenz ist zudem nicht Open Source im üblichen Sinn:
für den Produktiveinsatz des SDK ist ein Lizenzschlüssel vorgesehen
(Bedingungen vor dem Einsatz prüfen: <https://tldraw.dev>).

Empfehlung: <https://www.tldraw.com> direkt im Browser nutzen. Wer ein selbst
gehostetes Whiteboard braucht, ist mit Excalidraw (MIT-Lizenz, offizielles
Docker-Image `excalidraw/excalidraw`) besser bedient. Das SDK lohnt nur, wenn ein
Whiteboard Teil eines eigenen Produkts werden soll.

## Sicherheit und Betrieb

- `.env`-Dateien enthalten Secrets und sind per `.gitignore` ausgeschlossen. Nie committen.
- Die Ports 2283, 3000, 3001 und 8096 nicht direkt ins Internet freigeben. Zugriff von außen über
  VPN (z. B. Tailscale/WireGuard) oder einen Reverse-Proxy mit HTTPS.
- Backups einplanen, bevor echte Daten hineinkommen: Immich braucht Datenbank-Dump
  **und** `UPLOAD_LOCATION`; Twenty die Docker-Volumes `db-data` und `server-local-data`;
  Jellyfin den Ordner `config`; Documenso das Volume `database` und das Zertifikat.
- Vor Updates die Release Notes lesen – die Projekte haben gelegentlich Breaking Changes.

## Prüfstand

Alle vier Compose-Dateien wurden mit `docker compose config` syntaktisch validiert.
Ein echter Start (`docker compose up`) wurde nicht getestet, weil in der
Entwicklungsumgebung kein Docker-Daemon lief.
