import { audit } from "@/lib/audit";
import { requireSession } from "@/lib/auth";
import { getComparables, getProperty, valueProperty } from "@/lib/data/properties";
import { NotFoundError } from "@/lib/errors";
import { isUuid } from "@/lib/params";
import { MarketReportDocument } from "@/lib/pdf/documents";
import { pdfContext, pdfResponse } from "@/lib/pdf/respond";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await requireSession();
  const { id } = await params;
  if (!isUuid(id)) return new Response(null, { status: 404 });

  let property;
  try {
    ({ property } = await getProperty(session, id));
  } catch (error) {
    if (error instanceof NotFoundError) return new Response(null, { status: 404 });
    throw error;
  }
  const valuation = await valueProperty(session, property);
  const comparables = valuation.ok ? await getComparables(session, valuation.comparableIds) : [];

  await audit(session, "export", "market_report", id);
  const ctx = await pdfContext(session);
  return pdfResponse(
    <MarketReportDocument ctx={ctx} property={property} valuation={valuation} comparables={comparables} />,
    "pazar-analizi.pdf",
  );
}
