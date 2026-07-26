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
   * @param {{
   *   planId?: string|null,
   *   planName: string,
   *   status?: string,
   *   startedAt?: Date,
   *   completedAt?: Date,
   *   notes?: string,
   *   wasMakeUpSession?: boolean,
   *   sessionType?: string,
   *   cardioDurationSeconds?: number|null,
   *   cardioSpeed?: number|null,
   *   cardioIncline?: number|null
   * }} data
   * @returns {Promise<Object>}
   */
  async createSession(data) {
    const [row] = await db('workout_sessions')
      .insert({
        plan_id: data.planId || null,
        plan_name: data.planName,
        status: data.status || 'active',
        started_at: data.startedAt || new Date(),
        completed_at: data.completedAt || (data.status === 'completed' ? new Date() : null),
        notes: data.notes || null,
        was_make_up_session: data.wasMakeUpSession || false,
        session_type: data.sessionType || 'gym',
        cardio_duration_seconds: data.cardioDurationSeconds || null,
        cardio_speed: data.cardioSpeed || null,
        cardio_incline: data.cardioIncline || null,
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
   * Find a completed session completed between two timestamps.
   * @param {Date} startDate
   * @param {Date} endDate
   * @returns {Promise<Object|undefined>}
   */
  async findCompletedBetween(startDate, endDate) {
    return db('workout_sessions')
      .where({ status: 'completed' })
      .where('completed_at', '>=', startDate)
      .where('completed_at', '<=', endDate)
      .first();
  },

  /**
   * Find all completed sessions completed between two timestamps.
   * @param {Date} startDate
   * @param {Date} endDate
   * @returns {Promise<Array>}
   */
  async findCompletedSessionsBetween(startDate, endDate) {
    return db('workout_sessions')
      .where({ status: 'completed' })
      .where('completed_at', '>=', startDate)
      .where('completed_at', '<=', endDate);
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
        reps: data.reps || null,
        weight_kg: data.weightKg || null,
        duration_seconds: data.durationSeconds || null,
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

  /**
   * Find the last completed set for each given exercise name
   * (from all completed sessions, not the current one).
   * Used to pre-fill smart defaults when a new session starts.
   *
   * @param {string[]} exerciseNames
   * @param {string} excludeSessionId — the session currently being created (exclude it)
   * @returns {Promise<Map<string, { reps: number, weight_kg: number|null }>>}
   */
  async findLastCompletedSets(exerciseNames, excludeSessionId) {
    if (!exerciseNames.length) return new Map();

    const rows = await db('workout_session_sets as s')
      .join('workout_sessions as ws', 's.session_id', 'ws.id')
      .whereIn('s.exercise_name', exerciseNames)
      .where('s.is_completed', true)
      .where('ws.status', 'completed')
      .whereNot('s.session_id', excludeSessionId)
      .orderBy('s.completed_at', 'desc')
      .select('s.exercise_name', 's.reps', 's.weight_kg', 's.duration_seconds', 's.completed_at');

    // For each exercise name, keep only the most recent completed set
    const map = new Map();
    for (const row of rows) {
      if (!map.has(row.exercise_name)) {
        map.set(row.exercise_name, {
          reps: row.reps,
          weightKg: row.weight_kg ? parseFloat(row.weight_kg) : null,
          durationSeconds: row.duration_seconds || null,
        });
      }
    }
    return map;
  },

  /**
   * Find the last completed set for a specific exercise across all completed sessions
   * (used for comparison after recording a new set).
   * @param {string} exerciseName
   * @param {string} excludeSessionId — exclude current session
   * @returns {Promise<{ reps: number, weight_kg: number|null }|null>}
   */
  async findLastSetForExercise(exerciseName, excludeSessionId) {
    return db('workout_session_sets as s')
      .join('workout_sessions as ws', 's.session_id', 'ws.id')
      .where('s.exercise_name', exerciseName)
      .where('s.is_completed', true)
      .where('ws.status', 'completed')
      .whereNot('s.session_id', excludeSessionId)
      .orderBy('s.completed_at', 'desc')
      .select('s.reps', 's.weight_kg', 's.duration_seconds')
      .first();
  },

  /**
   * Get the all-time best (max) duration for a time-based exercise.
   * @param {string} exerciseName
   * @param {string} excludeSessionId
   * @returns {Promise<number|null>}
   */
  async findBestDurationForExercise(exerciseName, excludeSessionId) {
    const row = await db('workout_session_sets as s')
      .join('workout_sessions as ws', 's.session_id', 'ws.id')
      .where('s.exercise_name', exerciseName)
      .where('s.is_completed', true)
      .where('ws.status', 'completed')
      .whereNot('s.session_id', excludeSessionId)
      .whereNotNull('s.duration_seconds')
      .max('s.duration_seconds as best')
      .first();
    return row && row.best !== null ? parseInt(row.best, 10) : null;
  },
};

module.exports = sessionRepository;
