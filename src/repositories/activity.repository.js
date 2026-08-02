'use strict';

const db = require('../config/database');

const IMAGE_BASE =
  'https://raw.githubusercontent.com/ericanthonywu/free-exercise-db/main/exercises/';

/**
 * Activity Repository — DB access for master_activities.
 *
 * All public methods return activities with an attached `muscles` array:
 *   { is_primary: true, muscle_name: 'chest' }
 *
 * image_url_0 / image_url_1 are already full URLs stored in the DB.
 */
const activityRepository = {
  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Attach muscle rows to a list of activity objects.
   * Replaces N+1 queries with a single IN-based fetch.
   * @param {Array} activities
   * @returns {Promise<Array>}
   */
  async _attachMuscles(activities) {
    if (!activities || activities.length === 0) return activities;

    const ids = activities.map((a) => a.id);
    const muscles = await db('activity_muscles')
      .whereIn('activity_id', ids)
      .select('activity_id', 'muscle_name', 'is_primary')
      .orderBy([{ column: 'is_primary', order: 'desc' }, { column: 'muscle_name' }]);

    const muscleMap = new Map();
    for (const m of muscles) {
      if (!muscleMap.has(m.activity_id)) muscleMap.set(m.activity_id, []);
      muscleMap.get(m.activity_id).push({ muscle_name: m.muscle_name, is_primary: m.is_primary });
    }

    return activities.map((a) => ({
      ...a,
      muscles: muscleMap.get(a.id) || [],
    }));
  },

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * List all activities ordered alphabetically, with muscle data attached.
   * @returns {Promise<Array>}
   */
  async findAll() {
    const rows = await db('master_activities').orderBy('name', 'asc');
    return this._attachMuscles(rows);
  },

  /**
   * Search activities by name (case-insensitive contains match).
   * Optionally filter by muscle group and/or category.
   * @param {string} query
   * @param {string|null} muscle  - e.g. 'chest', 'biceps'
   * @param {string|null} category  - e.g. 'strength', 'cardio'
   * @returns {Promise<Array>}
   */
  async search(query, muscle = null, category = null) {
    let qb = db('master_activities');

    if (query && query.trim().length > 0) {
      qb = qb.whereILike('name', `%${query}%`).orderByRaw(
        `CASE WHEN lower(name) LIKE lower(?) THEN 0 ELSE 1 END`,
        [`${query}%`]
      );
    }

    if (muscle && muscle.trim().length > 0) {
      const muscleClean = muscle.trim().toLowerCase();
      qb = qb.whereIn('id', function () {
        this.select('activity_id')
          .from('activity_muscles')
          .where(db.raw('lower(muscle_name)'), muscleClean);
      });
    }

    if (category && category.trim().length > 0) {
      qb = qb.whereILike('category', category.trim());
    }

    const rows = await qb.orderBy('name', 'asc').limit(50);
    return this._attachMuscles(rows);
  },

  /**
   * Find all activities whose PRIMARY muscle matches.
   * @param {string} muscle  - e.g. 'chest'
   * @returns {Promise<Array>}
   */
  async findByPrimaryMuscle(muscle) {
    const muscleClean = muscle.trim().toLowerCase();
    const rows = await db('master_activities')
      .whereIn('id', function () {
        this.select('activity_id')
          .from('activity_muscles')
          .where(db.raw('lower(muscle_name)'), muscleClean)
          .where('is_primary', true);
      })
      .orderBy('name', 'asc');
    return this._attachMuscles(rows);
  },

  /**
   * Find all activities that target a muscle (primary OR secondary).
   * @param {string} muscle
   * @returns {Promise<Array>}
   */
  async findByMuscle(muscle) {
    const muscleClean = muscle.trim().toLowerCase();
    const rows = await db('master_activities')
      .whereIn('id', function () {
        this.select('activity_id')
          .from('activity_muscles')
          .where(db.raw('lower(muscle_name)'), muscleClean);
      })
      .orderBy('name', 'asc');
    return this._attachMuscles(rows);
  },

  /**
   * Return the list of all distinct muscle names available.
   * @returns {Promise<{muscle_name: string, exercise_count: number}[]>}
   */
  async listMuscles() {
    return db('activity_muscles')
      .select('muscle_name')
      .where('is_primary', true)
      .count('* as exercise_count')
      .groupBy('muscle_name')
      .orderBy('muscle_name', 'asc');
  },

  /**
   * Return all distinct exercise categories with counts.
   * @returns {Promise<{category: string, exercise_count: number}[]>}
   */
  async listCategories() {
    return db('master_activities')
      .select('category')
      .whereNotNull('category')
      .count('* as exercise_count')
      .groupBy('category')
      .orderBy('category', 'asc');
  },

  /**
   * Find by exact name (case-insensitive).
   * @param {string} name
   * @returns {Promise<Object|undefined>}
   */
  async findByName(name) {
    const row = await db('master_activities')
      .whereRaw('lower(name) = lower(?)', [name.trim()])
      .first();
    if (!row) return undefined;
    const [enriched] = await this._attachMuscles([row]);
    return enriched;
  },

  /**
   * Find by ID.
   * @param {string} id
   * @returns {Promise<Object|undefined>}
   */
  async findById(id) {
    const row = await db('master_activities').where({ id }).first();
    if (!row) return undefined;
    const [enriched] = await this._attachMuscles([row]);
    return enriched;
  },

  /**
   * Create a new master activity.
   * @param {{ name, category?, muscleGroup?, activityType?, equipment?, level? }} data
   * @returns {Promise<Object>}
   */
  async create(data) {
    const [row] = await db('master_activities')
      .insert({
        name: data.name.trim(),
        category: data.category || null,
        muscle_group: data.muscleGroup || null,
        activity_type: data.activityType || 'reps',
        equipment: data.equipment || null,
        level: data.level || null,
        force: data.force || null,
        mechanic: data.mechanic || null,
      })
      .returning('*');

    // Insert primary muscles if provided
    if (Array.isArray(data.primaryMuscles) && data.primaryMuscles.length > 0) {
      await db('activity_muscles').insert(
        data.primaryMuscles.map((m) => ({
          activity_id: row.id,
          muscle_name: m.toLowerCase(),
          is_primary: true,
        }))
      ).onConflict(['activity_id', 'muscle_name']).ignore();
    }

    const [enriched] = await this._attachMuscles([row]);
    return enriched;
  },

  /**
   * Find or create — returns existing if name matches (case-insensitive).
   * @param {string} name
   * @param {string} activityType
   * @returns {Promise<Object>}
   */
  async findOrCreate(name, activityType) {
    const existing = await this.findByName(name);
    if (existing) {
      if (activityType && existing.activity_type !== activityType) {
        await db('master_activities')
          .where({ id: existing.id })
          .update({ activity_type: activityType });
        existing.activity_type = activityType;
      }
      return existing;
    }
    return this.create({ name, activityType: activityType || 'reps' });
  },
};

module.exports = activityRepository;
