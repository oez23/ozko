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
| Postiz | Social-Media-Planung | `postiz/` – offizielle Compose-Datei |
| Inbox Zero | KI-Assistent für das E-Mail-Postfach | `inbox-zero/` – offizielle Compose-Datei |
| AppFlowy, Cal.com, OpenProject, Cap, Chatwoot | siehe Abschnitt „Weitere Dienste“ | Start direkt aus dem offiziellen Repository |
| OpenWhispr, VoiceStudio | Diktat / Sprachsynthese | Desktop-Apps – siehe unten |
| CrowdSec | Angriffserkennung und IP-Sperren | nativ auf dem Host – siehe unten |
| Anytype | Notizen / Wissensbasis | Desktop-App, kein Server nötig – siehe unten |
| Papermark | Dokumente teilen mit Tracking | kein Compose – siehe unten |
| tldraw | Whiteboard | kein Compose – siehe unten |

Die Compose-Dateien für Immich, Twenty, Documenso, Postiz und Inbox Zero sind unverändert von den Projekten übernommen
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

## Postiz

Quelle: <https://github.com/gitroomhq/postiz-docker-compose> · Doku: <https://docs.postiz.com>

Die offizielle Compose-Datei enthält alle Einstellungen direkt in der Datei. Damit keine
Secrets in Git landen, kommen eigene Werte in eine Override-Datei, die nicht versioniert wird:

```bash
cd selfhost/postiz
cp docker-compose.override.example.yaml docker-compose.override.yaml
```

In `docker-compose.override.yaml` setzen: `JWT_SECRET` (Ausgabe von `openssl rand -base64 48`)
und die Zugangsdaten der Netzwerke, die genutzt werden sollen.

```bash
docker compose up -d
```

Danach <http://localhost:4007> öffnen, Konto anlegen und `DISABLE_REGISTRATION: 'true'` setzen.

Zu beachten:

- Der Stack ist schwer: neben Postiz laufen Postgres, Redis, Temporal, ein zweites Postgres
  und Elasticsearch. Mindestens 4 GB freier RAM nur dafür.
- Jedes soziale Netzwerk verlangt eine eigene Entwickler-App mit Prüfung durch den Anbieter
  (Meta, TikTok, Google). Das ist der eigentliche Aufwand, nicht das Docker-Setup.
- Die Datenbank-Passwörter in der offiziellen Datei sind Standardwerte. Die Datenbanken sind
  nur im internen Docker-Netz erreichbar; die Ports dürfen nicht nach außen freigegeben werden.

## Inbox Zero

Quelle: <https://github.com/elie222/inbox-zero> · Doku: <https://docs.getinboxzero.com>

```bash
cd selfhost/inbox-zero
cp .env.example .env
```

In `.env` alle `CHANGE_ME`-Werte ersetzen.

```bash
docker compose --profile all up -d
```

Danach <http://localhost:3002> öffnen. Ohne `--profile all` starten Datenbank und Redis nicht.

Zu beachten – dieser Dienst hat die höchste Einstiegshürde und das höchste Datenrisiko im Stack:

- Er braucht ein Google-Cloud-Projekt mit Gmail-API, OAuth-Client und Pub/Sub-Topic. Die
  Gmail-Berechtigungen sind von Google als „restricted" eingestuft; ohne Verifizierung läuft
  die App nur im Testmodus mit eingetragenen Testnutzern.
- Für Push-Benachrichtigungen von Gmail muss die Instanz aus dem Internet per HTTPS erreichbar
  sein – reiner VPN-Betrieb reicht dafür nicht.
- Der Inhalt der E-Mails wird an den eingetragenen KI-Anbieter gesendet und verursacht dort
  laufende Kosten. Vor dem Einsatz mit Geschäfts- oder Kundenpost die DSGVO-Seite klären
  (Auftragsverarbeitung, Speicherort).
- Der Dienst kann E-Mails senden, archivieren und löschen. Automatische Regeln zuerst im
  Entwurfs- bzw. Testmodus prüfen.

## Weitere Dienste – Start aus dem offiziellen Repository

Diese Projekte bringen neben der Compose-Datei weitere Dateien mit (Nginx-Konfiguration,
Build-Kontexte, Initialisierungsskripte). Eine einzelne kopierte Compose-Datei würde nicht
laufen, deshalb wird hier das offizielle Repository auf dem Server geklont statt Dateien
in dieses Repo zu übernehmen. Die folgenden Abläufe sind aus den jeweiligen READMEs
übernommen und hier nicht getestet.

### AppFlowy (Notizen, Datenbanken, Projektboards)

Quelle: <https://github.com/AppFlowy-IO/AppFlowy-Cloud>

```bash
git clone https://github.com/AppFlowy-IO/AppFlowy-Cloud
```

```bash
cd AppFlowy-Cloud && cp deploy.env .env
```

`.env` anpassen (Passwörter, Domain), dann `docker compose up -d`. Der Stack umfasst rund
zehn Container (u. a. Postgres, MinIO, Redis, GoTrue, Nginx) und belegt die Ports 80/443.
AppFlowy deckt weitgehend denselben Zweck ab wie Anytype – eines von beiden genügt.

### Cal.com (Terminbuchung)

Quelle: <https://github.com/calcom/docker>

```bash
git clone https://github.com/calcom/docker calcom-docker
```

```bash
cd calcom-docker && cp .env.example .env
```

In `.env` mindestens `NEXTAUTH_SECRET` und `CALENDSO_ENCRYPTION_KEY` setzen, dann
`docker compose up -d`. Standardport 3000.

### OpenProject (Projektmanagement)

Quelle: <https://github.com/opf/openproject-docker-compose>

```bash
git clone https://github.com/opf/openproject-docker-compose.git --depth=1 --branch=stable/17 openproject
```

```bash
cd openproject && cp .env.example .env
```

In `.env` `SECRET_KEY_BASE` und das Datenbank-Passwort ersetzen, dann
`docker compose up -d --build --pull always`. Erreichbar unter <http://localhost:8080>
(nur lokal gebunden). Mindestens 4 GB RAM.

### Cap (Bildschirmaufnahmen teilen)

Quelle: <https://github.com/CapSoftware/Cap>

```bash
git clone https://github.com/CapSoftware/Cap.git
```

```bash
cd Cap && docker compose up -d
```

Standardport 3000. Ohne konfigurierten E-Mail-Versand erscheinen die Login-Links in
`docker compose logs cap-web`. Die Desktop-App wird unter „Cap Server URL" auf die eigene
Instanz gestellt.

### Chatwoot (Kunden-Chat und Support-Postfach)

Quelle: <https://github.com/chatwoot/chatwoot> – die Dateien `.env.example` und
`docker-compose.production.yaml` aus dem Repository laden, als `.env` und
`docker-compose.yaml` ablegen, `SECRET_KEY_BASE`, `FRONTEND_URL` und die Passwörter für
Postgres und Redis setzen. Vor dem ersten Start die Datenbank vorbereiten:

```bash
docker compose run --rm rails bundle exec rails db:chatwoot_prepare
```

```bash
docker compose up -d
```

Standardport 3000, nur lokal gebunden.

### Portkonflikt

Twenty, Cal.com, Cap und Chatwoot wollen alle Port 3000. Auf einem gemeinsamen Server muss
jeder Dienst einen eigenen Host-Port bekommen (in der jeweiligen `.env` bzw. Compose-Datei)
oder hinter einem Reverse-Proxy mit eigener Subdomain laufen.

## Desktop-Apps (kein Server)

- **OpenWhispr** (<https://github.com/OpenWhispr/openwhispr>, MIT): Diktier-App mit lokalen
  oder Cloud-Modellen. Installation auf dem eigenen Rechner über die Releases.
- **VoiceStudio** (<https://github.com/debpalash/VoiceStudio>, AGPL-3.0): lokale
  Sprachsynthese, Stimmklone und Vertonung. Braucht eine GPU bzw. Apple Silicon. Für
  bezahlte Kundenarbeit nennt das Projekt eine eigene kommerzielle Lizenz – vor
  gewerblichem Einsatz prüfen. Stimmen realer Personen nur mit deren Einwilligung klonen.

## CrowdSec

CrowdSec wertet Logdateien aus und sperrt angreifende IP-Adressen. Es schützt den Host und
gehört deshalb direkt auf den Server, nicht in einen der App-Stacks. Sinnvoll wird es erst,
wenn Dienste aus dem Internet erreichbar sind – hinter VPN ohne offene Ports bringt es wenig.

Installation auf Debian/Ubuntu (Doku: <https://docs.crowdsec.net>):

```bash
curl -s https://install.crowdsec.net | sudo sh
```

```bash
sudo apt install crowdsec
```

```bash
sudo apt install crowdsec-firewall-bouncer-nftables
```

Der erste Befehl richtet die Paketquelle ein, der zweite installiert die Erkennung, der dritte
den „Bouncer", der die Sperren in der Firewall durchsetzt – ohne Bouncer wird nur erkannt,
nicht gesperrt. Danach die passende Collection für den Reverse-Proxy installieren
(z. B. `sudo cscli collections install crowdsecurity/nginx`) und mit `sudo cscli metrics`
prüfen, ob Logs gelesen werden.

Hier ist bewusst keine Compose-Datei hinterlegt: Welche Logs einzubinden sind und welcher
Bouncer passt, hängt vom Server und vom Reverse-Proxy ab, und beides steht noch nicht fest.

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
- Die Ports 2283, 3000, 3001, 3002, 4007 und 8096 nicht direkt ins Internet freigeben. Zugriff von außen über
  VPN (z. B. Tailscale/WireGuard) oder einen Reverse-Proxy mit HTTPS.
- Backups einplanen, bevor echte Daten hineinkommen: Immich braucht Datenbank-Dump
  **und** `UPLOAD_LOCATION`; Twenty die Docker-Volumes `db-data` und `server-local-data`;
  Jellyfin den Ordner `config`; Documenso das Volume `database` und das Zertifikat;
  Postiz die Volumes `postgres-volume` und `postiz-uploads`; Inbox Zero das Volume `database-data`.
- Vor Updates die Release Notes lesen – die Projekte haben gelegentlich Breaking Changes.

## Prüfstand

Die sechs Compose-Dateien in diesem Repo wurden mit `docker compose config` syntaktisch validiert.
Ein echter Start (`docker compose up`) wurde nicht getestet, weil in der
Entwicklungsumgebung kein Docker-Daemon lief.
