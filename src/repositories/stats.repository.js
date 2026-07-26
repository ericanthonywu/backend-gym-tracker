'use strict';

const db = require('../config/database');

/**
 * Stats Repository — queries for exercise progress time-series data.
 */
const statsRepository = {
  /**
   * Get all distinct exercise names that have at least one completed set.
   * Returns them ordered alphabetically.
   * @returns {Promise<string[]>}
   */
  async findDistinctExercises() {
    const rows = await db('workout_session_sets')
      .where({ is_completed: true })
      .distinct('exercise_name')
      .orderBy('exercise_name', 'asc')
      .select('exercise_name');
    return rows.map((r) => r.exercise_name);
  },

  /**
   * Get time-series progress for a specific exercise.
   * Groups by session date (the session's started_at date), returning the
   * max weight, total reps, and avg reps recorded per session.
   *
   * @param {string} exerciseName — exact match on exercise_name
   * @param {number} [limitDays] — if provided, restricts to last N days
   * @returns {Promise<Array<{ date: string, maxWeightKg: number|null, totalReps: number, avgReps: number, sessionCount: number }>>}
   */
  async findExerciseProgress(exerciseName, limitDays) {
    let query = db('workout_session_sets as s')
      .join('workout_sessions as ws', 's.session_id', 'ws.id')
      .where('s.exercise_name', exerciseName)
      .where('s.is_completed', true)
      .where('ws.status', 'completed');

    if (limitDays) {
      const since = new Date();
      since.setDate(since.getDate() - limitDays);
      query = query.where('ws.started_at', '>=', since);
    }

    const rows = await query
      .groupByRaw("DATE(ws.started_at), ws.id")
      .orderByRaw("DATE(ws.started_at) ASC")
      .select(
        db.raw("DATE(ws.started_at) as date"),
        db.raw("MAX(s.weight_kg) as max_weight_kg"),
        db.raw("SUM(s.reps) as total_reps"),
        db.raw("ROUND(AVG(s.reps), 1) as avg_reps"),
        db.raw("COUNT(s.id) as set_count"),
      );

    return rows.map((r) => ({
      date: r.date,
      maxWeightKg: r.max_weight_kg ? parseFloat(r.max_weight_kg) : null,
      totalReps: parseInt(r.total_reps, 10) || 0,
      avgReps: parseFloat(r.avg_reps) || 0,
      setCount: parseInt(r.set_count, 10) || 0,
    }));
  },

  /**
   * Personal bests for an exercise.
   * @param {string} exerciseName
   * @returns {Promise<{ bestWeightKg: number|null, bestReps: number|null, totalSessions: number }>}
   */
  async findPersonalBests(exerciseName) {
    const [row] = await db('workout_session_sets as s')
      .join('workout_sessions as ws', 's.session_id', 'ws.id')
      .where('s.exercise_name', exerciseName)
      .where('s.is_completed', true)
      .where('ws.status', 'completed')
      .select(
        db.raw("MAX(s.weight_kg) as best_weight_kg"),
        db.raw("MAX(s.reps) as best_reps"),
        db.raw("COUNT(DISTINCT ws.id) as total_sessions"),
      );

    return {
      bestWeightKg: row.best_weight_kg ? parseFloat(row.best_weight_kg) : null,
      bestReps: row.best_reps ? parseInt(row.best_reps, 10) : null,
      totalSessions: parseInt(row.total_sessions, 10) || 0,
    };
  },
};

module.exports = statsRepository;
