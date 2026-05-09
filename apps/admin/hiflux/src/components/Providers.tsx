"use client";
import { useState, useEffect, useCallback, createContext, useContext, useRef } from "react";
import { HyperFluxProvider } from "@hyperflux/react";
import { createResolver } from "../lib/resolver";
import {
  Resolver,
  FunctionRegistry,
  OperatorRegistryImpl,
  RuleStoreImpl,
  DependencyGraphImpl,
} from "@hyperflux/core/client";
import type { DomainFile, OperatorDefinition } from "@hyperflux/core/client";

const OPERATORS: OperatorDefinition[] = [
  { op: ">",          arity: 2, input_types: ["number", "number"], output_type: "boolean" },
  { op: ">=",         arity: 2, input_types: ["number", "number"], output_type: "boolean" },
  { op: "<",          arity: 2, input_types: ["number", "number"], output_type: "boolean" },
  { op: "<=",         arity: 2, input_types: ["number", "number"], output_type: "boolean" },
  { op: "==",         arity: 2, input_types: ["any",    "any"],    output_type: "boolean" },
  { op: "!=",         arity: 2, input_types: ["any",    "any"],    output_type: "boolean" },
  { op: "AND",        arity: 2, input_types: ["boolean","boolean"],output_type: "boolean" },
  { op: "OR",         arity: 2, input_types: ["boolean","boolean"],output_type: "boolean" },
  { op: "NOT",        arity: 1, input_types: ["boolean"],          output_type: "boolean" },
  { op: "+",          arity: 2, input_types: ["number", "number"], output_type: "number"  },
  { op: "-",          arity: 2, input_types: ["number", "number"], output_type: "number"  },
  { op: "startsWith", arity: 2, input_types: ["string", "string"], output_type: "boolean" },
  { op: "endsWith",   arity: 2, input_types: ["string", "string"], output_type: "boolean" },
  { op: "includes",   arity: 2, input_types: ["any",    "any"],    output_type: "boolean" },
  { op: "length",     arity: 1, input_types: ["any"],              output_type: "number"  },
  { op: "concat",     arity: 2, input_types: ["string", "string"], output_type: "string"  },
];

function buildResolver(domainFiles: DomainFile[]): Resolver {
  const allRules = domainFiles.flatMap((df) => df.rules);
  const deps = new Map(allRules.map((r) => [r.path, r.metadata.requires as string[]]));
  const topo = allRules.map((r) => r.path);
  const graph = new DependencyGraphImpl(deps, topo);
  const store = new RuleStoreImpl(allRules, domainFiles, graph);
  return new Resolver({
    ruleStore: store,
    functionRegistry: new FunctionRegistry(),
    operatorRegistry: new OperatorRegistryImpl(OPERATORS),
  });
}

const RefreshContext = createContext<() => Promise<void>>(async () => {});
export const useResolverRefresh = () => useContext(RefreshContext);

export function Providers({ children }: { children: React.ReactNode }) {
  // Static resolver for first render (no flash on load)
  const [resolver, setResolver] = useState<Resolver>(() => createResolver());
  const fetchingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const res = await fetch("/api/domain-files");
      if (!res.ok) return;
      const domainFiles = (await res.json()) as DomainFile[];
      setResolver(buildResolver(domainFiles));
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  // Sync with server store on mount (picks up any runtime overrides)
  useEffect(() => { refresh(); }, [refresh]);

  return (
    <RefreshContext.Provider value={refresh}>
      <HyperFluxProvider resolver={resolver}>{children}</HyperFluxProvider>
    </RefreshContext.Provider>
  );
}
