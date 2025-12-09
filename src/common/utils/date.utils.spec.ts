import { DateUtils } from './date.utils';

describe('DateUtils', () => {
  describe('normalizeToStartOfDay', () => {
    it('should normalize date to start of day (00:00:00.000 UTC)', () => {
      const date = new Date('2025-12-15T14:30:45.123Z');
      const result = DateUtils.normalizeToStartOfDay(date);

      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(0);
      expect(result.getUTCMilliseconds()).toBe(0);
      expect(result.getUTCDate()).toBe(15);
      expect(result.getUTCMonth()).toBe(11); // December (0-indexed)
      expect(result.getUTCFullYear()).toBe(2025);
    });

    it('should handle dates at midnight', () => {
      const date = new Date('2025-12-15T00:00:00.000Z');
      const result = DateUtils.normalizeToStartOfDay(date);

      expect(result.getTime()).toBe(date.getTime());
    });

    it('should handle dates at end of day', () => {
      const date = new Date('2025-12-15T23:59:59.999Z');
      const result = DateUtils.normalizeToStartOfDay(date);

      expect(result.toISOString()).toBe('2025-12-15T00:00:00.000Z');
    });
  });

  describe('normalizeToEndOfDay', () => {
    it('should normalize date to end of day (23:59:59.999 UTC)', () => {
      const date = new Date('2025-12-15T14:30:45.123Z');
      const result = DateUtils.normalizeToEndOfDay(date);

      expect(result.getUTCHours()).toBe(23);
      expect(result.getUTCMinutes()).toBe(59);
      expect(result.getUTCSeconds()).toBe(59);
      expect(result.getUTCMilliseconds()).toBe(999);
      expect(result.getUTCDate()).toBe(15);
      expect(result.getUTCMonth()).toBe(11);
      expect(result.getUTCFullYear()).toBe(2025);
    });

    it('should handle dates at start of day', () => {
      const date = new Date('2025-12-15T00:00:00.000Z');
      const result = DateUtils.normalizeToEndOfDay(date);

      expect(result.toISOString()).toBe('2025-12-15T23:59:59.999Z');
    });

    it('should handle month boundaries', () => {
      const date = new Date('2025-12-31T12:00:00.000Z');
      const result = DateUtils.normalizeToEndOfDay(date);

      expect(result.getUTCDate()).toBe(31);
      expect(result.getUTCMonth()).toBe(11); // December
      expect(result.toISOString()).toBe('2025-12-31T23:59:59.999Z');
    });
  });

  describe('isToday', () => {
    it('should return true for current date', () => {
      const now = new Date();
      expect(DateUtils.isToday(now)).toBe(true);
    });

    it('should return true for current date with different time', () => {
      const now = new Date();
      now.setUTCHours(23, 59, 59, 999);
      expect(DateUtils.isToday(now)).toBe(true);
    });

    it('should return false for yesterday', () => {
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      expect(DateUtils.isToday(yesterday)).toBe(false);
    });

    it('should return false for tomorrow', () => {
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      expect(DateUtils.isToday(tomorrow)).toBe(false);
    });
  });

  describe('isDateRangeActive', () => {
    it('should return true when today is within range', () => {
      const today = new Date();
      const startDate = new Date();
      startDate.setUTCDate(today.getUTCDate() - 3);
      const endDate = new Date();
      endDate.setUTCDate(today.getUTCDate() + 3);

      expect(DateUtils.isDateRangeActive(startDate, endDate)).toBe(true);
    });

    it('should return true when today equals start date', () => {
      const today = new Date();
      const endDate = new Date();
      endDate.setUTCDate(today.getUTCDate() + 7);

      expect(DateUtils.isDateRangeActive(today, endDate)).toBe(true);
    });

    it('should return true when today equals end date', () => {
      const today = new Date();
      const startDate = new Date();
      startDate.setUTCDate(today.getUTCDate() - 7);

      expect(DateUtils.isDateRangeActive(startDate, today)).toBe(true);
    });

    it('should return false when today is before range', () => {
      const today = new Date();
      const startDate = new Date();
      startDate.setUTCDate(today.getUTCDate() + 1);
      const endDate = new Date();
      endDate.setUTCDate(today.getUTCDate() + 7);

      expect(DateUtils.isDateRangeActive(startDate, endDate)).toBe(false);
    });

    it('should return false when today is after range', () => {
      const today = new Date();
      const startDate = new Date();
      startDate.setUTCDate(today.getUTCDate() - 7);
      const endDate = new Date();
      endDate.setUTCDate(today.getUTCDate() - 1);

      expect(DateUtils.isDateRangeActive(startDate, endDate)).toBe(false);
    });
  });

  describe('addDays', () => {
    it('should add positive days', () => {
      const date = new Date('2025-12-15T12:00:00.000Z');
      const result = DateUtils.addDays(date, 5);

      expect(result.getUTCDate()).toBe(20);
      expect(result.getUTCMonth()).toBe(11);
    });

    it('should add negative days', () => {
      const date = new Date('2025-12-15T12:00:00.000Z');
      const result = DateUtils.addDays(date, -5);

      expect(result.getUTCDate()).toBe(10);
      expect(result.getUTCMonth()).toBe(11);
    });

    it('should handle month boundaries', () => {
      const date = new Date('2025-12-30T12:00:00.000Z');
      const result = DateUtils.addDays(date, 5);

      expect(result.getUTCDate()).toBe(4);
      expect(result.getUTCMonth()).toBe(0); // January
      expect(result.getUTCFullYear()).toBe(2026);
    });
  });

  describe('isSameDay', () => {
    it('should return true for same day with different times', () => {
      const date1 = new Date('2025-12-15T08:00:00.000Z');
      const date2 = new Date('2025-12-15T20:00:00.000Z');

      expect(DateUtils.isSameDay(date1, date2)).toBe(true);
    });

    it('should return false for different days', () => {
      const date1 = new Date('2025-12-15T23:59:59.999Z');
      const date2 = new Date('2025-12-16T00:00:00.000Z');

      expect(DateUtils.isSameDay(date1, date2)).toBe(false);
    });

    it('should return true for exact same date and time', () => {
      const date = new Date('2025-12-15T12:00:00.000Z');

      expect(DateUtils.isSameDay(date, date)).toBe(true);
    });
  });
});

