'use strict';

/**
 * AppError — structured error class for consistent error handling.
 *
 * @example
 *   throw new AppError('Plan not found', 404);
 *   throw new AppError('Invalid weight value', 400);
 */
class AppError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {number} statusCode - HTTP status code
   */
  constructor(message, statusCode = 500) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
