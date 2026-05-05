import PricingTable from "@/components/PricingTable";

export default function PricingPage() {
  return (
    <div>
      <div className="page-header">
        {/* Hardcoded page title */}
        <h1 className="page-title">Pricing</h1>
        <p className="page-subtitle">
          Active pricing rules applied to user accounts.
        </p>
      </div>
      <PricingTable />
    </div>
  );
}
