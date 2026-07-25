'use strict';

/**
 * Migration 004 — Weight Logs
 */
exports.up = async function (knex) {
  await knex.schema.createTable('weight_logs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.decimal('weight_kg', 5, 2).notNullable();
    t.timestamp('logged_at').notNullable().defaultTo(knex.fn.now());
    t.text('notes').nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('weight_logs');
};
