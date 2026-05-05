import type { User, Alert, RevenueData, PricingRule, AppSettings } from "./types";

export const USERS: User[] = [
  {
    id: "u1",
    name: "Alice Johnson",
    email: "alice@example.com",
    status: "active",
    revenue: 24500,
    lastLogin: "2026-05-01",
    role: "admin",
    createdAt: "2024-01-15",
  },
  {
    id: "u2",
    name: "Bob Smith",
    email: "bob@example.com",
    status: "active",
    revenue: 8200,
    lastLogin: "2026-04-28",
    role: "user",
    createdAt: "2024-02-03",
  },
  {
    id: "u3",
    name: "Carol White",
    email: "carol@example.com",
    status: "inactive",
    revenue: 15750,
    lastLogin: "2025-12-10",
    role: "user",
    createdAt: "2024-01-28",
  },
  {
    id: "u4",
    name: "David Lee",
    email: "david@example.com",
    status: "active",
    revenue: 32100,
    lastLogin: "2026-05-04",
    role: "user",
    createdAt: "2023-11-20",
  },
  {
    id: "u5",
    name: "Eva Martinez",
    email: "eva@example.com",
    status: "deactivated",
    revenue: 4300,
    lastLogin: "2025-09-15",
    role: "user",
    createdAt: "2024-03-10",
  },
  {
    id: "u6",
    name: "Frank Brown",
    email: "frank@example.com",
    status: "active",
    revenue: 11200,
    lastLogin: "2026-04-30",
    role: "user",
    createdAt: "2024-04-01",
  },
  {
    id: "u7",
    name: "Grace Kim",
    email: "grace@example.com",
    status: "active",
    revenue: 19800,
    lastLogin: "2026-05-02",
    role: "user",
    createdAt: "2023-12-05",
  },
  {
    id: "u8",
    name: "Henry Wilson",
    email: "henry@example.com",
    status: "inactive",
    revenue: 6700,
    lastLogin: "2026-01-20",
    role: "user",
    createdAt: "2024-05-15",
  },
  {
    id: "u9",
    name: "Isabel Davis",
    email: "isabel@example.com",
    status: "active",
    revenue: 28900,
    lastLogin: "2026-05-03",
    role: "user",
    createdAt: "2023-10-08",
  },
  {
    id: "u10",
    name: "James Taylor",
    email: "james@example.com",
    status: "active",
    revenue: 5100,
    lastLogin: "2026-04-25",
    role: "user",
    createdAt: "2024-06-20",
  },
  {
    id: "u11",
    name: "Karen Anderson",
    email: "karen@example.com",
    status: "inactive",
    revenue: 13400,
    lastLogin: "2025-10-30",
    role: "user",
    createdAt: "2024-02-18",
  },
  {
    id: "u12",
    name: "Liam Thomas",
    email: "liam@example.com",
    status: "active",
    revenue: 41200,
    lastLogin: "2026-05-04",
    role: "admin",
    createdAt: "2023-08-12",
  },
  {
    id: "u13",
    name: "Mia Garcia",
    email: "mia@example.com",
    status: "active",
    revenue: 9600,
    lastLogin: "2026-04-29",
    role: "user",
    createdAt: "2024-07-01",
  },
  {
    id: "u14",
    name: "Noah Jackson",
    email: "noah@example.com",
    status: "deactivated",
    revenue: 2100,
    lastLogin: "2025-07-04",
    role: "user",
    createdAt: "2024-08-14",
  },
  {
    id: "u15",
    name: "Olivia Harris",
    email: "olivia@example.com",
    status: "active",
    revenue: 17300,
    lastLogin: "2026-05-01",
    role: "user",
    createdAt: "2023-09-22",
  },
];

export const ALERTS: Alert[] = [
  {
    id: "a1",
    message: "High CPU usage detected on primary server",
    severity: "high",
    timestamp: "2026-05-05T08:23:00Z",
  },
  {
    id: "a2",
    message: "Payment gateway timeout — 3 failed transactions",
    severity: "high",
    timestamp: "2026-05-05T07:45:00Z",
  },
  {
    id: "a3",
    message: "Disk space below 15% on backup node",
    severity: "medium",
    timestamp: "2026-05-04T22:10:00Z",
  },
  {
    id: "a4",
    message: "Scheduled maintenance window starts in 2 hours",
    severity: "low",
    timestamp: "2026-05-05T06:00:00Z",
  },
];

export const REVENUE_DATA: RevenueData[] = [
  { month: "Nov 2025", revenue: 182000 },
  { month: "Dec 2025", revenue: 210000 },
  { month: "Jan 2026", revenue: 195000 },
  { month: "Feb 2026", revenue: 223000 },
  { month: "Mar 2026", revenue: 241000 },
  { month: "Apr 2026", revenue: 258000 },
];

export const PRICING_RULES: PricingRule[] = [
  {
    id: "pr1",
    name: "VIP Discount",
    type: "percentage",
    value: 0.05,
    condition: "user.revenue >= 10000",
    enabled: true,
  },
  {
    id: "pr2",
    name: "Flat Transaction Fee",
    type: "flat",
    value: 2.5,
    condition: "transaction.amount < 1000",
    enabled: true,
  },
  {
    id: "pr3",
    name: "High-Value Fee Waiver",
    type: "flat",
    value: 0,
    condition: "transaction.amount >= 1000",
    enabled: true,
  },
  {
    id: "pr4",
    name: "New User Promo",
    type: "percentage",
    value: 0.1,
    condition: "user.createdAt within 30 days",
    enabled: false,
  },
];

export const APP_SETTINGS: AppSettings = {
  maintenanceMode: false,
  weeklySummaryEnabled: false,
  emailNotificationsEnabled: true,
  timezone: "America/New_York",
};

export const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
];

export function getUserById(id: string): User | undefined {
  return USERS.find((u) => u.id === id);
}

export function getTotalRevenue(): number {
  return USERS.reduce((sum, u) => sum + u.revenue, 0);
}

export function getActiveUserCount(): number {
  return USERS.filter((u) => u.status === "active").length;
}
