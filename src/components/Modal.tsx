"use client";

import { useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  /** actions rendered in the header, next to the close button */
  actions?: React.ReactNode;
};

export default function Modal({ open, onClose, title, subtitle, children, actions }: Props) {
  // escape to close, and lock the page behind the modal
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      {/* backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/75 backdrop-blur-sm"
      />

      <div
        className="relative flex max-h-full w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl border border-[var(--line-bright)] shadow-2xl"
        style={{ background: "var(--bg)" }}
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--line)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate font-serif text-2xl text-[var(--ink)]">{title}</h2>
            {subtitle && (
              <div className="mt-0.5 truncate font-mono text-[11px] text-[var(--muted)]">{subtitle}</div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-white/10 hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
