'use strict';

require('dotenv').config();

/**
 * Centralized environment variable access.
 * All other modules must use this instead of process.env directly.
 */
const env = {
  // Database
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '5432', 10),
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_NAME: process.env.DB_NAME || 'gym_tracker',
  DB_DEBUG: process.env.DB_DEBUG === 'true',

  // Auth
  AUTH_PIN: process.env.AUTH_PIN || '1234',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '90d',

  // Server
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',

  get isDev() {
    return this.NODE_ENV === 'development';
  },
};

// Validate required env vars at startup
const required = ['DB_USER', 'DB_PASSWORD', 'JWT_SECRET'];
const missing = required.filter((key) => !env[key]);

if (missing.length > 0) {
  console.error(`[env] Missing required environment variables: ${missing.join(', ')}`);
  if (env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

module.exports = env;
