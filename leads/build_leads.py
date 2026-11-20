"""Fuehrt die Roh-Suchergebnisse (leads/raw/*.json) zu einer Lead-Liste zusammen.

Filter: Betrieb aktiv, in Hamburg, keine eigene Webseite (leer oder nur
Social-Media-/Verzeichnis-Link). Sortierung: Anzahl Bewertungen absteigend.
"""
import csv, glob, json, re, sys
from urllib.parse import urlparse

NO_OWN_SITE = ("facebook.", "instagram.", "linktr.ee", "google.", "11880.", "gelbeseiten.",
               "dasoertliche.", "myhammer.", "check24.", "wa.me", "tiktok.", "youtube.",
               "business.site", "jimdosite.", "wixsite.", "kleinanzeigen.", "gartenbauer.io",
               "golocal.", "cylex.", "yelp.", "werkenntdenbesten.", "branchenbuch")

def site_status(url):
    if not url:
        return "keine"
    host = urlparse(url).netloc.lower()
    return "nur Social/Verzeichnis" if any(s in host for s in NO_OWN_SITE) else "eigene"

TRADE = ("gartenbau", "gärtner", "landschafts", "rasenpflege", "baumarbeiten", "baumpflege",
         "gartenpflege", "hausmeister")
EXCLUDE = ("verein", "gemeinschaftsgarten", "bedarf", "gartencenter", "architekt")

def is_trade(p):
    cats = " ".join(p.get("categories") or []).lower()
    return any(t in cats for t in TRADE) and not any(x in cats for x in EXCLUDE)

def in_hamburg(p):
    # Adressen nennen oft den Bezirk statt "Hamburg" -> ueber Hamburger PLZ-Bereiche pruefen.
    m = re.search(r"\b(\d{5})\b", p.get("address") or "")
    return bool(m) and (20095 <= int(m.group(1)) <= 21149 or 22041 <= int(m.group(1)) <= 22769)

def load():
    places = {}
    for path in sorted(glob.glob("leads/raw/*.json")):
        for call in json.load(open(path))["data"]["alexandria"]:
            for p in (call.get("data") or {}).get("results", []):
                places.setdefault(p["feature_id"], p)
    return list(places.values())

def main(out):
    places = load()
    active = [p for p in places if p.get("business_status") == "operational" and is_trade(p) and in_hamburg(p)]
    leads = [p for p in active if site_status(p.get("website")) != "eigene"]
    leads.sort(key=lambda p: (-(p.get("review_count") or 0), -(p.get("rating") or 0)))
    with open(out, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["Nr", "Name", "Kategorie", "Adresse", "Telefon", "Bewertung", "Anzahl Bewertungen",
                    "Webseite-Status", "Link (falls vorhanden)", "Maps-Suche"])
        for i, p in enumerate(leads, 1):
            q = (p["name"] + " " + (p.get("address") or "")).replace(" ", "+")
            w.writerow([i, p["name"], ", ".join(p.get("categories") or []), p.get("address") or "",
                        p.get("phone") or "", p.get("rating") or "", p.get("review_count") or 0,
                        site_status(p.get("website")), p.get("website") or "",
                        "https://www.google.com/maps/search/?api=1&query=" + q])
    print(f"gefunden: {len(places)} | aktive Fachbetriebe in Hamburg: {len(active)} | Leads ohne eigene Webseite: {len(leads)}"
          f" | davon mit Telefon: {sum(bool(p.get('phone')) for p in leads)}")

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "leads/galabau_hamburg_leads.csv")
