'use strict';

const db = require('../config/database');

/**
 * Session Repository — all DB access for workout sessions and sets.
 * Returns plain objects. No business logic.
 */
const sessionRepository = {
  // ---------------------------------------------------------------------------
  // Sessions
  // ---------------------------------------------------------------------------

  /**
   * @returns {Promise<Object|undefined>} the active session (status='active')
   */
  async findActive() {
    return db('workout_sessions').where({ status: 'active' }).orderBy('started_at', 'desc').first();
  },

  /**
   * @param {string} id
   * @returns {Promise<Object|undefined>}
   */
  async findById(id) {
    return db('workout_sessions').where({ id }).first();
  },

  /**
   * @param {{ planId: string|null, planName: string, wasMakeUpSession: boolean }} data
   * @returns {Promise<Object>}
   */
  async createSession(data) {
    const [row] = await db('workout_sessions')
      .insert({
        plan_id: data.planId || null,
        plan_name: data.planName,
        status: 'active',
        started_at: new Date(),
        was_make_up_session: data.wasMakeUpSession || false,
      })
      .returning('*');
    return row;
  },

  /**
   * @param {string} id
   * @param {{ status: string, completedAt?: Date, notes?: string }} data
   * @returns {Promise<Object|undefined>}
   */
  async updateSession(id, data) {
    const updates = {};
    if (data.status) updates.status = data.status;
    if (data.completedAt) updates.completed_at = data.completedAt;
    if (data.notes !== undefined) updates.notes = data.notes;

    const [row] = await db('workout_sessions').where({ id }).update(updates).returning('*');
    return row;
  },

  /**
   * @param {string} id
   * @returns {Promise<number>} number of deleted rows
   */
  async deleteSession(id) {
    return db('workout_sessions').where({ id }).del();
  },

  /**
   * Paginated history of completed sessions.
   * @param {{ limit: number, offset: number }} opts
   * @returns {Promise<{ data: Array, total: number }>}
   */
  async findHistory({ limit = 20, offset = 0 } = {}) {
    const data = await db('workout_sessions')
      .where({ status: 'completed' })
      .orderBy('completed_at', 'desc')
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db('workout_sessions').where({ status: 'completed' }).count('id as count');
    return { data, total: parseInt(count, 10) };
  },

  // ---------------------------------------------------------------------------
  // Sets
  // ---------------------------------------------------------------------------

  /**
   * @param {string} sessionId
   * @returns {Promise<Array>} ordered by sort_order, set_number
   */
  async findSets(sessionId) {
    return db('workout_session_sets')
      .where({ session_id: sessionId })
      .orderBy([{ column: 'sort_order', order: 'asc' }, { column: 'set_number', order: 'asc' }]);
  },

  /**
   * Bulk-insert pre-generated sets when a session starts.
   * @param {Array<Object>} sets
   * @returns {Promise<Array>}
   */
  async insertSets(sets) {
    if (!sets.length) return [];
    return db('workout_session_sets').insert(sets).returning('*');
  },

  /**
   * @param {string} setId
   * @returns {Promise<Object|undefined>}
   */
  async findSetById(setId) {
    return db('workout_session_sets').where({ id: setId }).first();
  },

  /**
   * Record reps + weight for a set (mark as completed).
   * @param {string} setId
   * @param {{ reps: number, weightKg: number|null }} data
   * @returns {Promise<Object|undefined>}
   */
  async completeSet(setId, data) {
    const [row] = await db('workout_session_sets')
      .where({ id: setId })
      .update({
        reps: data.reps,
        weight_kg: data.weightKg || null,
        is_completed: true,
        completed_at: new Date(),
      })
      .returning('*');
    return row;
  },

  /**
   * Mark all sets of an exercise as skipped (by session + exercise name).
   * @param {string} sessionId
   * @param {string} exerciseName
   * @returns {Promise<number>} number of rows updated
   */
  async skipExercise(sessionId, exerciseName) {
    return db('workout_session_sets')
      .where({ session_id: sessionId, exercise_name: exerciseName })
      .whereNot({ is_completed: true })
      .update({ is_skipped: true });
  },

  /**
   * Re-enable a previously skipped exercise (un-skip all its sets).
   * @param {string} sessionId
   * @param {string} exerciseName
   * @returns {Promise<number>}
   */
  async reEnableExercise(sessionId, exerciseName) {
    return db('workout_session_sets')
      .where({ session_id: sessionId, exercise_name: exerciseName, is_skipped: true })
      .update({ is_skipped: false });
  },

  /**
   * Get names of all skipped exercises in a session.
   * @param {string} sessionId
   * @returns {Promise<string[]>}
   */
  async findSkippedExerciseNames(sessionId) {
    const rows = await db('workout_session_sets')
      .where({ session_id: sessionId, is_skipped: true })
      .distinct('exercise_name')
      .select('exercise_name');
    return rows.map((r) => r.exercise_name);
  },
};

module.exports = sessionRepository;
