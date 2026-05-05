import { MOCK_ALERTS } from "@/lib/data";
import RevenueWidget from "@/components/RevenueWidget";
import UsersWidget from "@/components/UsersWidget";
import AlertsWidget from "@/components/AlertsWidget";

// Hardcoded threshold: show AlertsWidget only when alert count >= 3
const ALERTS_DISPLAY_THRESHOLD = 3;

export default function DashboardPage() {
  const showAlerts = MOCK_ALERTS.length >= ALERTS_DISPLAY_THRESHOLD;

  return (
    <div>
      <div className="page-header">
        {/* Hardcoded page title */}
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          Welcome back. Here&apos;s what&apos;s happening today.
        </p>
      </div>

      <div className="dashboard-grid">
        <RevenueWidget />
        <UsersWidget />
        {/* AlertsWidget rendered only when alerts.length >= 3 — hardcoded */}
        {showAlerts && <AlertsWidget />}
      </div>
    </div>
  );
}
