'use strict';

/**
 * Migration 003 — Workout Sessions & Sets
 */
exports.up = async function (knex) {
  // A single workout instance (one gym visit)
  await knex.schema.createTable('workout_sessions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('plan_id').nullable().references('id').inTable('workout_plans').onDelete('SET NULL');
    t.string('plan_name', 255).notNullable(); // denormalized for history
    t.string('status', 20).notNullable().defaultTo('active'); // active | completed | cancelled
    t.timestamp('started_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('completed_at').nullable();
    t.text('notes').nullable();
    t.boolean('was_make_up_session').notNullable().defaultTo(false); // true if skipped-day make-up
  });

  // Individual sets within a session (pre-generated when session starts)
  await knex.schema.createTable('workout_session_sets', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('session_id').notNullable().references('id').inTable('workout_sessions').onDelete('CASCADE');
    t.string('exercise_name', 255).notNullable();
    t.integer('sort_order').notNullable().defaultTo(0); // exercise order
    t.integer('set_number').notNullable(); // 1, 2, 3, 4
    t.integer('reps').nullable(); // actual reps performed
    t.decimal('weight_kg', 6, 2).nullable(); // weight used
    t.boolean('is_skipped').notNullable().defaultTo(false);
    t.boolean('is_completed').notNullable().defaultTo(false);
    t.integer('rest_duration_seconds').notNullable().defaultTo(120); // default 2 min
    t.timestamp('completed_at').nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('workout_session_sets');
  await knex.schema.dropTableIfExists('workout_sessions');
};
