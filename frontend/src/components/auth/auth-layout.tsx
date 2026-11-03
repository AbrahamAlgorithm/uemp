import type { LucideIcon } from "lucide-react";
import Image from "next/image";

import { Brand } from "@/components/shell/brand";
import { UNIVERSITY_NAME } from "@/lib/constants";

interface AuthLayoutProps {
  image: { src: string; alt: string };
  headline: string;
  points: { icon: LucideIcon; title: string; description: string }[];
  children: React.ReactNode;
}

export function AuthLayout({ image, headline, points, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen gap-3 bg-background p-3">
      <div className="flex min-h-[calc(100vh-1.5rem)] flex-1 flex-col px-1 py-3 sm:px-8 sm:py-5 xl:px-14">
        <header>
          <Brand />
        </header>
        <main className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[400px]">{children}</div>
        </main>
        <footer className="text-xs text-muted-foreground sm:text-right">
          © {new Date().getFullYear()} {UNIVERSITY_NAME}
        </footer>
      </div>

      <aside className="sticky top-3 hidden h-[calc(100vh-1.5rem)] w-[46%] max-w-[760px] flex-col overflow-hidden rounded-3xl bg-neutral-950 p-3 text-white lg:flex">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl">
          <Image src={image.src} alt={image.alt} fill priority sizes="46vw" className="object-cover" />
        </div>
        <div className="px-6 pt-8 pb-6 xl:px-8">
          <h2 className="text-[28px] leading-tight font-semibold tracking-tight text-balance">{headline}</h2>
          <ul className="mt-6 space-y-4">
            {points.map((point) => (
              <li key={point.title} className="flex gap-3.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <point.icon className="size-[18px]" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-medium">{point.title}</p>
                  <p className="text-sm text-white/60">{point.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

export function AuthHeading({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: React.ReactNode }) {
  return (
    <div>
      <span className="flex size-14 items-center justify-center rounded-2xl bg-muted">
        <Icon className="size-6" aria-hidden />
      </span>
      <h1 className="mt-7 text-[32px] leading-tight font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">{description}</p>
    </div>
  );
}
