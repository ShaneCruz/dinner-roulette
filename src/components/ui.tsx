import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { twMerge } from "tailwind-merge";

/** Joins classes; later Tailwind classes override earlier conflicting ones. */
export function cx(...classes: (string | false | null | undefined)[]) {
  return twMerge(classes.filter(Boolean).join(" "));
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const buttonVariants: Record<Variant, string> = {
  primary: "bg-tomato text-white shadow-sm hover:bg-tomato-strong active:scale-[0.98]",
  secondary:
    "border border-border bg-surface text-foreground hover:bg-surface-muted active:scale-[0.98]",
  ghost: "text-foreground hover:bg-surface-muted",
  danger: "border border-tomato/40 bg-surface text-tomato hover:bg-tomato-soft",
};

const buttonSizes = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-base",
  lg: "h-14 px-7 text-lg",
};

type ButtonStyle = { variant?: Variant; size?: keyof typeof buttonSizes };

export function buttonClass({ variant = "primary", size = "md" }: ButtonStyle = {}) {
  return cx(buttonBase, buttonVariants[variant], buttonSizes[size]);
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"button"> & ButtonStyle) {
  return <button className={cx(buttonClass({ variant, size }), className)} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & ButtonStyle) {
  return <Link className={cx(buttonClass({ variant, size }), className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cx("rounded-3xl border border-border bg-surface p-5 shadow-sm", className)}
      {...props}
    />
  );
}

const badgeTones = {
  neutral: "bg-surface-muted text-muted",
  tomato: "bg-tomato-soft text-tomato-strong",
  mustard: "bg-mustard-soft text-foreground",
  basil: "bg-basil-soft text-basil",
  plum: "bg-plum-soft text-plum",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: keyof typeof badgeTones }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        badgeTones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="no-print flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Avatar({
  emoji,
  color,
  size = "md",
  className,
}: {
  emoji: string;
  color: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizes = {
    sm: "h-8 w-8 text-lg",
    md: "h-11 w-11 text-2xl",
    lg: "h-16 w-16 text-4xl",
    xl: "h-24 w-24 text-6xl",
  };
  return (
    <span
      aria-hidden
      className={cx("inline-flex shrink-0 items-center justify-center rounded-full", sizes[size], className)}
      style={{ backgroundColor: color }}
    >
      {emoji}
    </span>
  );
}

export const inputClass =
  "w-full rounded-2xl border border-border bg-surface px-4 py-2.5 text-base text-foreground placeholder:text-muted/70 focus:border-tomato focus:outline-none focus:ring-4 focus:ring-ring";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function SpiceMeter({ level, className }: { level: number; className?: string }) {
  const labels = ["No heat", "Mild", "Medium", "Hot"];
  if (level === 0) {
    return <span className={cx("text-xs font-semibold text-muted", className)}>🧊 No heat</span>;
  }
  return (
    <span className={cx("inline-flex items-center gap-0.5", className)} title={labels[level]}>
      {[1, 2, 3].map((n) => (
        <span key={n} className={n <= level ? "" : "opacity-20 grayscale"} aria-hidden>
          🌶️
        </span>
      ))}
      <span className="sr-only">{labels[level]}</span>
    </span>
  );
}
