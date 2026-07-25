'use strict';

/**
 * Migration 002 — Weekly Schedule
 * day_of_week: 0=Monday, 1=Tuesday, ..., 6=Sunday
 */
exports.up = async function (knex) {
  await knex.schema.createTable('weekly_schedule', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.integer('day_of_week').notNullable().checkBetween([0, 6]);
    t.uuid('plan_id').nullable().references('id').inTable('workout_plans').onDelete('SET NULL');
    t.boolean('is_rest_day').notNullable().defaultTo(false);
    t.unique(['day_of_week']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('weekly_schedule');
};
