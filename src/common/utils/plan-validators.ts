import { BadRequestException } from '@nestjs/common';
import { AppLogger } from './logger.utils';
import { DateUtils } from './date.utils';

/**
 * Plan validation utilities
 */
export class PlanValidators {
  /**
   * Validate plan start date
   * - Cannot be in the past (more than 1 day ago)
   * - Cannot be too far in the future (more than 30 days)
   */
  static validateStartDate(startDate: Date, planId?: string): void {
    const normalizedStartDate = DateUtils.normalizeToStartOfDay(startDate);
    const today = DateUtils.normalizeToStartOfDay(new Date());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const maxFutureDate = new Date(today);
    maxFutureDate.setDate(maxFutureDate.getDate() + 30);

    AppLogger.logOperation('PLAN_START_DATE_VALIDATE', {
      planId,
      startDate: normalizedStartDate.toISOString(),
      today: today.toISOString(),
      yesterday: yesterday.toISOString(),
      maxFutureDate: maxFutureDate.toISOString(),
    }, 'debug');

    // Check if start date is too far in the past
    if (normalizedStartDate < yesterday) {
      AppLogger.logWarning('PLAN_START_DATE_INVALID', {
        planId,
        startDate: normalizedStartDate.toISOString(),
        reason: 'Start date cannot be in the past',
      });
      throw new BadRequestException(
        'Plan start date cannot be in the past. Please select today or a future date.'
      );
    }

    // Check if start date is too far in the future
    if (normalizedStartDate > maxFutureDate) {
      AppLogger.logWarning('PLAN_START_DATE_INVALID', {
        planId,
        startDate: normalizedStartDate.toISOString(),
        reason: 'Start date too far in future (max 30 days)',
      });
      throw new BadRequestException(
        'Plan start date cannot be more than 30 days in the future.'
      );
    }

    AppLogger.logOperation('PLAN_START_DATE_VALID', {
      planId,
      startDate: normalizedStartDate.toISOString(),
    }, 'debug');
  }

  /**
   * Validate that plan is a template (not assigned to clients)
   */
  static validateIsTemplate(plan: any, operation: string): void {
    AppLogger.logOperation('PLAN_TEMPLATE_CHECK', {
      planId: plan._id?.toString(),
      isTemplate: plan.isTemplate,
      assignedClientsCount: plan.assignedClientIds?.length || 0,
      operation,
    }, 'debug');

    if (!plan.isTemplate) {
      AppLogger.logWarning('PLAN_TEMPLATE_INVALID', {
        planId: plan._id?.toString(),
        reason: 'Plan is not a template',
        operation,
      });
      throw new BadRequestException(
        `Cannot ${operation} - this plan is already assigned to clients. Only template plans can be ${operation}ed.`
      );
    }
  }

  /**
   * Validate plan can be cancelled
   */
  static validateCanCancel(plan: any, hasActiveLogs: boolean): void {
    AppLogger.logOperation('PLAN_CANCEL_VALIDATE', {
      planId: plan._id?.toString(),
      hasActiveLogs,
      assignedClientsCount: plan.assignedClientIds?.length || 0,
    }, 'debug');

    if (hasActiveLogs) {
      AppLogger.logWarning('PLAN_CANCEL_INVALID', {
        planId: plan._id?.toString(),
        reason: 'Plan has active workout logs',
      });
      throw new BadRequestException(
        'Cannot cancel plan - there are active workout logs. Please complete or delete active workouts first.'
      );
    }
  }
}

