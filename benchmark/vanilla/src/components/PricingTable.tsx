import { MOCK_PRICING_RULES, CURRENT_USER } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";

// Hardcoded VIP discount rate — benchmark target
const VIP_DISCOUNT_RATE = 0.05;

export default function PricingTable() {
  // Hardcoded role check: pricing table is admin-only
  if (CURRENT_USER.role !== "admin") {
    return (
      <div className="card">
        <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
          Pricing rules are visible to administrators only.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="pricing-table">
          <thead>
            <tr>
              <th>Rule Name</th>
              <th>Type</th>
              <th>Value</th>
              <th>Condition</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_PRICING_RULES.map((rule) => {
              const displayValue =
                rule.type === "flat"
                  ? formatCurrency(rule.value)
                  : `${(rule.value * 100).toFixed(0)}%`;

              const isVipRule = rule.value === VIP_DISCOUNT_RATE && rule.type === "percentage";

              return (
                <tr key={rule.id}>
                  <td>
                    {rule.name}
                    {isVipRule && (
                      <span
                        className="badge badge-high-value"
                        style={{ marginLeft: 8 }}
                        title={`VIP discount rate: ${VIP_DISCOUNT_RATE * 100}%`}
                      >
                        VIP
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="rule-type-badge">{rule.type}</span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{displayValue}</td>
                  <td style={{ color: "var(--color-text-muted)" }}>
                    {rule.condition}
                  </td>
                  <td>
                    {rule.enabled ? (
                      <span className="rule-enabled">● Enabled</span>
                    ) : (
                      <span className="rule-disabled">○ Disabled</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="pricing-note">
        VIP discount rate is hardcoded at {VIP_DISCOUNT_RATE * 100}% and applies
        to accounts with revenue above $40,000. Contact engineering to update this
        value.
      </div>
    </div>
  );
}
