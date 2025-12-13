import { Types } from 'mongoose';
import { AppLogger } from './logger.utils';
import { DateUtils } from './date.utils';

/**
 * Helper class for handling plan overlaps
 * Provides logic for detecting and resolving plan overlaps
 */
export class PlanOverlapHandler {
  /**
   * Check if two date ranges overlap
   * @param start1 Start date of first range
   * @param end1 End date of first range
   * @param start2 Start date of second range
   * @param end2 End date of second range
   * @returns true if ranges overlap
   */
  static checkOverlap(
    start1: Date,
    end1: Date,
    start2: Date,
    end2: Date,
  ): boolean {
    const normalizedStart1 = DateUtils.normalizeToStartOfDay(start1);
    const normalizedEnd1 = DateUtils.normalizeToEndOfDay(end1);
    const normalizedStart2 = DateUtils.normalizeToStartOfDay(start2);
    const normalizedEnd2 = DateUtils.normalizeToEndOfDay(end2);

    return normalizedStart2 <= normalizedEnd1 && normalizedEnd2 >= normalizedStart1;
  }

  /**
   * Find overlapping plan in client's plan history
   * @param planHistory Client's plan history
   * @param newPlanId ID of the new plan being assigned
   * @param newStartDate Start date of new plan assignment
   * @param newEndDate End date of new plan assignment
   * @returns Overlapping plan entry or null
   */
  static findOverlappingPlan(
    planHistory: any[],
    newPlanId: string,
    newStartDate: Date,
    newEndDate: Date,
  ): any | null {
    AppLogger.logOperation('PLAN_OVERLAP_CHECK', {
      newPlanId,
      newStartDate: newStartDate.toISOString(),
      newEndDate: newEndDate.toISOString(),
      planHistoryCount: planHistory.length,
    }, 'debug');

    for (const entry of planHistory) {
      const existingPlanId = entry.planId.toString();
      
      // Skip if it's the same plan
      if (existingPlanId === newPlanId) {
        AppLogger.logOperation('PLAN_OVERLAP_SAME_PLAN', {
          planId: existingPlanId,
          reason: 'Same plan, skipping overlap check'
        }, 'debug');
        continue;
      }

      const existingStart = new Date(entry.planStartDate);
      const existingEnd = new Date(entry.planEndDate);

      // Check if there's an overlap
      if (this.checkOverlap(existingStart, existingEnd, newStartDate, newEndDate)) {
        AppLogger.logWarning('PLAN_OVERLAP_DETECTED', {
          oldPlanId: existingPlanId,
          newPlanId,
          oldStartDate: existingStart.toISOString(),
          oldEndDate: existingEnd.toISOString(),
          newStartDate: newStartDate.toISOString(),
          newEndDate: newEndDate.toISOString(),
        });
        return entry;
      }
    }

    AppLogger.logOperation('PLAN_OVERLAP_NO_OVERLAP', {
      newPlanId,
      planHistoryCount: planHistory.length,
    }, 'debug');

    return null;
  }

  /**
   * Calculate close date for overlapping plan
   * Close date is set to day before new plan starts
   * @param newStartDate Start date of new plan
   * @returns Close date (day before new plan starts, at 23:59:59.999)
   */
  static calculateCloseDate(newStartDate: Date): Date {
    const closeDate = DateUtils.normalizeToStartOfDay(new Date(newStartDate));
    closeDate.setUTCDate(closeDate.getUTCDate() - 1); // Day before new plan
    closeDate.setUTCHours(23, 59, 59, 999); // End of that day
    
    return closeDate;
  }
}

