"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useAsync<T>(load: () => Promise<T>, key: unknown = null) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<unknown>(null);
  const [version, setVersion] = useState(0);
  const loadRef = useRef(load);

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    let cancelled = false;
    setError(null);
    loadRef.current().then(
      (value) => {
        if (!cancelled) setData(value);
      },
      (reason: unknown) => {
        if (!cancelled) setError(reason);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  return { data, error, reload, setData };
}
