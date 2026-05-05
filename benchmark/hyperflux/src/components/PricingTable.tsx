"use client";
import { useRule } from "@hyperflux/react";
import { PRICING_RULES } from "../lib/data";
import { formatCurrency } from "../lib/utils";

export function PricingTable() {
  const vipDiscount = useRule<number>("pricing.vip.discount_rate", {});
  const pageTitle = useRule<string>("copy.pricing.page_title", {});
  const flatFee = useRule<number>("pricing.fee.flat_fee", {});
  const highValueThreshold = useRule<number>("pricing.fee.high_value_threshold", {});
  const highValueResult = useRule<number>("pricing.fee.high_value_result", {});

  return (
    <div className="pricing-wrap">
      <h1 className="page-title">{pageTitle}</h1>

      <div className="pricing-summary">
        <div className="pricing-card">
          <h3>VIP Discount</h3>
          <div className="pricing-value">{(vipDiscount * 100).toFixed(0)}%</div>
          <p className="muted">Applied to users with revenue ≥ $10,000</p>
        </div>
        <div className="pricing-card">
          <h3>Flat Transaction Fee</h3>
          <div className="pricing-value">{formatCurrency(flatFee)}</div>
          <p className="muted">For transactions under {formatCurrency(highValueThreshold)}</p>
        </div>
        <div className="pricing-card">
          <h3>High-Value Fee</h3>
          <div className="pricing-value">{formatCurrency(highValueResult)}</div>
          <p className="muted">Waived for transactions ≥ {formatCurrency(highValueThreshold)}</p>
        </div>
      </div>

      <h2 className="section-title">All Pricing Rules</h2>
      <table className="pricing-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Value</th>
            <th>Condition</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {PRICING_RULES.map((rule) => (
            <tr key={rule.id} className={rule.enabled ? "" : "row-disabled"}>
              <td>{rule.name}</td>
              <td>
                <span className={`type-pill type-${rule.type}`}>{rule.type}</span>
              </td>
              <td>
                {rule.type === "percentage"
                  ? `${(rule.value * 100).toFixed(0)}%`
                  : formatCurrency(rule.value)}
              </td>
              <td className="condition-cell">{rule.condition}</td>
              <td>
                <span className={`status-pill status-${rule.enabled ? "active" : "inactive"}`}>
                  {rule.enabled ? "enabled" : "disabled"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
