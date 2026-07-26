'use strict';

/**
 * Migration 010 — Activity Type & Duration Support
 *
 * Adds:
 *  - master_activities.activity_type ('reps' | 'time', default 'reps')
 *  - workout_plan_exercises.activity_type + target_duration_seconds
 *  - workout_session_sets.duration_seconds (actual performed duration)
 *  - workout_session_sets.default_duration_seconds (from previous session)
 *  - workout_session_sets.activity_type (carried from plan)
 */
exports.up = async function (knex) {
  // 1. master_activities: add activity_type
  await knex.schema.alterTable('master_activities', (t) => {
    t.string('activity_type', 20).notNullable().defaultTo('reps');
  });

  // 2. workout_plan_exercises: add activity_type + target_duration_seconds
  await knex.schema.alterTable('workout_plan_exercises', (t) => {
    t.string('activity_type', 20).notNullable().defaultTo('reps');
    t.integer('target_duration_seconds').nullable();
  });

  // 3. workout_session_sets: add duration columns + activity_type
  await knex.schema.alterTable('workout_session_sets', (t) => {
    t.integer('duration_seconds').nullable();
    t.integer('default_duration_seconds').nullable();
    t.string('activity_type', 20).notNullable().defaultTo('reps');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('workout_session_sets', (t) => {
    t.dropColumn('activity_type');
    t.dropColumn('default_duration_seconds');
    t.dropColumn('duration_seconds');
  });
  await knex.schema.alterTable('workout_plan_exercises', (t) => {
    t.dropColumn('target_duration_seconds');
    t.dropColumn('activity_type');
  });
  await knex.schema.alterTable('master_activities', (t) => {
    t.dropColumn('activity_type');
  });
};
