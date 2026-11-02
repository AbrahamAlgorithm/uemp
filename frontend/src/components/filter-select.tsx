"use client";

import type { Option } from "@/components/form-fields";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  allLabel: string;
}

export function FilterSelect({ label, value, onChange, options, allLabel }: FilterSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="w-full rounded-full pl-4 data-[size=default]:h-10 sm:w-auto sm:min-w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={String(option.value)}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export const matches = (filter: string, value: string | number) => filter === "all" || filter === String(value);
