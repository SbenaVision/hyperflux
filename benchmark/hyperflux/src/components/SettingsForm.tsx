"use client";
import { useState } from "react";
import { useRule } from "@hyperflux/react";
import { APP_SETTINGS, TIMEZONES } from "../lib/data";

export function SettingsForm() {
  const maintenanceMode = useRule<boolean>("config.app.maintenance_mode", {});
  const weeklySummary = useRule<boolean>("config.notifications.weekly_summary_enabled", {});
  const saveLabel = useRule<string>("copy.settings.save_button", {});

  const [maintenance, setMaintenance] = useState(maintenanceMode);
  const [weekly, setWeekly] = useState(weeklySummary);
  const [email, setEmail] = useState(APP_SETTINGS.emailNotificationsEnabled);
  const [timezone, setTimezone] = useState(APP_SETTINGS.timezone);
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form className="settings-form" onSubmit={handleSubmit}>
      {saved && <div className="save-banner">Settings saved.</div>}

      <section className="settings-section">
        <h2 className="settings-section-title">Application</h2>
        <label className="toggle-label">
          <span>Maintenance Mode</span>
          <input
            type="checkbox"
            className="toggle"
            checked={maintenance}
            onChange={(e) => setMaintenance(e.target.checked)}
          />
          <span className="toggle-desc">
            {maintenance ? "Site is in maintenance mode" : "Site is live"}
          </span>
        </label>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">Notifications</h2>
        <label className="toggle-label">
          <span>Weekly Summary</span>
          <input
            type="checkbox"
            className="toggle"
            checked={weekly}
            onChange={(e) => setWeekly(e.target.checked)}
          />
        </label>
        <label className="toggle-label">
          <span>Email Notifications</span>
          <input
            type="checkbox"
            className="toggle"
            checked={email}
            onChange={(e) => setEmail(e.target.checked)}
          />
        </label>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">Regional</h2>
        <label className="field-label">
          Timezone
          <select
            className="form-select"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </label>
      </section>

      <button type="submit" className="btn btn-primary">
        {saveLabel}
      </button>
    </form>
  );
}
