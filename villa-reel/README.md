# Villa-Reel Kargıcak (Remotion)

Elegantes Immobilien-Reel aus echten Fotos: langsame Zooms, dezente Schwenks, weiche Überblendungen.
Keine generativen Bildänderungen – Gebäude, Räume und Ausstattung bleiben wie fotografiert.

## Ausgaben
| Datei | Format | Auflösung | fps | Dauer |
|---|---|---|---|---|
| `out/villa-kargicak-9x16.mp4` | 9:16 (Reels/Shorts/TikTok) | 1080 × 1920 | 30 | 25 s |
| `out/villa-kargicak-16x9.mp4` | 16:9 (YouTube/Website) | 1920 × 1080 | 30 | 25 s |

H.264, yuv420p, BT.709, faststart. `out/` ist nicht versioniert.

## Ablauf (8 Szenen à 3,3 s + Abschluss, 0,6 s Überblendung)
1. Terrasse & Pool (Außen, mit Titel) · 2. Pool & Meerblick · 3. Wohnbereich · 4. Küche ·
5. Marmortreppe · 6. Hauptschlafzimmer · 7. Schlafzimmer · 8. Bad · Abschlusstafel

Bildausschnitte pro Format stehen in `src/scenes.ts` (inkl. Begründung bei bewusst ausgeschnittenen Details:
Schuhe auf der Terrasse, gespiegelte Hand im Bad). Hochformat-Fotos laufen in 16:9 als Panel über einer
unscharfen Kopie – nichts wird verzerrt oder angeschnitten.

## Texte
Nur bestätigte Angaben: derzeit ausschließlich „Villa in Kargıcak“. Weitere Daten (Name, Fläche, Zimmer,
Kontakt) erst nach Bestätigung in `TITLE`/`SUBTITLE` in `src/scenes.ts` eintragen.

## Musik
Keine – es liegt keine lizenzierte Datei vor.

## Rendern
```bash
npm i
npx remotion studio                       # Vorschau
npx remotion render VillaReel-9x16 out/villa-kargicak-9x16.mp4 --crf=18 --image-format=png --pixel-format=yuv420p --color-space=bt709
npx remotion render VillaReel-16x9 out/villa-kargicak-16x9.mp4 --crf=18 --image-format=png --pixel-format=yuv420p --color-space=bt709
```
In Umgebungen ohne Chrome-Download: `REMOTION_BROWSER_EXECUTABLE=/pfad/zu/chrome-headless-shell` setzen.

## Lizenzen
Schrift: Cormorant Garamond (SIL Open Font License), lokal in `public/fonts/`.
Remotion: frei für Teams bis 3 Personen, sonst Firmenlizenz nötig (remotion.pro/license).
