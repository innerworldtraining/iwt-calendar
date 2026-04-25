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
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
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
