'use strict';

/**
 * Migration 008 — Seed Master Activities from existing data
 * Reads all distinct exercise names from workout_session_sets and
 * workout_plan_exercises, deduplicates (case-insensitive trim), inserts
 * into master_activities, then back-fills activity_id on plan exercises.
 */
exports.up = async function (knex) {
  // Collect distinct names from both sources
  const fromSets = await knex('workout_session_sets')
    .distinct('exercise_name')
    .whereNotNull('exercise_name')
    .select('exercise_name');

  const fromPlanExercises = await knex('workout_plan_exercises')
    .distinct('name')
    .whereNotNull('name')
    .select('name');

  // Deduplicate (case-insensitive)
  const nameSet = new Map();
  const allNames = [
    ...fromSets.map((r) => r.exercise_name),
    ...fromPlanExercises.map((r) => r.name),
  ];
  for (const rawName of allNames) {
    const trimmed = rawName.trim();
    const key = trimmed.toLowerCase();
    if (trimmed && !nameSet.has(key)) {
      nameSet.set(key, trimmed);
    }
  }

  if (nameSet.size === 0) return; // nothing to seed

  // Insert into master_activities (ignore conflicts)
  const rows = Array.from(nameSet.values()).map((name) => ({ name }));
  await knex('master_activities').insert(rows).onConflict('name').ignore();

  // Back-fill activity_id on workout_plan_exercises
  const activities = await knex('master_activities').select('id', 'name');
  const activityMap = new Map(activities.map((a) => [a.name.toLowerCase(), a.id]));

  const planExercises = await knex('workout_plan_exercises')
    .whereNull('activity_id')
    .select('id', 'name');

  for (const ex of planExercises) {
    const actId = activityMap.get(ex.name.trim().toLowerCase());
    if (actId) {
      await knex('workout_plan_exercises').where({ id: ex.id }).update({ activity_id: actId });
    }
  }
};

exports.down = async function (knex) {
  // Reset activity_id back to null and clear seeded master activities
  await knex('workout_plan_exercises').update({ activity_id: null });
  await knex('master_activities').del();
};
