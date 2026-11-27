import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { getI18n } from "@/i18n/server";
import type { Session } from "@/lib/auth";
import type { PdfContext } from "./documents";

export async function pdfContext(session: Session): Promise<PdfContext> {
  const { m, f, locale } = await getI18n();
  return {
    m,
    f,
    orgName: session.orgName,
    agent: { fullName: session.fullName, phone: session.phone, email: session.email },
    generatedAt: new Date(),
    upper: (text) => text.toLocaleUpperCase(locale),
  };
}

export async function pdfResponse(document: ReactElement, filename: string): Promise<Response> {
  const buffer = await renderToBuffer(document as Parameters<typeof renderToBuffer>[0]);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      // Customer documents must never sit in a shared cache.
      "Cache-Control": "private, no-store",
    },
  });
}
