/**
 * Date utility functions for consistent date handling across the application.
 * All dates are normalized to UTC to ensure consistency between client and server.
 */
export class DateUtils {
  /**
   * Normalize date to start of day in UTC (00:00:00.000)
   * Example: 2025-12-15T14:30:00Z → 2025-12-15T00:00:00.000Z
   * 
   * @param date - Date to normalize
   * @returns Date set to start of day (00:00:00.000 UTC)
   */
  static normalizeToStartOfDay(date: Date): Date {
    const normalized = new Date(date);
    normalized.setUTCHours(0, 0, 0, 0);
    return normalized;
  }

  /**
   * Normalize date to end of day in UTC (23:59:59.999)
   * Example: 2025-12-15T14:30:00Z → 2025-12-15T23:59:59.999Z
   * 
   * @param date - Date to normalize
   * @returns Date set to end of day (23:59:59.999 UTC)
   */
  static normalizeToEndOfDay(date: Date): Date {
    const normalized = new Date(date);
    normalized.setUTCHours(23, 59, 59, 999);
    return normalized;
  }

  /**
   * Check if date is today (in UTC)
   * Normalizes both dates to start of day for accurate comparison
   * 
   * @param date - Date to check
   * @returns true if date is today in UTC, false otherwise
   */
  static isToday(date: Date): boolean {
    const today = this.normalizeToStartOfDay(new Date());
    const checkDate = this.normalizeToStartOfDay(date);
    return today.getTime() === checkDate.getTime();
  }

  /**
   * Check if date range is active (start <= today <= end)
   * Used for checking if a plan is currently active
   * 
   * @param startDate - Start of date range
   * @param endDate - End of date range
   * @returns true if today falls within the range (inclusive), false otherwise
   */
  static isDateRangeActive(startDate: Date, endDate: Date): boolean {
    const today = this.normalizeToStartOfDay(new Date());
    const start = this.normalizeToStartOfDay(startDate);
    const end = this.normalizeToEndOfDay(endDate);

    return start <= today && today <= end;
  }

  /**
   * Add days to a date
   * 
   * @param date - Base date
   * @param days - Number of days to add (can be negative)
   * @returns New date with days added
   */
  static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }

  /**
   * Check if two dates are on the same day (ignoring time)
   * 
   * @param date1 - First date
   * @param date2 - Second date
   * @returns true if dates are on same day, false otherwise
   */
  static isSameDay(date1: Date, date2: Date): boolean {
    const normalized1 = this.normalizeToStartOfDay(date1);
    const normalized2 = this.normalizeToStartOfDay(date2);
    return normalized1.getTime() === normalized2.getTime();
  }
}

