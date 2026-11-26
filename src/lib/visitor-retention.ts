export const VISITOR_RECORD_RETENTION_MONTHS = 24;

export function getVisitorRecordCutoff(now = new Date()): Date {
  const totalMonths = now.getUTCFullYear() * 12 + now.getUTCMonth() - VISITOR_RECORD_RETENTION_MONTHS;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();
  const targetDay = Math.min(now.getUTCDate(), lastDayOfTargetMonth);

  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      targetDay,
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds(),
      now.getUTCMilliseconds(),
    ),
  );
}
