"use client";
import { useRule } from "@hyperflux/react";
import type { RuleSource } from "../lib/isolation";

interface Props {
  source: RuleSource;
}

export function ProvenanceBadge({ source }: Props) {
  const hifluxLabel = useRule<string>("hiflux.status.source_hiflux", {});
  const coreLabel = useRule<string>("hiflux.status.source_core", {});
  const legacyLabel = useRule<string>("hiflux.status.source_legacy", {});

  const label =
    source === "hiflux" ? hifluxLabel :
    source === "hyperflux-core" ? coreLabel :
    legacyLabel;

  return <span className={`hf-badge hf-badge-${source}`}>{label}</span>;
}
