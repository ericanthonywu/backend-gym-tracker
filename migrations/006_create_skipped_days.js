'use strict';

/**
 * Migration 006 — Skipped Days
 * Tracks when a scheduled workout was skipped so the cascade carry-forward
 * logic knows which plans to push forward.
 */
exports.up = async function (knex) {
  await knex.schema.createTable('skipped_days', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.date('original_date').notNullable();       // the date that was skipped
    t.uuid('plan_id').nullable().references('id').inTable('workout_plans').onDelete('SET NULL');
    t.string('plan_name', 255).notNullable();    // denormalized for display
    t.date('rescheduled_to').nullable();         // the date it was pushed to
    t.boolean('is_completed').notNullable().defaultTo(false);
    t.boolean('is_dismissed').notNullable().defaultTo(false); // user dismissed the banner
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('skipped_days');
};
