"use client";
import { useState, useEffect } from "react";
import { useContent, useRule } from "@hyperflux/react";
import type { ExplainResult } from "@hyperflux/core/client";

interface Props {
  path: string;
}

async function fetchExplain(
  address: string,
  stage: "before" | "after",
  path: string
): Promise<ExplainResult> {
  const res = await fetch(
    `/api/lifecycle/explain?address=${encodeURIComponent(address)}&stage=${stage}&path=${encodeURIComponent(path)}`
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function StageLabel({ stage }: { stage: string }) {
  return <span className={`hf-stage-badge hf-stage-${stage}`}>{stage}</span>;
}

function VerdictBadge({ wouldBlock }: { wouldBlock: boolean }) {
  const blockLabel = useContent("hiflux.messages.explain_verdict_block");
  const passLabel  = useContent("hiflux.messages.explain_verdict_pass");
  return wouldBlock
    ? <span className="hf-explain-verdict hf-explain-block">{blockLabel}</span>
    : <span className="hf-explain-verdict hf-explain-pass">{passLabel}</span>;
}

function RuleOutputRow({ path, output, truncateAt }: { path: string; output: unknown; truncateAt: number }) {
  const str = JSON.stringify(output);
  return (
    <div className="hf-explain-rule-row">
      <span className="hf-explain-rule-path">{path}</span>
      <span className="hf-explain-rule-output" title={str}>
        {str.length > truncateAt ? str.slice(0, truncateAt) + "…" : str}
      </span>
    </div>
  );
}

export function ExplainPanel({ path }: Props) {
  const loadingMsg      = useContent("hiflux.messages.lifecycle_loading");
  const lifecycleHeader = useContent("hiflux.ui.lifecycle_header");
  const explainAddress  = useRule<string>("hiflux.config.lifecycle_explain_address", {});
  const truncateLength  = useRule<number>("hiflux.config.result_truncate_length", {});

  const [before, setBefore] = useState<ExplainResult | null>(null);
  const [after,  setAfter]  = useState<ExplainResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!path || !explainAddress) return;
    setLoading(true);
    setBefore(null);
    setAfter(null);
    Promise.all([
      fetchExplain(explainAddress, "before", path),
      fetchExplain(explainAddress, "after",  path),
    ]).then(([b, a]) => {
      setBefore(b);
      setAfter(a);
    }).catch(() => {
      // address may not match — silently skip
    }).finally(() => setLoading(false));
  }, [path, explainAddress]);

  if (loading && !before && !after) {
    return <div className="hf-explain-loading">{loadingMsg}</div>;
  }
  if (!before && !after) return null;

  return (
    <div className="hf-explain-wrap">
      <div className="hf-explain-header">{lifecycleHeader}</div>

      {before && (
        <div className="hf-explain-stage">
          <div className="hf-explain-stage-row">
            <StageLabel stage="before" />
            <VerdictBadge wouldBlock={before.wouldBlock} />
            {before.blockReason && (
              <span className="hf-explain-reason">{before.blockReason}</span>
            )}
          </div>
          {before.rulesEvaluated.map((r) => (
            <RuleOutputRow key={r.path} path={r.path} output={r.output} truncateAt={truncateLength ?? 60} />
          ))}
        </div>
      )}

      {after && (
        <div className="hf-explain-stage">
          <div className="hf-explain-stage-row">
            <StageLabel stage="after" />
            <span className="hf-explain-sub">
              {after.rulesEvaluated.length} rule{after.rulesEvaluated.length !== 1 ? "s" : ""} would fire
            </span>
          </div>
          {after.rulesEvaluated.map((r) => (
            <RuleOutputRow key={r.path} path={r.path} output={r.output} truncateAt={truncateLength ?? 60} />
          ))}
        </div>
      )}
    </div>
  );
}
