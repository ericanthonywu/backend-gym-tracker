'use strict';

const env = require('./src/config/env');

/**
 * Knex configuration for migrations and seeds.
 * @type { import("knex").Knex.Config }
 */
module.exports = {
  client: 'pg',
  connection: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  },
  migrations: {
    directory: './migrations',
    tableName: 'knex_migrations',
  },
};
