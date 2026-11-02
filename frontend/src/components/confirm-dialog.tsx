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

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  reason?: { label: string; placeholder?: string; minLength?: number };
  onConfirm: (reason: string) => Promise<boolean>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  reason,
  onConfirm,
}: ConfirmDialogProps) {
  const id = useId();
  const [text, setText] = useState("");
  const [showError, setShowError] = useState(false);
  const [pending, setPending] = useState(false);

  const minLength = reason?.minLength ?? 10;
  const error = reason && text.trim().length < minLength ? `Write at least ${minLength} characters.` : null;

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
        {reason && (
          <Field data-invalid={showError && !!error}>
            <FieldLabel htmlFor={id}>{reason.label}</FieldLabel>
            <Textarea
              id={id}
              rows={4}
              value={text}
              placeholder={reason.placeholder}
              onChange={(event) => setText(event.target.value)}
              aria-invalid={showError && !!error}
            />
            {showError && error && <FieldError>{error}</FieldError>}
          </Field>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button variant={destructive ? "destructive" : "default"} onClick={confirm} disabled={pending}>
            {pending && <Spinner />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
