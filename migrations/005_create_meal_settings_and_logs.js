'use strict';

/**
 * Migration 005 — Meal Settings & Meal Logs
 * User configures their own meal slots (e.g. Breakfast, Lunch, Snack, Dinner).
 * Each slot is checked off per day.
 */
exports.up = async function (knex) {
  // User-defined meal slots (configurable: name, order, active toggle)
  await knex.schema.createTable('meal_settings', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 255).notNullable(); // "Breakfast", "Lunch", "Snack 1", etc.
    t.integer('sort_order').notNullable().defaultTo(0);
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });

  // Per-slot, per-day check-in
  await knex.schema.createTable('meal_logs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('meal_setting_id').notNullable().references('id').inTable('meal_settings').onDelete('CASCADE');
    t.date('log_date').notNullable();
    t.boolean('is_checked').notNullable().defaultTo(false);
    t.unique(['meal_setting_id', 'log_date']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('meal_logs');
  await knex.schema.dropTableIfExists('meal_settings');
};
