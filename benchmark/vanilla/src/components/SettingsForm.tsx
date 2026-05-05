"use client";

import { useState } from "react";

// Hardcoded setting defaults — benchmark targets
const DEFAULT_MAINTENANCE_MODE = false;
const DEFAULT_WEEKLY_SUMMARY = false;
const DEFAULT_EMAIL_NOTIFICATIONS = true;
const DEFAULT_TIMEZONE = "America/New_York";

const TIMEZONE_OPTIONS = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
  "UTC",
];

export default function SettingsForm() {
  const [maintenanceMode, setMaintenanceMode] = useState(DEFAULT_MAINTENANCE_MODE);
  const [weeklySummary, setWeeklySummary] = useState(DEFAULT_WEEKLY_SUMMARY);
  const [emailNotifications, setEmailNotifications] = useState(DEFAULT_EMAIL_NOTIFICATIONS);
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // In a real app: persist via API
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <form onSubmit={handleSubmit}>
      {saved && (
        <div className="toast toast-success">
          ✓ Settings saved successfully.
        </div>
      )}

      <div className="settings-section">
        <div className="settings-section-title">System</div>

        <div className="toggle-row">
          <div className="toggle-info">
            <div className="toggle-label">Maintenance Mode</div>
            <div className="toggle-desc">
              Take the application offline for scheduled maintenance.
            </div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={maintenanceMode}
              onChange={(e) => setMaintenanceMode(e.target.checked)}
            />
            <span className="toggle-track" />
          </label>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Notifications</div>

        <div className="toggle-row">
          <div className="toggle-info">
            <div className="toggle-label">Email Notifications</div>
            <div className="toggle-desc">
              Send email alerts for high-severity events and system errors.
            </div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={emailNotifications}
              onChange={(e) => setEmailNotifications(e.target.checked)}
            />
            <span className="toggle-track" />
          </label>
        </div>

        <div className="toggle-row">
          <div className="toggle-info">
            <div className="toggle-label">Weekly Summary Email</div>
            <div className="toggle-desc">
              Receive a weekly digest of revenue, user activity, and alerts.
            </div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={weeklySummary}
              onChange={(e) => setWeeklySummary(e.target.checked)}
            />
            <span className="toggle-track" />
          </label>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Localization</div>

        <div className="toggle-row">
          <div className="toggle-info">
            <div className="toggle-label">Timezone</div>
            <div className="toggle-desc">
              Affects how dates and times are displayed across the admin panel.
            </div>
          </div>
          <select
            className="settings-select"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="settings-actions">
        {/* Form submit button — hardcoded label "Submit" (benchmark target) */}
        <button type="submit" className="btn btn-primary">
          Submit
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setMaintenanceMode(DEFAULT_MAINTENANCE_MODE);
            setWeeklySummary(DEFAULT_WEEKLY_SUMMARY);
            setEmailNotifications(DEFAULT_EMAIL_NOTIFICATIONS);
            setTimezone(DEFAULT_TIMEZONE);
          }}
        >
          Reset to Defaults
        </button>
      </div>
    </form>
  );
}
