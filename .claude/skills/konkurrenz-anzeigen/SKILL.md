---
name: konkurrenz-anzeigen
description: Recherchiert die Google-Anzeigen anderer Firmen im öffentlichen Google Ads Transparency Center und leitet daraus eigene Anzeigen ab. Verwenden, wenn der Nutzer wissen will, welche Google Ads ein Wettbewerber oder eine Branche schaltet, welche Anzeigen am längsten laufen, oder wenn fremde Anzeigen als Vorlage für eigene übernommen werden sollen.
---

# Konkurrenz-Anzeigen recherchieren und übernehmen

Datenquelle ist Googles öffentliches Anzeigenarchiv, abgefragt über den Firecrawl-Anbieter
`adstransparency-google-com` (Werkzeug `alexandria_library_read`). Jeder Aufruf kostet 5 Firecrawl-Credits.
Vor mehr als etwa 10 Aufrufen dem Nutzer die erwarteten Kosten nennen.

## Ablauf

1. **Ziel klären.** Wessen Anzeigen (Firmenname oder Domain), welches Land (Standard `DE`), und wofür der
   Nutzer selbst werben will (Angebot, Zielgruppe, Region). Fehlt eine Wettbewerberliste, zuerst per Websuche
   3 bis 5 Anbieter finden, die auf die Suchbegriffe des Nutzers Anzeigen schalten.
2. **Werbetreibenden finden.** `ad-transparency/suggest` mit `query` (Firmenname oder Domain-Teil) und `region`.
   Das Archiv sucht nach Namen, nicht nach Suchbegriffen: „Webdesign Hamburg“ liefert nichts, „Jimdo“ schon.
   Leeres Ergebnis: mit `region: "anywhere"` wiederholen, dann `ad-transparency/search_advertisers`.
3. **Anzeigen laden.** `ad-transparency/list_ads` mit `advertiser_id` (bevorzugt) oder `domain`, dazu `region`
   und bei Bedarf `format` (`TEXT`, `IMAGE`, `VIDEO`). Eine Domain-Abfrage enthält Anzeigen aller Konten, die
   auf diese Domain verlinken; `advertiser_id` jeder Zeile prüfen. Weitere Seiten über `continuation`.
4. **Nach Laufzeit sortieren.** `days_shown` absteigend. Lange Laufzeit ist das einzige öffentliche
   Erfolgssignal: Niemand bezahlt monatelang für eine Anzeige, die nicht funktioniert. Ausgaben, Klicks und
   Suchbegriffe zeigt das Archiv für normale Anzeigen nicht; das nie behaupten.
5. **Inhalt lesen.** Der Anzeigentext steckt meist in einem Vorschaubild (`preview.image_url`). Die 5 bis 10
   langlebigsten Anzeigen ansehen (Bild laden und lesen, sonst `ad-transparency/get_ad` oder die Archivseite
   aus `url` per `firecrawl_scrape`). Lässt sich ein Bild nicht laden, das sagen und dem Nutzer den Link geben.
6. **Auswerten.** Pro Anzeige: Aufhänger, Versprechen, Angebot oder Preis, Handlungsaufforderung, Zielseite.
   Dann die Muster: Was wiederholt sich bei den Langläufern, was fehlt ganz (Lücke für den Nutzer).
7. **Übernehmen.** Aus den Mustern eigene Anzeigen schreiben: je Variante 15 Überschriften (max. 30 Zeichen)
   und 4 Beschreibungen (max. 90 Zeichen) für eine responsive Suchanzeige, Zeichenzahl nachgezählt. Für die
   Ausarbeitung kann der Skill `responsive-search-ad-writer` genutzt werden.

## Grenzen beim Übernehmen

- Struktur, Aufhänger und Angebotslogik übernehmen, nicht den Wortlaut. Wörtlich kopierte Anzeigen,
  fremde Markennamen im Anzeigentext und fremde Bilder sind rechtlich angreifbar (Urheber-, Marken- und
  Wettbewerbsrecht) und verstoßen gegen die Google-Ads-Richtlinien.
- Keine Behauptungen übernehmen, die der Nutzer nicht selbst belegen kann (Preise, „Nr. 1“, Garantien,
  Bewertungen).
- Nichts im Google-Ads-Konto ändern. Ergebnis ist ein Entwurf zur Freigabe.

## Ergebnis

Eine kurze Übersicht: Tabelle der stärksten fremden Anzeigen (Firma, Laufzeit in Tagen, Aufhänger, Angebot,
Link zum Archiv), drei bis fünf erkannte Muster, die Lücke, und die eigenen Anzeigenentwürfe. Dazu sagen,
wie viele Anzeigen geprüft wurden und wie viele Credits das gekostet hat.
