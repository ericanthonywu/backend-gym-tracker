'use strict';

/**
 * Migration 013 — Enrich Master Activities & Activity Muscles
 *
 * Adds new columns to master_activities for exercise metadata (equipment,
 * level, force, mechanic, images, instructions, source ID).
 *
 * Creates activity_muscles junction table to support multiple target muscles
 * per exercise (primary + secondary).
 */
exports.up = async function (knex) {
  // 1. Enrich master_activities with new metadata columns
  await knex.schema.alterTable('master_activities', (t) => {
    t.string('equipment', 100).nullable();       // e.g. "barbell", "dumbbell", "body only"
    t.string('level', 50).nullable();            // "beginner", "intermediate", "expert"
    t.string('force', 50).nullable();            // "push", "pull", "static"
    t.string('mechanic', 50).nullable();         // "compound", "isolation"
    t.text('image_url_0').nullable();            // first form image path (start position)
    t.text('image_url_1').nullable();            // second form image path (end position)
    t.text('instructions').nullable();           // JSON array of instruction steps
    t.string('source_id', 255).nullable();       // original ID from dataset (for dedup)
  });

  // 2. Create activity_muscles junction table
  await knex.schema.createTable('activity_muscles', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('activity_id').notNullable()
      .references('id').inTable('master_activities').onDelete('CASCADE');
    t.string('muscle_name', 100).notNullable();  // e.g. "chest", "biceps"
    t.boolean('is_primary').notNullable().defaultTo(true);
    t.unique(['activity_id', 'muscle_name']);
  });

  // 3. Add index for fast muscle-based lookups
  await knex.schema.alterTable('activity_muscles', (t) => {
    t.index(['muscle_name', 'is_primary'], 'idx_activity_muscles_muscle_primary');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('activity_muscles');

  await knex.schema.alterTable('master_activities', (t) => {
    t.dropColumn('source_id');
    t.dropColumn('instructions');
    t.dropColumn('image_url_1');
    t.dropColumn('image_url_0');
    t.dropColumn('mechanic');
    t.dropColumn('force');
    t.dropColumn('level');
    t.dropColumn('equipment');
  });
};
