'use strict';

/**
 * Migration 011 — Add session_type and cardio details to workout_sessions
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('workout_sessions', (t) => {
    t.string('session_type', 20).notNullable().defaultTo('gym'); // 'gym' | 'rest_day' | 'cardio'
    t.integer('cardio_duration_seconds').nullable();
    t.decimal('cardio_speed', 5, 2).nullable();
    t.decimal('cardio_incline', 4, 1).nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('workout_sessions', (t) => {
    t.dropColumn('cardio_incline');
    t.dropColumn('cardio_speed');
    t.dropColumn('cardio_duration_seconds');
    t.dropColumn('session_type');
  });
};
