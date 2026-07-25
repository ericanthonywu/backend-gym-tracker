'use strict';

const db = require('../config/database');

/**
 * Workout Plan Repository — all DB access for plans and exercises.
 * Returns plain objects. No business logic.
 */
const workoutPlanRepository = {
  /**
   * @returns {Promise<Array>}
   */
  async findAll() {
    return db('workout_plans').orderBy('created_at', 'desc');
  },

  /**
   * @param {string} id
   * @returns {Promise<Object|undefined>}
   */
  async findById(id) {
    return db('workout_plans').where({ id }).first();
  },

  /**
   * @param {string} id
   * @returns {Promise<Array>} exercises ordered by sort_order
   */
  async findExercises(id) {
    return db('workout_plan_exercises')
      .where({ plan_id: id })
      .orderBy('sort_order', 'asc');
  },

  /**
   * @param {{ name: string }} data
   * @returns {Promise<Object>}
   */
  async create(data) {
    const now = new Date();
    const [row] = await db('workout_plans')
      .insert({ name: data.name, created_at: now, updated_at: now })
      .returning('*');
    return row;
  },

  /**
   * @param {string} id
   * @param {{ name: string }} data
   * @returns {Promise<Object|undefined>}
   */
  async update(id, data) {
    const [row] = await db('workout_plans')
      .where({ id })
      .update({ name: data.name, updated_at: new Date() })
      .returning('*');
    return row;
  },

  /**
   * @param {string} id
   */
  async delete(id) {
    return db('workout_plans').where({ id }).delete();
  },

  /**
   * Delete all exercises for a plan (used before re-inserting on update).
   * @param {string} planId
   */
  async deleteExercises(planId) {
    return db('workout_plan_exercises').where({ plan_id: planId }).delete();
  },

  /**
   * Bulk-insert exercises for a plan.
   * @param {Array<{ planId: string, name: string, targetSets: number, targetReps: number, sortOrder: number }>} exercises
   * @returns {Promise<Array>}
   */
  async insertExercises(exercises) {
    if (!exercises.length) return [];
    const rows = exercises.map((e) => ({
      plan_id: e.planId,
      name: e.name,
      target_sets: e.targetSets,
      target_reps: e.targetReps,
      sort_order: e.sortOrder,
      created_at: new Date(),
    }));
    return db('workout_plan_exercises').insert(rows).returning('*');
  },
};

module.exports = workoutPlanRepository;
