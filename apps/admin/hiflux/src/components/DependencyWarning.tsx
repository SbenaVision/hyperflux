"use client";
import { useRule } from "@hyperflux/react";

interface Props {
  dependents: string[];
}

export function DependencyWarning({ dependents }: Props) {
  const warning = useRule<string>("hiflux.messages.delete_warning", {});

  if (dependents.length === 0) return null;

  return (
    <div className="hf-dep-warning" role="alert">
      <span className="hf-dep-warning-text">{warning}</span>
      <ul className="hf-dep-list">
        {dependents.map((d) => (
          <li key={d} className="hf-dep-item">{d}</li>
        ))}
      </ul>
    </div>
  );
}
