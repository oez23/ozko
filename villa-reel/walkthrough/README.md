# Villanya Walkthrough Engine

Baut aus Videoclips pro Raum einen Rundgang in zwei Formaten:

| Komposition | Format | Auflösung |
|---|---|---|
| `Walkthrough-9x16` | Instagram, TikTok, Shorts | 1080 × 1920 |
| `Walkthrough-16x9` | Website, YouTube | 1920 × 1080 |

Das bestehende Foto-Reel (`VillaReel-9x16`, `VillaReel-16x9`) ist unverändert.

## Schnellstart mit Testmaterial

```bash
npm i
node walkthrough/tools/preprocess.mjs testclips     # erzeugt public/walkthrough/test/*.mp4
npx remotion render Walkthrough-9x16 out/walkthrough-9x16.mp4 --props=walkthrough/props.example.json
npx remotion render Walkthrough-16x9 out/walkthrough-16x9.mp4 --props=walkthrough/props.example.json
```

Die Testclips sind langsame Zooms über die vorhandenen Fotos – **kein** echtes Kameramaterial.
Sie dienen nur dazu, die Pipeline zu prüfen.

## Eine Immobilie konfigurieren

1. Clips nach `public/walkthrough/<immobilie>/` legen (wird nicht versioniert, Originale bleiben lokal).
2. `props.example.json` kopieren und anpassen. Die Reihenfolge der `rooms` ist die Reihenfolge im Video.
3. Mit `--props=walkthrough/<datei>.json` rendern. Die Dauer ergibt sich aus den Clips.

Felder pro Raum:

| Feld | Bedeutung |
|---|---|
| `id`, `name` | eindeutige ID und angezeigter Raumname |
| `method` | `recorded`, `gimbal`, `360-export`, `matterport-export`, `polycam-export`, `3dvista-export`, `3d-render`, `ai-transition` |
| `source.src` | Datei unter `public/walkthrough/` (MP4, MOV, M4V, WebM). URLs werden abgelehnt. |
| `source.projection` | `flat` oder `equirectangular` |
| `durationSec`, `trimStartSec`, `playbackRate` | Clipdauer im Video, Startpunkt in der Quelle, Geschwindigkeit |
| `entry`, `exit` | Ein- und Ausstiegspunkt als Beschreibung (z. B. „Tür zum Flur“) |
| `transitionToNext` | `cut`, `fade`, `slide`, `wipe` mit `durationSec` |
| `focus.vertical`, `focus.horizontal` | Bildausschnitt je Format (0..1), Standard Mitte |
| `verification` | `pending`, `verified`, `rejected` |
| `voiceover` | `text` (als Untertitel bei `showCaptions`) und optional `audioSrc` |
| `sourceReference` | Pflicht bei 3D-Exporten: Tour-ID, Projekt oder Datei |
| `ai` | Pflicht bei `ai-transition`: Provider, Start-/Endfoto, Prüfvermerke |

Global: `title`, `subtitle`, `introSec`, `endCardSec`, `showRoomLabels`, `showCaptions`,
`music` (`src`, `volume`), `rights`, `mode`.

## Entwurf und Freigabe

- `mode: "draft"` rendert alles außer abgelehnten Clips und stempelt jedes Bild mit „ENTWURF · nicht freigegeben“.
- `mode: "final"` rendert nur, wenn **alle** Clips `verified` sind und `rights.ownerApproval`,
  `rights.imageRightsCleared` und `rights.privacyChecked` auf `true` stehen. Sonst bricht der Render mit einer Fehlerliste ab.
- KI-Clips tragen immer den Hinweis „KI-generierter Übergang“; er lässt sich nicht abschalten.
  Für `final` müssen zusätzlich `ai.geometryReviewed` und `ai.connectionConfirmed` von einem Menschen gesetzt sein.

Vor der Freigabe prüfen: Gesichter (auch Spiegelungen), Kennzeichen, persönliche Dokumente, Eigentümerfreigabe.

## Verfahren

**A – echte Kameraaufnahmen** (`recorded`, `gimbal`): fertig. Optional vorher stabilisieren:

```bash
node walkthrough/tools/preprocess.mjs stabilize eingang-roh.mp4 public/walkthrough/villa/eingang.mp4
```

**B – KI-Übergänge** (`ai-transition`): Adapter für Higgsfield und Kling liegen in
`src/walkthrough/providers/`. Sie beschreiben einen Auftrag (Start-/Endfoto, Prompt ohne erfundene Räume),
senden ihn aber nicht: `submitJob` verlangt eine ausdrückliche Freigabe (`approvedPaidCall`), Zugangsdaten
aus Umgebungsvariablen und einen Transport. Ein Transport ist bewusst **nicht** enthalten – es wird kein
kostenpflichtiger Aufruf ausgelöst. Fertige KI-Clips werden wie jede andere Datei eingebunden und starten als `pending`.
Neuer Provider: eine Adapterdatei schreiben und in `providers/index.ts` eintragen.

**C – 360°**: flache Exporte (`360-export`, `projection: "flat"`) funktionieren direkt.
Equirectangulare Dateien werden abgelehnt und müssen erst projiziert werden:

```bash
node walkthrough/tools/preprocess.mjs probe aufnahme.mp4
node walkthrough/tools/preprocess.mjs reproject360 aufnahme.mp4 public/walkthrough/villa/flur.mp4 --yaw 30 --fov 100 --size 1920x1080
```

Ein interaktiver 360°-Viewer ist nicht enthalten.

**D – 3D-Renderings**: Videoexporte aus Matterport, Polycam, 3DVista oder anderen Systemen werden als Clips
eingebunden; `sourceReference` ist Pflicht. Ein GLB-/GLTF-Viewer ist nicht enthalten.

**E – interaktive Touren**: `src/walkthrough/tour/InteractiveTour.tsx` bettet eine Tour per iframe in eine
Webseite ein. Erlaubt sind nur `https` und exakt freigegebene Hosts (Standard: `my.matterport.com`;
weitere Hosts, etwa selbst gehostete 3DVista-Touren, über `allowedHosts`). Eine Tour-URL als Videoquelle wird abgelehnt.

## Tests

```bash
npm run lint
npm test
```

## Umgebungsvariablen

Nur nötig, wenn ein KI-Provider angebunden wird. Nie in den Code oder ins Repository schreiben.

| Provider | Variablen |
|---|---|
| Higgsfield | `HIGGSFIELD_API_KEY` |
| Kling | `KLING_ACCESS_KEY`, `KLING_SECRET_KEY` |
