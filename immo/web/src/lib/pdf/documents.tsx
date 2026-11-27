import "server-only";
import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Valuation } from "@immo/core";
import { fill, type Formatters, type Messages } from "@/i18n";
import type { Property } from "@/lib/data/properties";

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
Font.register({
  family: "Inter",
  fonts: [
    { src: path.join(FONT_DIR, "Inter-Regular.otf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "Inter-SemiBold.otf"), fontWeight: 600 },
  ],
});
// The built-in hyphenation is English-only and splits Turkish words in the wrong places.
Font.registerHyphenationCallback((word) => [word]);

const COLOR = { ink: "#17201d", muted: "#5f6b66", line: "#dfe4e1", brand: "#0f5c4a", soft: "#e3f0ec" };

const s = StyleSheet.create({
  // No lineHeight anywhere in this file: on the page style react-pdf silently drops the `fixed`
  // footer, and on a single <Text> it roughly doubles the spacing. The font's own metrics read well.
  page: { fontFamily: "Inter", fontSize: 10, color: COLOR.ink, paddingTop: 44, paddingBottom: 60, paddingHorizontal: 44 },
  bar: { height: 5, backgroundColor: COLOR.brand, marginBottom: 22 },
  eyebrow: { fontSize: 9, color: COLOR.brand, fontWeight: 600, letterSpacing: 1 },
  h1: { fontSize: 24, fontWeight: 600, marginTop: 6 },
  lead: { fontSize: 12, color: COLOR.muted, marginTop: 8 },
  h2: { fontSize: 13, fontWeight: 600, marginTop: 22, marginBottom: 8 },
  muted: { color: COLOR.muted },
  bold: { fontWeight: 600 },
  card: { borderWidth: 1, borderColor: COLOR.line, borderRadius: 6, padding: 14, marginTop: 12 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  cardTitle: { fontSize: 13, fontWeight: 600, flex: 1 },
  price: { fontSize: 13, fontWeight: 600, color: COLOR.brand },
  facts: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  fact: { width: "25%", marginBottom: 8, paddingRight: 8, gap: 2 },
  factLabel: { fontSize: 8, color: COLOR.muted },
  factValue: { fontSize: 10, fontWeight: 600 },
  highlight: { backgroundColor: COLOR.soft, borderRadius: 6, padding: 16, marginTop: 6 },
  big: { fontSize: 22, fontWeight: 600, color: COLOR.brand },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLOR.line, paddingVertical: 5 },
  th: { fontSize: 8, color: COLOR.muted, fontWeight: 600 },
  right: { textAlign: "right" },
  small: { fontSize: 8, color: COLOR.muted, marginTop: 14 },
  footer: { position: "absolute", left: 44, right: 44, bottom: 24, borderTopWidth: 1, borderTopColor: COLOR.line, paddingTop: 8, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: COLOR.muted },
});

export type PdfContext = {
  m: Messages;
  f: Formatters;
  orgName: string;
  agent: { fullName: string; phone: string | null; email: string };
  generatedAt: Date;
  /** Locale-aware upper-casing: a generic transform turns the Turkish "i" into "I" instead of "İ". */
  upper: (text: string) => string;
};

function Footer({ ctx }: { ctx: PdfContext }) {
  const contact = [ctx.orgName, ctx.agent.fullName, ctx.agent.phone, ctx.agent.email].filter(Boolean).join("  ·  ");
  return (
    <View style={s.footer} fixed>
      <Text>{contact}</Text>
      <Text render={({ pageNumber, totalPages }) => fill(ctx.m.pdf.page, { page: pageNumber, pages: totalPages })} />
    </View>
  );
}

function Header({ ctx, title, lead }: { ctx: PdfContext; title: string; lead?: string }) {
  return (
    <View>
      <View style={s.bar} />
      <Text style={s.eyebrow}>{ctx.upper(ctx.orgName)}</Text>
      <Text style={s.h1}>{title}</Text>
      {lead ? <Text style={s.lead}>{lead}</Text> : null}
      <Text style={[s.muted, { marginTop: 10 }]}>
        {ctx.m.pdf.preparedBy}: {ctx.agent.fullName}  ·  {ctx.m.pdf.date}: {ctx.f.date(ctx.generatedAt)}
      </Text>
    </View>
  );
}

/** Customer-facing facts only: the street address and the owner never leave the office. */
function propertyFacts(p: Property, { m, f }: PdfContext): [string, string][] {
  const t = m.property;
  const facts: [string, string | null][] = [
    [t.propertyType, m.enums.propertyType[p.propertyType]],
    [t.dealType, m.enums.dealType[p.dealType]],
    [t.location, [p.city, p.district].filter(Boolean).join(", ")],
    [t.area, p.areaSqm != null ? f.area(p.areaSqm) : null],
    [t.roomsDisplay, p.rooms != null ? f.rooms(p.rooms, p.livingRooms) : null],
    [t.bathrooms, p.bathrooms != null ? String(p.bathrooms) : null],
    [t.floor, p.floor != null ? String(p.floor) : null],
    [t.yearBuilt, p.yearBuilt != null ? String(p.yearBuilt) : null],
    [m.pdf.pricePerSqm, p.areaSqm ? f.price(Math.round(p.price / p.areaSqm), p.currency) : null],
  ];
  return facts.filter((fact): fact is [string, string] => fact[1] !== null);
}

function Facts({ facts }: { facts: [string, string][] }) {
  return (
    <View style={s.facts}>
      {facts.map(([label, value]) => (
        <View key={label} style={s.fact}>
          <Text style={s.factLabel}>{label}</Text>
          <Text style={s.factValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

const DESCRIPTION_LIMIT = 700;
const clip = (text: string) => (text.length > DESCRIPTION_LIMIT ? `${text.slice(0, DESCRIPTION_LIMIT).trimEnd()}…` : text);

export function PresentationDocument({ ctx, properties, recipient }: {
  ctx: PdfContext; properties: Property[]; recipient: string | null;
}) {
  const { m, f } = ctx;
  return (
    <Document title={m.pdf.presentationTitle} author={ctx.agent.fullName} creator={m.brand} producer={m.brand}>
      <Page size="A4" style={s.page}>
        <Header ctx={ctx} title={m.pdf.presentationTitle}
          lead={recipient ? fill(m.pdf.preparedFor, { name: recipient }) : undefined} />
        {properties.map((p, index) => (
          <View key={p.id} style={s.card} wrap={false}>
            <View style={s.cardHead}>
              <Text style={s.cardTitle}>{index + 1}. {p.title}</Text>
              <Text style={s.price}>{f.price(p.price, p.currency)}</Text>
            </View>
            <Facts facts={propertyFacts(p, ctx)} />
            {p.description ? <Text style={{ marginTop: 2 }}>{clip(p.description)}</Text> : null}
          </View>
        ))}
        <Footer ctx={ctx} />
      </Page>
    </Document>
  );
}

export type ReportComparable = {
  id: string; title: string; district: string | null; price: number; areaSqm: number | null; status: Property["status"];
};

export function MarketReportDocument({ ctx, property: p, valuation, comparables }: {
  ctx: PdfContext; property: Property; valuation: Valuation; comparables: ReportComparable[];
}) {
  const { m, f } = ctx;
  const t = m.pdf;
  const widths = ["40%", "14%", "18%", "16%", "12%"] as const;
  const delta = valuation.ok ? Math.round(((p.price - valuation.estimate.mid) / valuation.estimate.mid) * 100) : 0;
  return (
    <Document title={`${t.reportTitle} – ${p.title}`} author={ctx.agent.fullName} creator={m.brand} producer={m.brand}>
      <Page size="A4" style={s.page}>
        <Header ctx={ctx} title={t.reportTitle} lead={p.title} />

        <Text style={s.h2}>{t.subject}</Text>
        <Facts facts={[[t.askingPrice, f.price(p.price, p.currency)], ...propertyFacts(p, ctx)]} />

        <Text style={s.h2}>{t.estimate}</Text>
        {valuation.ok ? (
          <View style={s.highlight}>
            <Text style={s.big}>{f.price(valuation.estimate.mid, p.currency)}</Text>
            <Text style={{ marginTop: 4 }}>
              {t.range}: {f.price(valuation.estimate.low, p.currency)} – {f.price(valuation.estimate.high, p.currency)}
            </Text>
            <Facts facts={[
              [t.medianPerSqm, f.price(valuation.pricePerSqm.median, p.currency)],
              [t.comparablesUsed, String(valuation.comparablesUsed)],
              [t.confidence, m.enums.confidence[valuation.confidence]],
            ]} />
            {delta !== 0 ? (
              <Text>{fill(t.vsAsking, { pct: Math.abs(delta), direction: delta > 0 ? t.above : t.below })}</Text>
            ) : null}
          </View>
        ) : (
          <View style={s.highlight}>
            <Text>{valuation.reason === "missing_area" ? m.property.valuationMissingArea : t.noEstimate}</Text>
          </View>
        )}

        {comparables.length > 0 ? (
          <View>
            <Text style={s.h2}>{t.comparables}</Text>
            <View style={s.row}>
              <Text style={[s.th, { width: widths[0] }]}>{t.colTitle}</Text>
              <Text style={[s.th, s.right, { width: widths[1] }]}>{t.colArea}</Text>
              <Text style={[s.th, s.right, { width: widths[2] }]}>{t.colPrice}</Text>
              <Text style={[s.th, s.right, { width: widths[3] }]}>{t.colPerSqm}</Text>
              <Text style={[s.th, s.right, { width: widths[4] }]}>{t.colStatus}</Text>
            </View>
            {comparables.map((c) => (
              <View key={c.id} style={s.row} wrap={false}>
                <View style={{ width: widths[0], paddingRight: 8 }}>
                  <Text>{c.title}</Text>
                  {c.district ? <Text style={[s.muted, { fontSize: 8 }]}>{c.district}</Text> : null}
                </View>
                <Text style={[s.right, { width: widths[1] }]}>{f.area(c.areaSqm)}</Text>
                <Text style={[s.right, { width: widths[2] }]}>{f.price(c.price, p.currency)}</Text>
                <Text style={[s.right, { width: widths[3] }]}>
                  {c.areaSqm ? f.price(Math.round(c.price / c.areaSqm), p.currency) : "–"}
                </Text>
                <Text style={[s.right, { width: widths[4] }]}>{m.enums.status[c.status]}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View wrap={false}>
          <Text style={s.h2}>{t.method}</Text>
          <Text>{t.methodText}</Text>
          <Text style={s.small}>{t.disclaimer}</Text>
        </View>
        <Footer ctx={ctx} />
      </Page>
    </Document>
  );
}
