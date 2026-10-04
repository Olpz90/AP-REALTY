import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-slate-900">{value}</div>
      {hint && <div className="mt-1 text-sm text-slate-500">{hint}</div>}
    </Card>
  );
}

const tones = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  red: "bg-rose-50 text-rose-700 ring-rose-200",
} as const;

export type Tone = keyof typeof tones;

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function ProgressBar({ percent, marker, label }: { percent: number; marker?: number; label: string }) {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  return (
    <div className="relative h-2.5 w-full rounded-full bg-slate-100" role="progressbar" aria-label={label} aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-2.5 rounded-full bg-amber-500" style={{ width: `${clamp(percent)}%` }} />
      {marker != null && (
        <div className="absolute -top-1 h-4.5 w-0.5 bg-slate-700" style={{ left: `${clamp(marker)}%`, height: "18px" }} title="Projected" />
      )}
    </div>
  );
}

export function SubmitButton({ children, tone = "dark" }: { children: ReactNode; tone?: "dark" | "light" | "danger" }) {
  const styles = {
    dark: "bg-slate-900 text-white hover:bg-slate-700",
    light: "bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50",
    danger: "bg-white text-rose-700 ring-1 ring-inset ring-rose-300 hover:bg-rose-50",
  };
  return (
    <button type="submit" className={`rounded-md px-3 py-1.5 text-xs font-semibold shadow-sm ${styles[tone]}`}>
      {children}
    </button>
  );
}
