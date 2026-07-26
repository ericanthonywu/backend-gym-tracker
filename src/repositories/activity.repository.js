'use strict';

const db = require('../config/database');

/**
 * Activity Repository — DB access for master_activities.
 */
const activityRepository = {
  /**
   * List all activities ordered alphabetically.
   * @returns {Promise<Array>}
   */
  async findAll() {
    return db('master_activities').orderBy('name', 'asc');
  },

  /**
   * Search activities by name (case-insensitive prefix/contains match).
   * @param {string} query
   * @returns {Promise<Array>}
   */
  async search(query) {
    return db('master_activities')
      .whereILike('name', `%${query}%`)
      .orderByRaw(`CASE WHEN lower(name) LIKE lower(?) THEN 0 ELSE 1 END`, [`${query}%`])
      .orderBy('name', 'asc')
      .limit(20);
  },

  /**
   * Find by exact name (case-insensitive).
   * @param {string} name
   * @returns {Promise<Object|undefined>}
   */
  async findByName(name) {
    return db('master_activities').whereRaw('lower(name) = lower(?)', [name.trim()]).first();
  },

  /**
   * Find by ID.
   * @param {string} id
   * @returns {Promise<Object|undefined>}
   */
  async findById(id) {
    return db('master_activities').where({ id }).first();
  },

  /**
   * Create a new master activity.
   * @param {{ name: string, category?: string, muscleGroup?: string }} data
   * @returns {Promise<Object>}
   */
  async create(data) {
    const [row] = await db('master_activities')
      .insert({
        name: data.name.trim(),
        category: data.category || null,
        muscle_group: data.muscleGroup || null,
        activity_type: data.activityType || 'reps',
      })
      .returning('*');
    return row;
  },

  /**
   * Find or create — returns existing if name matches (case-insensitive).
   * @param {string} name
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
