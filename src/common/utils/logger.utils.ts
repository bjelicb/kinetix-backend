import { Logger } from '@nestjs/common';

/**
 * Centralized logging utility for structured logging across the application.
 * Provides consistent log format with operation names and context data.
 */
export class AppLogger {
  private static logger = new Logger('KinetixBackend');

  /**
   * Log an operation with structured context data
   * @param operation - Operation name (e.g., 'PLAN_DELETE_START')
   * @param context - Context object with relevant data
   * @param level - Log level (debug, info, warn, error)
   */
  static logOperation(
    operation: string,
    context: Record<string, any>,
    level: 'debug' | 'info' | 'warn' | 'error' = 'info',
  ): void {
    const message = `[${operation}] ${JSON.stringify(context)}`;
    
    switch (level) {
      case 'debug':
        this.logger.debug(message);
        break;
      case 'info':
        this.logger.log(message);
        break;
      case 'warn':
        this.logger.warn(message);
        break;
      case 'error':
        this.logger.error(message);
        break;
    }
  }

  /**
   * Log the start of an operation
   */
  static logStart(operation: string, context: Record<string, any>): void {
    this.logOperation(`${operation}_START`, context, 'info');
  }

  /**
   * Log the completion of an operation
   */
  static logComplete(operation: string, context: Record<string, any>): void {
    this.logOperation(`${operation}_COMPLETE`, context, 'info');
  }

  /**
   * Log an error during an operation
   */
  static logError(operation: string, context: Record<string, any>, error?: Error): void {
    const errorContext = {
      ...context,
      error: error?.message,
      stack: error?.stack,
    };
    this.logOperation(`${operation}_ERROR`, errorContext, 'error');
  }

  /**
   * Log a validation check
   */
  static logValidation(operation: string, context: Record<string, any>, isValid: boolean): void {
    const level = isValid ? 'debug' : 'warn';
    this.logOperation(`${operation}_VALIDATE`, { ...context, isValid }, level);
  }

  /**
   * Log a warning condition
   */
  static logWarning(operation: string, context: Record<string, any>): void {
    this.logOperation(operation, context, 'warn');
  }
}

