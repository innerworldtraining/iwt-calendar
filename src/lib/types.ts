export type CalendarKey = "elites" | "plats";

export type EventRecord = {
  id: string;
  calendar: CalendarKey;
  title: string;
  description: string;
  location: string;
  url: string;
  organizer: string;
  organizerEmail: string;
  startsAt: string; // ISO
  endsAt: string | null; // ISO or null
  timezone: string;
  allDay: boolean;
  legendId: string | null;
  recurrenceGroupId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RecurrenceRule =
  | { type: "daily"; every: number; endAfter: number }
  | { type: "weekly"; every: number; days: number[]; endAfter: number }
  | {
      type: "monthly";
      every: number;
      endAfter: number;
      monthlyMode: "day-of-month" | "day-of-week";
      dayOfMonth?: number;
      weekOrdinal?: "first" | "second" | "third" | "fourth" | "last";
      weekDay?: number;
    };

export type LegendRecord = {
  id: string;
  calendar: CalendarKey;
  label: string;
  color: string;
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
};

export type AdminRecord = {
  email: string;
  name: string;
  addedBy: string | null;
  addedAt: string;
  isBootstrap?: boolean;
};

export type SessionPayload = {
  email: string;
  name: string;
  roles: string[];
  calendars: CalendarKey[];
  isAdmin: boolean;
};
