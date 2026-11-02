"use client";

import { useRef } from "react";

import { cn } from "@/lib/utils";

interface CodeInputProps {
  digits: string[];
  onChange: (digits: string[]) => void;
  invalid?: boolean;
  disabled?: boolean;
}

export function CodeInput({ digits, onChange, invalid, disabled }: CodeInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const focus = (index: number) => refs.current[Math.max(0, Math.min(index, digits.length - 1))]?.focus();

  const fill = (from: number, value: string) => {
    const next = [...digits];
    const typed = value.replace(/\D/g, "").slice(0, digits.length - from).split("");
    typed.forEach((digit, offset) => (next[from + offset] = digit));
    onChange(next);
    focus(from + typed.length);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      const next = [...digits];
      next[index - 1] = "";
      onChange(next);
      focus(index - 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focus(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      focus(index + 1);
    }
  };

  return (
    <div role="group" aria-label="Verification code" className="flex gap-2 sm:gap-2.5">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            refs.current[index] = element;
          }}
          value={digit}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          autoFocus={index === 0}
          disabled={disabled}
          aria-label={`Digit ${index + 1}`}
          aria-invalid={invalid}
          onFocus={(event) => event.target.select()}
          onKeyDown={(event) => onKeyDown(event, index)}
          onPaste={(event) => {
            event.preventDefault();
            fill(0, event.clipboardData.getData("text"));
          }}
          onChange={(event) => {
            const value = event.target.value.replace(/\D/g, "");
            if (!value) {
              const next = [...digits];
              next[index] = "";
              onChange(next);
            } else {
              fill(index, digit && value.length > 1 ? value.replace(digit, "") : value);
            }
          }}
          className={cn(
            "aspect-square w-full min-w-0 rounded-xl border border-input bg-background text-center text-2xl font-medium tabular-nums transition-[border-color,box-shadow] outline-none focus:border-foreground focus:ring-3 focus:ring-ring/20 disabled:opacity-50",
            invalid && "border-destructive focus:border-destructive focus:ring-destructive/20",
          )}
        />
      ))}
    </div>
  );
}
