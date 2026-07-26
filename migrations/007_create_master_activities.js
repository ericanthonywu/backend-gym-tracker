'use strict';

/**
 * Migration 007 — Master Activities
 * Introduces a canonical activity table so all exercise names are consistent
 * and queryable for progress statistics.
 */
exports.up = async function (knex) {
  // Canonical activity list
  await knex.schema.createTable('master_activities', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 255).notNullable().unique();
    t.string('category', 100).nullable();      // e.g. Legs, Push, Pull, Core, Cardio
    t.string('muscle_group', 100).nullable();  // e.g. Quads, Chest, Back, Shoulders
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });

  // Add FK column to plan exercises (nullable so old rows aren't broken)
  await knex.schema.alterTable('workout_plan_exercises', (t) => {
    t.uuid('activity_id').nullable().references('id').inTable('master_activities').onDelete('SET NULL');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('workout_plan_exercises', (t) => {
    t.dropColumn('activity_id');
  });
  await knex.schema.dropTableIfExists('master_activities');
};
