import { RevenueWidget } from "../../components/RevenueWidget";
import { UsersWidget } from "../../components/UsersWidget";
import { AlertsWidget } from "../../components/AlertsWidget";

export const metadata = { title: "Dashboard — HyperFlux Admin" };

export default function DashboardPage() {
  return (
    <>
      <h1 className="page-title">Dashboard</h1>
      <div className="dashboard-grid">
        <RevenueWidget />
        <UsersWidget />
        <AlertsWidget />
      </div>
    </>
  );
}
