'use strict';

const path = require('path');
const fs = require('fs');

/**
 * Migration 014 — Seed Master Activities from free-exercise-db
 *
 * Reads exercises.json from backend/data/ (873 exercises from the
 * public-domain yuhonas/free-exercise-db, forked at ericanthonywu/free-exercise-db).
 *
 * Image paths are stored as-is; clients construct the full URL by prefixing:
 *   https://raw.githubusercontent.com/ericanthonywu/free-exercise-db/main/exercises/
 *
 * Activity type mapping:
 *   stretching | cardio  → 'time'
 *   everything else      → 'reps'
 *
 * Strategy:
 *  - Match existing rows by name (case-insensitive) and ENRICH them
 *  - Insert rows that don't exist yet
 *  - Upsert activity_muscles for all primary + secondary muscles
 */

const IMAGE_BASE = 'https://raw.githubusercontent.com/ericanthonywu/free-exercise-db/main/exercises/';

function toActivityType(category) {
  if (!category) return 'reps';
  const lower = category.toLowerCase();
  return lower === 'stretching' || lower === 'cardio' ? 'time' : 'reps';
}

/**
 * Map free-exercise-db category → a high-level category label used in the app.
 * Keeps the original category string but normalized to title case.
 */
function normalizeCategory(category) {
  if (!category) return null;
  return category
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

exports.up = async function (knex) {
  const dataPath = path.join(__dirname, '../data/exercises.json');
  if (!fs.existsSync(dataPath)) {
    throw new Error(
      `[014_seed] exercises.json not found at ${dataPath}. ` +
      'Run: curl -sL https://raw.githubusercontent.com/ericanthonywu/free-exercise-db/main/dist/exercises.json -o backend/data/exercises.json'
    );
  }

  const exercises = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  console.log(`[014_seed] Loaded ${exercises.length} exercises from ${dataPath}`);

  // Load existing activities once for fast lookup
  const existingRows = await knex('master_activities').select('id', 'name');
  const existingMap = new Map(existingRows.map((r) => [r.name.trim().toLowerCase(), r.id]));

  let inserted = 0;
  let enriched = 0;
  let muscleRows = 0;

  for (const ex of exercises) {
    const name = ex.name ? ex.name.trim() : null;
    if (!name) continue;

    const activityType = toActivityType(ex.category);
    const images = Array.isArray(ex.images) ? ex.images : [];
    const imageUrl0 = images[0] ? `${IMAGE_BASE}${images[0]}` : null;
    const imageUrl1 = images[1] ? `${IMAGE_BASE}${images[1]}` : null;
    const instructions = ex.instructions ? JSON.stringify(ex.instructions) : null;
    const primaryMuscles = Array.isArray(ex.primaryMuscles) ? ex.primaryMuscles : [];
    const secondaryMuscles = Array.isArray(ex.secondaryMuscles) ? ex.secondaryMuscles : [];
    const mainMuscle = primaryMuscles[0] || null; // backward-compat muscle_group

    const activityData = {
      name,
      category: normalizeCategory(ex.category),
      muscle_group: mainMuscle,
      activity_type: activityType,
      equipment: ex.equipment || null,
      level: ex.level || null,
      force: ex.force || null,
      mechanic: ex.mechanic || null,
      image_url_0: imageUrl0,
      image_url_1: imageUrl1,
      instructions,
      source_id: ex.id || null,
    };

    let activityId = existingMap.get(name.toLowerCase());

    if (activityId) {
      // Enrich existing row
      await knex('master_activities').where({ id: activityId }).update({
        category: activityData.category,
        muscle_group: activityData.muscle_group,
        equipment: activityData.equipment,
        level: activityData.level,
        force: activityData.force,
        mechanic: activityData.mechanic,
        image_url_0: activityData.image_url_0,
        image_url_1: activityData.image_url_1,
        instructions: activityData.instructions,
        source_id: activityData.source_id,
        // Don't overwrite activity_type if user changed it manually
      });
      enriched++;
    } else {
      // Insert new activity
      const [newRow] = await knex('master_activities').insert(activityData).returning('id');
      activityId = newRow.id || newRow; // handle both object and scalar returns
      existingMap.set(name.toLowerCase(), activityId);
      inserted++;
    }

    // Upsert activity_muscles (primary + secondary)
    const allMuscles = [
      ...primaryMuscles.map((m) => ({ muscle_name: m.toLowerCase(), is_primary: true })),
      ...secondaryMuscles.map((m) => ({ muscle_name: m.toLowerCase(), is_primary: false })),
    ];

    for (const muscle of allMuscles) {
      await knex('activity_muscles')
        .insert({ activity_id: activityId, ...muscle })
        .onConflict(['activity_id', 'muscle_name'])
        .merge({ is_primary: muscle.is_primary }); // update is_primary if conflict
      muscleRows++;
    }
  }

  console.log(
    `[014_seed] Done: ${inserted} inserted, ${enriched} enriched, ${muscleRows} muscle rows upserted.`
  );
};

exports.down = async function (knex) {
  // Remove only rows that came from the dataset (have a source_id)
  const sourceRows = await knex('master_activities').whereNotNull('source_id').select('id');
  const ids = sourceRows.map((r) => r.id);

  if (ids.length > 0) {
    // Muscle rows cascade via FK
    await knex('master_activities').whereIn('id', ids).del();
  }

  // Also nullify enrichment columns on remaining rows
  await knex('master_activities').whereNull('source_id').update({
    equipment: null,
    level: null,
    force: null,
    mechanic: null,
    image_url_0: null,
    image_url_1: null,
    instructions: null,
  });
};
