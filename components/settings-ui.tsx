import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

/* ── Row — IG settings list row ─────────────────────────────────────
   Full-width, hairline-separated, chevron on navigable rows.          */

export function Row({
  href,
  icon,
  label,
  sub,
  right,
  danger,
  external,
  onClick,
}: {
  href?: string;
  icon?: ReactNode;
  label: string;
  sub?: string;
  right?: ReactNode;
  danger?: boolean;
  external?: boolean;
  onClick?: () => void;
}) {
  const inner = (
    <>
      {icon ? <span className="shrink-0 text-fg">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span
          className={`block text-[15px] leading-snug ${
            danger ? "text-danger" : "text-fg"
          }`}
        >
          {label}
        </span>
        {sub ? (
          <span className="mt-1 block text-[13px] leading-snug text-muted">
            {sub}
          </span>
        ) : null}
      </span>
      {right ? (
        <span className="shrink-0 text-[14px] text-muted">{right}</span>
      ) : null}
      {href ? <ChevronRight className="size-4 shrink-0 text-muted" /> : null}
    </>
  );
  const cls =
    "flex w-full items-center gap-4 px-6 py-5 text-left transition-colors hover:bg-hover/60";
  if (href) {
    return external ? (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {inner}
      </a>
    ) : (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return onClick ? (
    <button onClick={onClick} className={cls}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
