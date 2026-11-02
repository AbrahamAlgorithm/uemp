import { SearchX } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-accent text-accent-foreground">
            <SearchX />
          </EmptyMedia>
          <p className="text-sm font-medium text-primary">404</p>
          <EmptyTitle className="text-xl">Page not found</EmptyTitle>
          <EmptyDescription>The page you&apos;re looking for doesn&apos;t exist or has moved.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/">Back to the portal</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
