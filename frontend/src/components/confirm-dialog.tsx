"use client";

import { useId, useState } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { REASON_MAX_LENGTH } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  reason?: { label: string; placeholder?: string; minLength?: number };
  confirmDisabled?: boolean;
  onConfirm: (reason: string) => Promise<boolean>;
  children?: React.ReactNode;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  reason,
  confirmDisabled,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const id = useId();
  const [text, setText] = useState("");
  const [showError, setShowError] = useState(false);
  const [pending, setPending] = useState(false);

  const minLength = reason?.minLength ?? 10;
  const length = text.trim().length;
  const error = !reason
    ? null
    : length < minLength
      ? `Write at least ${minLength} characters.`
      : length > REASON_MAX_LENGTH
        ? `Keep it to ${REASON_MAX_LENGTH} characters or fewer.`
        : null;

  const close = (next: boolean) => {
    if (pending) return;
    if (!next) {
      setText("");
      setShowError(false);
    }
    onOpenChange(next);
  };

  const confirm = async () => {
    if (error) {
      setShowError(true);
      return;
    }
    setPending(true);
    const done = await onConfirm(text.trim());
    setPending(false);
    if (done) {
      setText("");
      setShowError(false);
      onOpenChange(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={close}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        {reason && (
          <Field data-invalid={showError && !!error}>
            <FieldLabel htmlFor={id}>{reason.label}</FieldLabel>
            <Textarea
              id={id}
              rows={4}
              className="max-h-56 max-w-full overflow-y-auto wrap-anywhere"
              value={text}
              placeholder={reason.placeholder}
              onChange={(event) => setText(event.target.value)}
              aria-invalid={showError && !!error}
            />
            <div className="flex items-start justify-between gap-3">
              {showError && error ? <FieldError>{error}</FieldError> : <span />}
              <span
                className={cn("shrink-0 text-xs text-muted-foreground tabular-nums", length > REASON_MAX_LENGTH && "text-destructive")}
                aria-live="polite"
              >
                {length}/{REASON_MAX_LENGTH}
              </span>
            </div>
          </Field>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button variant={destructive ? "destructive" : "default"} onClick={confirm} disabled={pending || confirmDisabled}>
            {pending && <Spinner />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
