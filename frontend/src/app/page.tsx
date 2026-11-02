import Link from "next/link";

import { HealthStatus } from "@/components/health-status";

const areas = [
  { href: "/student", label: "Student" },
  { href: "/lecturer", label: "Lecturer" },
  { href: "/department", label: "Department" },
  { href: "/admin", label: "Admin" },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-10 px-6 py-16">
      <header className="space-y-3">
        <p className="text-sm font-semibold tracking-wide text-indigo-600 uppercase">UEMP</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          University Education Management Portal
        </h1>
      </header>

      <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-4 text-sm font-medium text-slate-500">System status</h2>
        <HealthStatus />
      </section>

      <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
        <Link href="/login" className="text-indigo-600 hover:text-indigo-500">
          Sign in
        </Link>
        {areas.map((area) => (
          <Link key={area.href} href={area.href} className="text-slate-600 hover:text-slate-900">
            {area.label}
          </Link>
        ))}
      </nav>
    </main>
  );
}
