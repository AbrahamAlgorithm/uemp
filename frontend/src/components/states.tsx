"use client";

import { CircleAlert, Inbox, RotateCcw, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, icon: Icon = Inbox, action }: EmptyStateProps) {
  return (
    <Empty className="py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-accent text-accent-foreground">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <Card>
      <Empty className="py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-red-50 text-red-600">
            <CircleAlert />
          </EmptyMedia>
          <EmptyTitle>Couldn&apos;t load this page</EmptyTitle>
          <EmptyDescription>{errorMessage(error)}</EmptyDescription>
        </EmptyHeader>
        {onRetry && (
          <EmptyContent>
            <Button variant="outline" onClick={onRetry}>
              <RotateCcw />
              Try again
            </Button>
          </EmptyContent>
        )}
      </Empty>
    </Card>
  );
}

export function PageSkeleton({ cards = 0, rows = 6 }: { cards?: number; rows?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {cards > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: cards }, (_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
      )}
      <Card>
        <CardContent className="space-y-3">
          {Array.from({ length: rows }, (_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
