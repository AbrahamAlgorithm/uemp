"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

import { NAVIGATION } from "./navigation";

export function PageSearch({ role }: { role: Role }) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const pages = NAVIGATION[role].flatMap((group) => group.items.map((item) => ({ ...item, group: group.label })));
  const term = query.trim().toLowerCase();
  const results = term
    ? pages.filter((page) => page.label.toLowerCase().includes(term) || page.group?.toLowerCase().includes(term))
    : pages;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(href);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => (results.length ? (index + step + results.length) % results.length : 0));
    } else if (event.key === "Enter" && results[active]) {
      event.preventDefault();
      go(results[active].href);
    } else if (event.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Search pages"
        placeholder="Search pages"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className="h-11 w-full rounded-full border border-input bg-background pr-4 pl-11 text-[15px] outline-none placeholder:text-muted-foreground focus:border-foreground/40 focus:ring-3 focus:ring-ring/15 [&::-webkit-search-cancel-button]:hidden"
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-40 mt-2 max-h-80 overflow-y-auto rounded-2xl border bg-popover p-1.5 shadow-lg"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-muted-foreground">No pages match “{query}”.</li>
          ) : (
            results.map((page, index) => (
              <li
                key={page.href}
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => go(page.href)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm",
                  index === active && "bg-muted",
                )}
              >
                <page.icon className="size-4 text-muted-foreground" aria-hidden />
                <span className="font-medium">{page.label}</span>
                {page.group && <span className="ml-auto text-xs text-muted-foreground">{page.group}</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
