"""Erzeugt pro Lead eine statische Vorschau-Webseite unter previews/dist/<slug>/.

Aufruf (aus dem Repo-Wurzelverzeichnis):
    python3 previews/build_previews.py leads/galabau_hamburg_whatsapp.csv
Schreibt ausserdem previews/dist/links.csv mit dem Vorschau-Link je Betrieb.
"""
import base64, csv, html, io, json, os, re, shutil, sys, unicodedata
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
VARIANTEN = ["foto"]  # weitere Vorlagen in templates/: plan, werk, jahr

# Jede Vorschau bekommt eine eigene Kombination aus Farbwelt, Kopffoto und Formsprache (5 x 5 x 2 = 50).
FARBWELTEN = [  # laub (dunkel), farn (Flaeche), dunst (Hintergrund), stein (Linien), trieb (Akzent)
    ("#12281c", "#2f6b45", "#f3f6f1", "#d9ded6", "#d2ea6e"),
    ("#18242b", "#35606e", "#f2f5f6", "#d6dde0", "#f4c95d"),
    ("#2a211b", "#6b4a34", "#f7f4ef", "#e2dbd0", "#9fd17a"),
    ("#261a26", "#6a3d5c", "#f6f3f5", "#e0d8de", "#f2b8a0"),
    ("#0f2630", "#1f6f6b", "#f1f6f5", "#d5e0dd", "#ffd166"),
]
KOPFFOTOS = [
    ("hero1", "Angelegter Garten mit Hecken, Stauden und Natursteinstufen"),
    ("hero2", "Garten mit Rasenfläche, Sitzplatz und blühenden Sträuchern"),
    ("hero3", "Steingarten mit Gräsern, Koniferen und Stauden"),
    ("hero4", "Rosenbeet und Stauden am Rand einer Rasenfläche"),
    ("hero5", "Rasenfläche vor einem modernen Wohnhaus im Abendlicht"),
]
ANLAGE = [("anlage", "Neu angelegter Garten mit geschwungenem Kiesweg und Rasenflächen"),
          ("zaun", "Gartenbeet mit Stauden vor einem Sichtschutzzaun")]
TERRASSE = [("terrasse", "Terrasse mit Sitzplatz, umgeben von Pflanzen"),
            ("pflaster", "Runder Pflasterplatz mit Einfassung aus Granitstelen"),
            ("sitzplatz", "Plattenterrasse mit Sonnenschirm und Sitzgruppe")]

def variation(nr):
    """Eindeutige Gestaltung fuer den Betrieb mit laufender Nummer nr (0..49)."""
    laub, farn, dunst, stein, trieb = FARBWELTEN[nr % 5]
    hero = KOPFFOTOS[(nr // 5 + nr) % 5]
    kantig = (nr // 25) % 2 == 1
    stil = f"--laub:{laub};--farn:{farn};--dunst:{dunst};--stein:{stein};--trieb:{trieb}"
    anlage, terrasse = ANLAGE[nr % 2], TERRASSE[nr % 3]
    return {"body_attribute": f' style="{stil}"' + (' class="kantig"' if kantig else ""),
            "hero_datei": hero[0], "hero_alt": hero[1],
            "anlage_datei": anlage[0], "anlage_alt": anlage[1],
            "terrasse_datei": terrasse[0], "terrasse_alt": terrasse[1]}

def plz(row):
    m = re.search(r"\b(\d{5})\b", row["Adresse"])
    return m.group(1) if m else ""

def render(template, row, cfg, nr=0):
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
            "foto_leiste": f'<a class="leiste" href="{href}">Jetzt anrufen</a>',
        }
    else:
        teile = {"nav_telefon": "", "hero_knopf": '<a class="knopf" href="#kontakt">Kontakt</a>',
                 "kontakt_text": "Hier stehen später Ihre Telefonnummer und ein Kontaktformular.", "kontakt_nummer": "",
                 "werk_ruf": "", "werk_adresse_tel": "", "werk_leiste": "", "foto_leiste": ""}
    werte = {"name": e(row["Name"]), "ort": e(ort(row["Adresse"])), "adresse": e(row["Adresse"]),
             "bewertung": bewertung_block(row), "leistungen": LEISTUNGEN_HTML,
             "h1_klasse": ' class="lang"' if len(row["Name"]) > 24 else "", "absender_name": e(cfg["absender_name"]),
             "absender_kontakt": (", " + e(cfg["absender_telefon"])) if cfg.get("absender_telefon") else "", **teile, **variation(nr)}
    return re.sub(r"\{\{(\w+)\}\}", lambda m: werte[m.group(1)], template)

def main(quelle):
    cfg = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
    lokal = ROOT / "config.local.json"  # eigene Angaben, nicht im Repository
    if lokal.exists():
        cfg.update(json.loads(lokal.read_text(encoding="utf-8")))
    # Beim Bauen auf dem Hosting kommen Absender und Lead-Liste aus Umgebungsvariablen,
    # damit beides nicht im oeffentlichen Repository liegen muss.
    for feld, variable in (("absender_name", "PREVIEW_ABSENDER_NAME"), ("absender_telefon", "PREVIEW_ABSENDER_TELEFON"),
                           ("basis_url", "PREVIEW_BASIS_URL")):
        if variable in os.environ:
            cfg[feld] = os.environ[variable]
    templates = {v: (ROOT / "templates" / f"{v}.html").read_text(encoding="utf-8") for v in VARIANTEN}
    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(ROOT / "assets", DIST / "assets")
    (DIST / "robots.txt").write_text("User-agent: *\nDisallow: /\n")
    if quelle:
        text = open(quelle, encoding="utf-8-sig").read()
    else:
        text = base64.b64decode(os.environ["PREVIEW_LEADS_CSV_B64"]).decode("utf-8-sig")
    rows = list(csv.DictReader(io.StringIO(text), delimiter=";"))
    rows.sort(key=plz)  # Nachbarn (gleiche PLZ) liegen hintereinander und bekommen so verschiedene Farbwelten
    links, benutzt = [], set()
    for nr, row in enumerate(rows):
        variante = VARIANTEN[nr % len(VARIANTEN)]  # reihum, damit nicht jeder Betrieb dieselbe Seite bekommt
        s = slug(row["Name"])
        while s in benutzt:
            s += "-2"
        benutzt.add(s)
        (DIST / s).mkdir()
        (DIST / s / "index.html").write_text(render(templates[variante], row, cfg, nr), encoding="utf-8")
        links.append([row["Name"], row["Telefon"], variante, f'{cfg["basis_url"].rstrip("/")}/{s}/'])
    # Vergleichsseiten: ein Betrieb in mehreren Ausfuehrungen
    for nr in (0, 6, 12, 28, 34):
        (DIST / f"beispiel-{nr}").mkdir()
        (DIST / f"beispiel-{nr}" / "index.html").write_text(render(templates[VARIANTEN[0]], rows[0], cfg, nr), encoding="utf-8")
    with open(DIST / "links.csv", "w", newline="", encoding="utf-8-sig") as f:
        csv.writer(f, delimiter=";").writerows([["Name", "Telefon", "Variante", "Vorschau-Link"], *links])
    print(f"{len(rows)} Vorschauseiten erzeugt in {DIST}")

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
