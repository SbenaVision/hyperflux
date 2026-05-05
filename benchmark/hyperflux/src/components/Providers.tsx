"use client";
import { useMemo } from "react";
import { HyperFluxProvider } from "@hyperflux/react";
import { createResolver } from "../lib/resolver";

export function Providers({ children }: { children: React.ReactNode }) {
  const resolver = useMemo(() => createResolver(), []);
  return <HyperFluxProvider resolver={resolver}>{children}</HyperFluxProvider>;
}
