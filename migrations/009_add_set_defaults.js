'use strict';

/**
 * Migration 009 — Add default reps/weight columns to workout_session_sets
 * These are pre-populated when a session starts from the last completed session,
 * letting the UI show "Last time: X reps @ Y kg" as smart defaults.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('workout_session_sets', (t) => {
    t.integer('default_reps').nullable();           // last session's reps for this exercise
    t.decimal('default_weight_kg', 6, 2).nullable(); // last session's weight for this exercise
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('workout_session_sets', (t) => {
    t.dropColumn('default_reps');
    t.dropColumn('default_weight_kg');
  });
};
