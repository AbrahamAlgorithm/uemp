import Link from "next/link";

export function ComingSoon({ title }: { title: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6 py-16">
      <p className="text-sm font-semibold tracking-wide text-indigo-600 uppercase">UEMP</p>
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
      <p className="text-slate-600">Coming soon.</p>
      <Link href="/" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
        &larr; Back to home
      </Link>
    </main>
  );
}
