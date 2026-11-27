import type { Metadata } from "next";
import { ImportForm } from "@/components/import-form";
import { Card, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";

export const metadata: Metadata = { title: "CSV-Import" };

export default async function ImportPage() {
  await requireSession();
  return (
    <>
      <PageHeader title="Objekte importieren" subtitle="Eine fehlerhafte Zeile bricht den gesamten Import ab – es wird nie nur ein Teil übernommen." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Datei hochladen"><ImportForm /></Card>
        <Card title="Spalten">
          <p className="text-sm text-muted">Pflicht: <code>Titel, Vermarktung, Objektart, Preis, Stadt</code></p>
          <p className="mt-2 text-sm text-muted">
            Optional: <code>Status, Währung, Stadtteil, Adresse, Fläche, Zimmer, Bäder, Etage, Baujahr, Beschreibung</code>
          </p>
          <p className="mt-2 text-sm text-muted">Deutsche, türkische und englische Spaltennamen und Werte (z. B. Kauf / Satılık / sale) werden erkannt.</p>
          <pre className="mt-4 overflow-x-auto rounded-md bg-canvas p-3 text-xs">{`Titel;Vermarktung;Objektart;Preis;Stadt;Fläche;Zimmer
Helle Wohnung am Park;Kauf;Wohnung;250000;Berlin;82;3`}</pre>
        </Card>
      </div>
    </>
  );
}
