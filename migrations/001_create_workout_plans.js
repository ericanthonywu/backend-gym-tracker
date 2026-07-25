'use strict';

/**
 * Migration 001 — Workout Plans & Exercises
 */
exports.up = async function (knex) {
  // Workout plans (e.g. "Leg Day", "Push Day")
  await knex.schema.createTable('workout_plans', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 255).notNullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  // Exercises within a plan
  await knex.schema.createTable('workout_plan_exercises', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('plan_id').notNullable().references('id').inTable('workout_plans').onDelete('CASCADE');
    t.string('name', 255).notNullable();
    t.integer('target_sets').notNullable().defaultTo(4);
    t.integer('target_reps').notNullable().defaultTo(12);
    t.integer('sort_order').notNullable().defaultTo(0);
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('workout_plan_exercises');
  await knex.schema.dropTableIfExists('workout_plans');
};
