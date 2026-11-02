"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";

import { cn } from "@/lib/utils";

interface FloatingFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  autoFocus?: boolean;
}

export function FloatingField<T extends FieldValues>({ control, name, label, type = "text", autoComplete, autoFocus }: FloatingFieldProps<T>) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div>
          <div className="relative">
            <input
              {...field}
              value={field.value ?? ""}
              id={id}
              type={isPassword && visible ? "text" : type}
              placeholder=" "
              autoComplete={autoComplete}
              autoFocus={autoFocus}
              autoCapitalize="off"
              spellCheck={false}
              aria-invalid={fieldState.invalid}
              aria-describedby={fieldState.error ? `${id}-error` : undefined}
              className={cn(
                "peer h-14 w-full rounded-lg border border-input bg-background px-4 pt-5 pb-1.5 text-[15px] transition-[border-color,box-shadow] outline-none focus:border-foreground focus:ring-1 focus:ring-foreground aria-invalid:border-destructive aria-invalid:ring-destructive aria-invalid:focus:ring-1",
                isPassword && "pr-12",
              )}
            />
            <label
              htmlFor={id}
              className="pointer-events-none absolute top-2.5 left-4 text-xs text-muted-foreground transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-[15px] peer-focus:top-2.5 peer-focus:translate-y-0 peer-focus:text-xs peer-aria-invalid:text-destructive"
            >
              {label}
            </label>
            {isPassword && (
              <button
                type="button"
                onClick={() => setVisible((value) => !value)}
                aria-label={visible ? "Hide password" : "Show password"}
                aria-pressed={visible}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {visible ? <Eye className="size-5" /> : <EyeOff className="size-5" />}
              </button>
            )}
          </div>
          {fieldState.error && (
            <p id={`${id}-error`} className="mt-1.5 px-1 text-xs text-destructive">
              {fieldState.error.message}
            </p>
          )}
        </div>
      )}
    />
  );
}
