"use client";
import { useRule } from "@hyperflux/react";

export type CaptionSize = "S" | "M" | "L";

interface Props {
  current: CaptionSize;
  onChange: (size: CaptionSize) => void;
}

export function CaptionSizeSelector({ current, onChange }: Props) {
  const label = useRule<string>("hiflux.ui.caption_size_label", {});
  const labelS = useRule<string>("hiflux.captions.label_s", {});
  const labelM = useRule<string>("hiflux.captions.label_m", {});
  const labelL = useRule<string>("hiflux.captions.label_l", {});

  const sizes: { key: CaptionSize; label: string }[] = [
    { key: "S", label: labelS },
    { key: "M", label: labelM },
    { key: "L", label: labelL },
  ];

  return (
    <div className="hf-caption-selector">
      <span className="hf-caption-label">{label}</span>
      {sizes.map(({ key, label: l }) => (
        <button
          key={key}
          className={`hf-caption-btn${current === key ? " active" : ""}`}
          onClick={() => onChange(key)}
          aria-pressed={current === key}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
