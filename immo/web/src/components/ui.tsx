import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const control =
  "block w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink shadow-xs placeholder:text-muted/70 aria-invalid:border-danger";

export function Field({ label, name, error, hint, children }: {
  label: string; name: string; error?: string; hint?: string; children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium">{label}</label>
      {children}
      {hint && !error ? <p className="text-xs text-muted">{hint}</p> : null}
      {error ? <p id={`${name}-error`} className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

type WithError = { error?: string };

export function Input({ error, name, ...props }: ComponentProps<"input"> & WithError & { name: string }) {
  return (
    <input id={name} name={name} aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${name}-error` : undefined} className={control} {...props} />
  );
}

export function Select({ error, name, children, ...props }: ComponentProps<"select"> & WithError & { name: string }) {
  return (
    // Keyed on the default: React does not re-apply defaultValue to a <select> when it resets the form.
    <select key={String(props.defaultValue ?? "")} id={name} name={name} aria-invalid={error ? true : undefined} className={control} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ error, name, ...props }: ComponentProps<"textarea"> & WithError & { name: string }) {
  return <textarea id={name} name={name} aria-invalid={error ? true : undefined} className={control} {...props} />;
}

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60";
const buttonVariants = {
  primary: "bg-brand text-white hover:bg-brand-strong",
  secondary: "border border-line bg-surface text-ink hover:bg-canvas",
} as const;

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & {
  variant?: keyof typeof buttonVariants;
}) {
  return <button className={`${buttonBase} ${buttonVariants[variant]} ${className}`} {...props} />;
}

export function LinkButton({ variant = "primary", className = "", ...props }: ComponentProps<typeof Link> & {
  variant?: keyof typeof buttonVariants;
}) {
  return <Link className={`${buttonBase} ${buttonVariants[variant]} ${className}`} {...props} />;
}

export function Card({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface">
      {title ? (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </header>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  );
}

const badgeTones = {
  neutral: "bg-canvas text-muted",
  brand: "bg-brand-soft text-brand-strong",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
} as const;

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof badgeTones; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeTones[tone]}`}>
      {children}
    </span>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Alert({ tone = "danger", children }: { tone?: "danger" | "brand" | "warn"; children: ReactNode }) {
  return (
    <p role={tone === "danger" ? "alert" : "status"} className={`rounded-md px-3 py-2 text-sm ${badgeTones[tone]}`}>
      {children}
    </p>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-surface px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {children ? <div className="mt-2 text-sm text-muted">{children}</div> : null}
    </div>
  );
}
