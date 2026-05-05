export interface User {
  id: string;
  name: string;
  email: string;
  status: "active" | "inactive" | "deactivated";
  revenue: number;
  lastLogin: string; // ISO date string YYYY-MM-DD
  role: "admin" | "user";
  createdAt: string;
}

export interface Alert {
  id: string;
  message: string;
  severity: "low" | "medium" | "high";
  timestamp: string;
}

export interface RevenueData {
  month: string;
  revenue: number;
}

export interface PricingRule {
  id: string;
  name: string;
  type: "flat" | "percentage";
  value: number;
  condition: string;
  enabled: boolean;
}

export interface AppSettings {
  maintenanceMode: boolean;
  weeklySummaryEnabled: boolean;
  emailNotificationsEnabled: boolean;
  timezone: string;
}
