import { cn } from "@/lib/utils";

export interface Detail {
  label: string;
  value: React.ReactNode;
}

export function DetailList({ items, className }: { items: Detail[]; className?: string }) {
  return (
    <dl className={cn("grid gap-x-8 gap-y-4 sm:grid-cols-2", className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="mt-0.5 text-sm font-medium break-words">{item.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
