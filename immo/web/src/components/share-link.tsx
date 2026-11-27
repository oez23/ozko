"use client";

import { useActionState } from "react";
import { createShareLink } from "@/app/actions/matches";
import { useI18n } from "@/i18n/client";
import { Alert } from "./ui";

export function ShareLinkButton({ contactId, propertyIds }: { contactId: string; propertyIds: string[] }) {
  const { m } = useI18n();
  const [state, action, pending] = useActionState(createShareLink.bind(null, contactId, propertyIds), undefined);
  return (
    <form action={action} className="flex flex-col gap-2">
      <div>
        <button type="submit" disabled={pending} className="text-sm font-medium text-brand underline disabled:opacity-60">
          {pending ? m.share.creating : m.share.create}
        </button>
      </div>
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.url ? (
        <div role="status" className="rounded-md bg-brand-soft p-3 text-sm">
          <p className="text-brand-strong">{m.share.created}</p>
          <input readOnly value={state.url} aria-label={m.share.create} onFocus={(event) => event.currentTarget.select()}
            className="mt-2 block w-full rounded-md border border-line bg-surface px-2 py-1.5 font-mono text-xs" />
          {state.whatsapp ? (
            <a href={state.whatsapp} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-medium text-brand underline">
              {m.share.whatsapp}
            </a>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
