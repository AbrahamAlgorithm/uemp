import type { LucideIcon } from "lucide-react";
import Image from "next/image";

import { Brand } from "@/components/shell/brand";

interface AuthLayoutProps {
  image: { src: string; alt: string };
  headline: string;
  points: { icon: LucideIcon; title: string; description: string }[];
  children: React.ReactNode;
}

export function AuthLayout({ image, children }: AuthLayoutProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-neutral-950 px-4 py-8 font-manrope sm:px-6">
      <Image src={image.src} alt="" fill priority sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 bg-[rgba(131,132,136,0.68)]" aria-hidden="true" />
      <section className="relative z-10 w-full max-w-[440px] overflow-hidden rounded-md bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-6 pb-3 pt-5 sm:px-8">
          <Brand className="justify-center" vertical />
        </div>
        <div className="px-6 pb-7 pt-4 sm:px-8 sm:pb-8 sm:pt-5">{children}</div>
      </section>
    </main>
  );
}

export function AuthHeading({ title, description }: { title: string; description?: React.ReactNode }) {
  return (
    <div className="text-center">
      <h1 className="text-[28px] leading-[36px] font-medium tracking-[-0.56px] text-slate-900">{title}</h1>
      {description && <p className="mt-2 text-[15px] text-muted-foreground">{description}</p>}
    </div>
  );
}
