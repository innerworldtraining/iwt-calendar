import type { RecurrenceRule } from "./types";

/**
 * Given a base start date and a RecurrenceRule, returns an array of
 * { startsAt, endsAt } pairs for each occurrence.
 */
export function expandRecurrence(
  baseStart: Date,
  baseEnd: Date | null,
  rule: RecurrenceRule
): Array<{ startsAt: Date; endsAt: Date | null }> {
  const duration = baseEnd ? baseEnd.getTime() - baseStart.getTime() : 0;
  const results: Array<{ startsAt: Date; endsAt: Date | null }> = [];

  if (rule.type === "daily") {
    let current = new Date(baseStart);
    for (let i = 0; i < rule.endAfter; i++) {
      const s = new Date(current);
      results.push({ startsAt: s, endsAt: baseEnd ? new Date(s.getTime() + duration) : null });
      current = new Date(current.getTime() + rule.every * 86400000);
    }
    return results;
  }

  if (rule.type === "weekly") {
    if (!rule.days || rule.days.length === 0) {
      // Default to same day of week as base
      rule = { ...rule, days: [baseStart.getUTCDay()] };
    }
    const sortedDays = [...rule.days].sort((a, b) => a - b);
    let count = 0;
    // Start from beginning of the week containing baseStart
    const weekStart = new Date(baseStart);
    weekStart.setUTCDate(baseStart.getUTCDate() - baseStart.getUTCDay());
    weekStart.setUTCHours(baseStart.getUTCHours(), baseStart.getUTCMinutes(), baseStart.getUTCSeconds(), 0);

    let weekCursor = new Date(weekStart);
    while (count < rule.endAfter) {
      for (const day of sortedDays) {
        if (count >= rule.endAfter) break;
        const candidate = new Date(weekCursor);
        candidate.setUTCDate(weekCursor.getUTCDate() + day);
        // Skip dates before baseStart
        if (candidate < baseStart) continue;
        results.push({
          startsAt: new Date(candidate),
          endsAt: baseEnd ? new Date(candidate.getTime() + duration) : null,
        });
        count++;
      }
      // Advance by `every` weeks
      weekCursor = new Date(weekCursor.getTime() + rule.every * 7 * 86400000);
    }
    return results;
  }

  if (rule.type === "monthly") {
    let count = 0;
    let monthCursor = new Date(Date.UTC(
      baseStart.getUTCFullYear(),
      baseStart.getUTCMonth(),
      1
    ));

    while (count < rule.endAfter) {
      const year = monthCursor.getUTCFullYear();
      const month = monthCursor.getUTCMonth();
      let dayDate: Date | null = null;

      if (rule.monthlyMode === "day-of-month") {
        const dom = rule.dayOfMonth ?? baseStart.getUTCDate();
        const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        const actualDay = Math.min(dom, lastDay);
        dayDate = new Date(Date.UTC(
          year, month, actualDay,
          baseStart.getUTCHours(), baseStart.getUTCMinutes(), baseStart.getUTCSeconds()
        ));
      } else {
        // day-of-week mode
        const targetWeekDay = rule.weekDay ?? baseStart.getUTCDay();
        const ordinal = rule.weekOrdinal ?? "first";
        dayDate = getNthWeekdayOfMonth(year, month, targetWeekDay, ordinal,
          baseStart.getUTCHours(), baseStart.getUTCMinutes(), baseStart.getUTCSeconds());
      }

      if (dayDate && dayDate >= baseStart) {
        results.push({
          startsAt: new Date(dayDate),
          endsAt: baseEnd ? new Date(dayDate.getTime() + duration) : null,
        });
        count++;
      }

      // Advance by `every` months
      monthCursor = new Date(Date.UTC(year, month + rule.every, 1));
    }
    return results;
  }

  return results;
}

function getNthWeekdayOfMonth(
  year: number,
  month: number,
  weekDay: number, // 0=Sun, 6=Sat
  ordinal: "first" | "second" | "third" | "fourth" | "last",
  hours: number,
  minutes: number,
  seconds: number
): Date | null {
  if (ordinal === "last") {
    // Start from last day of month and go backwards
    const lastDay = new Date(Date.UTC(year, month + 1, 0));
    let d = new Date(lastDay);
    while (d.getUTCDay() !== weekDay) {
      d = new Date(d.getTime() - 86400000);
    }
    return new Date(Date.UTC(year, month, d.getUTCDate(), hours, minutes, seconds));
  }

  const ordinalMap = { first: 1, second: 2, third: 3, fourth: 4 };
  const targetOccurrence = ordinalMap[ordinal];
  let count = 0;
  let d = new Date(Date.UTC(year, month, 1));

  while (d.getUTCMonth() === month) {
    if (d.getUTCDay() === weekDay) {
      count++;
      if (count === targetOccurrence) {
        return new Date(Date.UTC(year, month, d.getUTCDate(), hours, minutes, seconds));
      }
    }
    d = new Date(d.getTime() + 86400000);
  }
  return null;
}
