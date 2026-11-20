"""Erzeugt pro Lead eine statische Vorschau-Webseite unter previews/dist/<slug>/.

Aufruf (aus dem Repo-Wurzelverzeichnis):
    python3 previews/build_previews.py leads/galabau_hamburg_whatsapp.csv
Schreibt ausserdem previews/dist/links.csv mit dem Vorschau-Link je Betrieb.
"""
import csv, html, json, re, shutil, sys, unicodedata
from pathlib import Path

ROOT = Path(__file__).parent
DIST = ROOT / "dist"
UMLAUTE = str.maketrans({"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss", "Ä": "ae", "Ö": "oe", "Ü": "ue"})

def slug(name):
    s = unicodedata.normalize("NFKD", name.translate(UMLAUTE)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:50]

def ort(adresse):
    m = re.search(r"\d{5}\s+(.+)$", adresse)
    bezirk = m.group(1).strip() if m else "Hamburg"
    return bezirk if "Hamburg" in bezirk else f"Hamburg-{bezirk}"

def tel_link(telefon):
    return "+49" + re.sub(r"\D", "", telefon)[1:]

def bewertung_block(row):
    try:
        wert, anzahl = float(row["Bewertung"]), int(row["Anzahl Bewertungen"])
    except ValueError:
        return ""
    if wert < 4.0 or anzahl < 3:
        return ""  # nur zeigen, was dem Betrieb hilft und belegt ist
    zahl = f"{wert:.1f}".replace(".", ",")
    return (f'<section class="abschnitt stimme"><div class="breite"><div class="zahl">{zahl}</div>'
            f"<p>von 5 Sternen bei Google, aus {anzahl} Bewertungen Ihrer Kunden. "
            f"Dieser gute Ruf gehört auf Ihre eigene Seite.</p></div></section>")

LEISTUNGEN = [
    ("Gartenpflege", "Rasen mähen, Beete in Ordnung halten, Laub entfernen. Einmalig oder regelmäßig übers ganze Jahr."),
    ("Hecke und Baum", "Formschnitt, Rückschnitt und Fällungen, einschließlich Abtransport des Schnittguts."),
    ("Neuer Rasen", "Rollrasen oder Aussaat, mit Bodenvorbereitung und auf Wunsch Bewässerung."),
    ("Terrasse und Wege", "Pflaster, Platten und Einfassungen, sauber verlegt auf tragfähigem Unterbau."),
    ("Neuanlage", "Planung und Bepflanzung für Gärten, die neu entstehen oder ein neues Gesicht bekommen."),
    ("Zaun und Sichtschutz", "Aufbau und Reparatur von Zäunen, Toren und Sichtschutzelementen."),
]
LEISTUNGEN_HTML = "\n".join(f"        <li><h3>{t}</h3><p>{p}</p></li>" for t, p in LEISTUNGEN)
VARIANTEN = ["plan", "werk", "jahr"]

def render(template, row, cfg):
    e = html.escape
    tel = row["Telefon"].strip()
    if tel:
        href = f'tel:{tel_link(tel)}'
        teile = {
            "nav_telefon": f'<a class="ruf" href="{href}">{e(tel)}</a>',
            "hero_knopf": f'<a class="knopf" href="{href}">Jetzt anrufen</a>',
            "kontakt_text": "Rufen Sie an und schildern Sie kurz, worum es geht. Wir vereinbaren einen Termin vor Ort.",
            "kontakt_nummer": f'<a class="nummer" href="{href}">{e(tel)}</a>',
            "werk_ruf": f'<a class="ruf" href="{href}"><small>Jetzt anrufen</small>{e(tel)}</a>',
            "werk_adresse_tel": f'<br><a href="{href}">{e(tel)}</a>',
            "werk_leiste": f'<a class="leiste" href="{href}">Anrufen: {e(tel)}</a>',
        }
    else:
        teile = {"nav_telefon": "", "hero_knopf": '<a class="knopf" href="#kontakt">Kontakt</a>',
                 "kontakt_text": "Hier stehen später Ihre Telefonnummer und ein Kontaktformular.", "kontakt_nummer": "",
                 "werk_ruf": "", "werk_adresse_tel": "", "werk_leiste": ""}
    werte = {"name": e(row["Name"]), "ort": e(ort(row["Adresse"])), "adresse": e(row["Adresse"]),
             "bewertung": bewertung_block(row), "leistungen": LEISTUNGEN_HTML,
             "h1_klasse": ' class="lang"' if len(row["Name"]) > 24 else "", "absender_name": e(cfg["absender_name"]),
             "absender_telefon": e(cfg["absender_telefon"]), **teile}
    return re.sub(r"\{\{(\w+)\}\}", lambda m: werte[m.group(1)], template)

def main(quelle):
    cfg = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
    templates = {v: (ROOT / "templates" / f"{v}.html").read_text(encoding="utf-8") for v in VARIANTEN}
    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(ROOT / "assets", DIST / "assets")
    (DIST / "robots.txt").write_text("User-agent: *\nDisallow: /\n")
    rows = list(csv.DictReader(open(quelle, encoding="utf-8-sig"), delimiter=";"))
    links, benutzt = [], set()
    for nr, row in enumerate(rows):
        variante = VARIANTEN[nr % len(VARIANTEN)]  # reihum, damit nicht jeder Betrieb dieselbe Seite bekommt
        s = slug(row["Name"])
        while s in benutzt:
            s += "-2"
        benutzt.add(s)
        (DIST / s).mkdir()
        (DIST / s / "index.html").write_text(render(templates[variante], row, cfg), encoding="utf-8")
        links.append([row["Name"], row["Telefon"], variante, f'{cfg["basis_url"].rstrip("/")}/{s}/'])
    # Vergleichsseiten: der erste Betrieb in allen drei Varianten
    for v in VARIANTEN:
        (DIST / f"beispiel-{v}").mkdir()
        (DIST / f"beispiel-{v}" / "index.html").write_text(render(templates[v], rows[0], cfg), encoding="utf-8")
    with open(DIST / "links.csv", "w", newline="", encoding="utf-8-sig") as f:
        csv.writer(f, delimiter=";").writerows([["Name", "Telefon", "Variante", "Vorschau-Link"], *links])
    print(f"{len(rows)} Vorschauseiten erzeugt in {DIST}")

if __name__ == "__main__":
    main(sys.argv[1])
