import SettingsForm from "@/components/SettingsForm";

// Hardcoded setting defaults — these live here as documentation of intent.
// The actual state is initialized in SettingsForm.tsx.
// maintenanceMode default: false
// weeklySummaryEnabled default: false
// emailNotificationsEnabled default: true

export default function SettingsPage() {
  return (
    <div>
      <div className="page-header">
        {/* Hardcoded page title */}
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">
          Configure system behavior and notification preferences.
        </p>
      </div>
      <div className="card">
        <SettingsForm />
      </div>
    </div>
  );
}
