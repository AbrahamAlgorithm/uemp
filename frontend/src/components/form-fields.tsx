"use client";

import { useId } from "react";
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";

import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface BaseProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  description?: string;
  className?: string;
}

export interface Option<V extends string | number = string | number> {
  value: V;
  label: string;
}

export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  ...input
}: BaseProps<T> & Pick<React.ComponentProps<"input">, "type" | "placeholder" | "autoComplete" | "inputMode">) {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Input {...field} {...input} id={id} value={field.value ?? ""} aria-invalid={fieldState.invalid} />
          {description && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

export function NumberField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  min,
  max,
}: BaseProps<T> & { min?: number; max?: number }) {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            name={field.name}
            ref={field.ref}
            onBlur={field.onBlur}
            value={field.value ?? ""}
            onChange={(event) => field.onChange(event.target.value === "" ? undefined : event.target.valueAsNumber)}
            aria-invalid={fieldState.invalid}
          />
          {description && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

export function TextareaField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  placeholder,
}: BaseProps<T> & { placeholder?: string }) {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Textarea {...field} id={id} rows={3} placeholder={placeholder} value={field.value ?? ""} aria-invalid={fieldState.invalid} />
          {description && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  options,
  placeholder = "Select",
}: BaseProps<T> & { options: Option[]; placeholder?: string }) {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Select
            name={field.name}
            value={field.value == null ? "" : String(field.value)}
            onValueChange={(value) => field.onChange(options.find((option) => String(option.value) === value)?.value)}
          >
            <SelectTrigger id={id} ref={field.ref} onBlur={field.onBlur} aria-invalid={fieldState.invalid} className="w-full">
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

export function CheckboxGroupField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  options,
}: BaseProps<T> & { options: Option<number>[] }) {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const selected: number[] = field.value ?? [];
        return (
          <FieldSet data-invalid={fieldState.invalid} className={className}>
            <FieldLegend variant="label">{label}</FieldLegend>
            {description && <FieldDescription>{description}</FieldDescription>}
            <div className="grid gap-2 sm:grid-cols-2">
              {options.map((option) => (
                <Field key={option.value} orientation="horizontal">
                  <Checkbox
                    id={`${id}-${option.value}`}
                    checked={selected.includes(option.value)}
                    onCheckedChange={(checked) =>
                      field.onChange(
                        checked ? [...selected, option.value] : selected.filter((value) => value !== option.value),
                      )
                    }
                  />
                  <FieldLabel htmlFor={`${id}-${option.value}`} className="font-normal">
                    {option.label}
                  </FieldLabel>
                </Field>
              ))}
            </div>
            <FieldError errors={[fieldState.error]} />
          </FieldSet>
        );
      }}
    />
  );
}
