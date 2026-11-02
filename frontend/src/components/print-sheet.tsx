"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { UNIVERSITY_ADDRESS, UNIVERSITY_NAME } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";

interface PrintSheetProps {
  title: string;
  subtitle?: string;
  backHref: string;
  children: React.ReactNode;
}

export function PrintSheet({ title, subtitle, backHref, children }: PrintSheetProps) {
  return (
    <div>
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between print:hidden">
        <Button variant="ghost" asChild>
          <Link href={backHref}>
            <ArrowLeft />
            Back
          </Link>
        </Button>
        <Button onClick={() => window.print()}>
          <Printer />
          Print
        </Button>
      </div>
      <article className="mx-auto max-w-[210mm] rounded-lg border bg-white p-6 text-[13px] shadow-xs sm:p-12 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="border-b-2 border-primary pb-5 text-center">
          <p className="text-xl font-semibold tracking-tight">{UNIVERSITY_NAME}</p>
          <p className="text-muted-foreground">{UNIVERSITY_ADDRESS}</p>
          <p className="mt-4 text-xs font-semibold tracking-[0.2em] text-primary uppercase">{title}</p>
          {subtitle && <p className="mt-1">{subtitle}</p>}
        </header>
        <div className="mt-6 space-y-6">{children}</div>
        <footer className="mt-10 border-t pt-3 text-xs text-muted-foreground">
          Generated {formatDateTime(new Date().toISOString())} from the University Education Management Portal
        </footer>
      </article>
    </div>
  );
}

export function PrintDetails({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex gap-2">
          <dt className="w-28 shrink-0 text-muted-foreground">{item.label}</dt>
          <dd className="font-medium">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SignatureLines({ labels }: { labels: string[] }) {
  return (
    <div className="grid grid-cols-3 gap-8 pt-12">
      {labels.map((label) => (
        <div key={label} className="border-t border-foreground/40 pt-1.5 text-center text-xs text-muted-foreground">
          {label}
        </div>
      ))}
    </div>
  );
}
