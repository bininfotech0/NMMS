// Calendar-month arithmetic shared by ApplicationsService (validUntil on
// approve) and PaymentsService (validUntil on renewal) — both need the same
// overflow-safe "add N months" behavior for plan validity calculations.
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  // Clamp overflow (e.g. Jan 31 + 1 month → Feb 28/29, not Mar 3).
  result.setDate(Math.min(day, daysInMonth(result.getFullYear(), result.getMonth())));
  return result;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}
