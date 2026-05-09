"use client";
import { useState, useEffect } from "react";
import { useRule } from "@hyperflux/react";
import { useContent } from "@hyperflux/react";

export function StatsBar() {
  const minutesPerEdit  = useRule<number>("hiflux.config.minutes_per_edit", {});
  const editsLabel      = useContent("hiflux.messages.stats_edits_label");
  const savedLabel      = useContent("hiflux.messages.stats_time_saved_label");
  const minUnit         = useContent("hiflux.messages.stats_min_unit");

  const [editCount, setEditCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d: { editCount: number }) => setEditCount(d.editCount))
      .catch(() => {});
  }, []);

  if (editCount === null) return null;

  const mpe         = minutesPerEdit ?? 5;
  const totalMin    = editCount * mpe;
  const hours       = Math.floor(totalMin / 60);
  const mins        = totalMin % 60;
  const timeSaved   = hours > 0 ? `${hours}h ${mins}${minUnit ?? "min"}` : `${totalMin}${minUnit ?? "min"}`;

  return (
    <div className="hf-stats-bar">
      <span className="hf-stats-edits">✎ {editCount} {editsLabel ?? "edits"}</span>
      <span className="hf-stats-sep">·</span>
      <span className="hf-stats-time">~{timeSaved} {savedLabel ?? "saved"}</span>
    </div>
  );
}
