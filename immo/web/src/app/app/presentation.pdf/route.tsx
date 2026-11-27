import { audit } from "@/lib/audit";
import { requireSession } from "@/lib/auth";
import { getContact } from "@/lib/data/contacts";
import { getPropertiesByIds } from "@/lib/data/properties";
import { NotFoundError } from "@/lib/errors";
import { isUuid } from "@/lib/params";
import { PresentationDocument } from "@/lib/pdf/documents";
import { MAX_PRESENTATION_ITEMS } from "@/lib/pdf/limits";
import { pdfContext, pdfResponse } from "@/lib/pdf/respond";

export async function GET(request: Request): Promise<Response> {
  const session = await requireSession();
  const params = new URL(request.url).searchParams;
  const ids = [...new Set(params.getAll("ids").filter(isUuid))];
  if (ids.length === 0 || ids.length > MAX_PRESENTATION_ITEMS) return new Response(null, { status: 400 });

  const recipientId = params.get("for");
  let recipient: string | null = null;
  if (recipientId) {
    if (!isUuid(recipientId)) return new Response(null, { status: 400 });
    try {
      recipient = (await getContact(session, recipientId)).fullName;
    } catch (error) {
      if (error instanceof NotFoundError) return new Response(null, { status: 404 });
      throw error;
    }
  }

  const properties = await getPropertiesByIds(session, ids);
  if (properties.length === 0) return new Response(null, { status: 404 });

  await audit(session, "export", "presentation", recipientId, { properties: properties.map((p) => p.id) });
  const ctx = await pdfContext(session);
  return pdfResponse(<PresentationDocument ctx={ctx} properties={properties} recipient={recipient} />, "sunum.pdf");
}
