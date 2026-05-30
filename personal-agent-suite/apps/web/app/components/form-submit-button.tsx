"use client";

import { useFormStatus } from "react-dom";

import type { ReactNode } from "react";

export function FormSubmitButton({ children, pendingLabel }: { children: ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-live="polite"
      className="rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-ink transition hover:brightness-110 disabled:cursor-progress disabled:opacity-70"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
