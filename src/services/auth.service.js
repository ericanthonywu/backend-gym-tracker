'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const AppError = require('../utils/app-error');

/**
 * Auth Service — PIN verification and JWT issuance.
 */
const authService = {
  /**
   * Verifies the PIN and returns a signed JWT.
   *
   * @param {string} pin
   * @returns {{ token: string }}
   * @throws {AppError} 401 if PIN is incorrect
   */
  login(pin) {
    if (pin !== env.AUTH_PIN) {
      throw new AppError('Incorrect PIN', 401);
    }

    const token = jwt.sign(
      { user: 'vivian' },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN },
    );

    return { token };
  },
};

module.exports = authService;
