'use strict';

const sessionRepository = require('../repositories/session.repository');
const workoutPlanRepository = require('../repositories/workout-plan.repository');
const skippedDayRepository = require('../repositories/skipped-day.repository');
const AppError = require('../utils/app-error');

/**
 * Session Service — business logic for active workout sessions.
 */
const sessionService = {
  /**
   * Start a new workout session from a plan.
   * Pre-generates all sets for every exercise so the UI can track them.
   *
   * @param {{ planId: string, wasMakeUpSession?: boolean, skipId?: string }} data
   * @returns {Promise<Object>} session with all pre-generated sets
   * @throws {AppError} 400 if there's already an active session
   * @throws {AppError} 404 if plan not found
   */
  async start(data) {
    // Prevent concurrent active sessions
    const existing = await sessionRepository.findActive();
    if (existing) throw new AppError('You already have an active workout session! Finish it first.', 400);

    const plan = await workoutPlanRepository.findById(data.planId);
    if (!plan) throw new AppError('Workout plan not found', 404);

    const exercises = await workoutPlanRepository.findExercises(data.planId);
    if (!exercises.length) throw new AppError('This plan has no exercises yet. Add some first!', 400);

    const session = await sessionRepository.createSession({
      planId: plan.id,
      planName: plan.name,
      wasMakeUpSession: data.wasMakeUpSession || false,
    });

    // Pre-generate all sets for every exercise
    const sets = [];
    const exerciseNames = exercises.map((ex) => ex.name);

    // Look up last session's reps/weight for smart defaults
    const lastSets = await sessionRepository.findLastCompletedSets(exerciseNames, session.id);

    exercises.forEach((ex, exIndex) => {
      const prev = lastSets.get(ex.name) || null;
      for (let s = 1; s <= ex.target_sets; s++) {
        sets.push({
          session_id: session.id,
          exercise_name: ex.name,
          sort_order: exIndex,
          set_number: s,
          reps: null,
          weight_kg: null,
          default_reps: prev ? prev.reps : null,
          default_weight_kg: prev ? prev.weightKg : null,
          default_duration_seconds: prev ? (prev.durationSeconds || null) : null,
          activity_type: ex.activity_type || 'reps',
          is_skipped: false,
          is_completed: false,
          rest_duration_seconds: 120,
          completed_at: null,
        });
      }
    });

    await sessionRepository.insertSets(sets);

    // If this session is a make-up for a skipped day, mark the skip as completed
    if (data.skipId) {
      await skippedDayRepository.update(data.skipId, { isCompleted: true });
    }

    return this._buildSessionDetail(session.id);
  },

  /**
   * Get the currently active session.
   * @returns {Promise<Object>}
   * @throws {AppError} 404 if no active session
   */
  async getActive() {
    const session = await sessionRepository.findActive();
    if (!session) throw new AppError('No active workout session', 404);
    return this._buildSessionDetail(session.id);
  },

  /**
   * Record reps + weight for a single set.
   * Returns both the updated set and a comparison vs the previous session.
   * @param {string} sessionId
   * @param {string} setId
   * @param {{ reps: number, weightKg: number|null }} data
   * @returns {Promise<{ set: Object, comparison: Object|null }>}
   */
  async recordSet(sessionId, setId, data) {
    const session = await sessionRepository.findById(sessionId);
    if (!session) throw new AppError('Session not found', 404);
    if (session.status !== 'active') throw new AppError('This session is no longer active', 400);

    const set = await sessionRepository.findSetById(setId);
    if (!set || set.session_id !== sessionId) throw new AppError('Set not found in this session', 404);
    if (set.is_skipped) throw new AppError('This set was skipped', 400);
    if (set.is_completed) throw new AppError('This set is already completed', 400);

    const isTimeBased = (set.activity_type || 'reps') === 'time';

    // Look up previous session's data for comparison
    const prevSet = await sessionRepository.findLastSetForExercise(set.exercise_name, sessionId);

    // For time-based: also fetch all-time best
    let topRecord = null;
    if (isTimeBased) {
      topRecord = await sessionRepository.findBestDurationForExercise(set.exercise_name, sessionId);
    }

    // Save the set
    const updatedSet = await sessionRepository.completeSet(setId, {
      reps: data.reps || null,
      weightKg: data.weightKg || null,
      durationSeconds: data.durationSeconds || null,
    });

    // Build comparison
    let comparison = null;
    if (isTimeBased) {
      const prevDuration = prevSet ? (prevSet.duration_seconds || 0) : 0;
      const newDuration = data.durationSeconds || 0;
      const durationChange = newDuration - prevDuration;
      let verdict = 'same';
      if (durationChange > 0) verdict = 'improved';
      else if (durationChange < 0) verdict = 'declined';

      comparison = {
        isTimeBased: true,
        prevDurationSeconds: prevDuration,
        durationChange,
        topRecordSeconds: topRecord,
        isNewTopRecord: topRecord !== null && newDuration > topRecord,
        verdict,
      };
    } else if (prevSet) {
      const prevReps = prevSet.reps || 0;
      const prevWeight = prevSet.weight_kg ? parseFloat(prevSet.weight_kg) : 0;
      const newReps = data.reps || 0;
      const newWeight = data.weightKg || 0;
      const repsChange = newReps - prevReps;
      const weightChange = parseFloat((newWeight - prevWeight).toFixed(2));

      let verdict = 'same';
      if (repsChange > 0 || weightChange > 0) verdict = 'improved';
      else if (repsChange < 0 || weightChange < 0) verdict = 'declined';

      comparison = {
        isTimeBased: false,
        prevReps,
        prevWeightKg: prevWeight,
        repsChange,
        weightChange,
        verdict,
      };
    }

    return { set: updatedSet, comparison };
  },

  /**
   * Skip all remaining (incomplete) sets of an exercise.
   * @param {string} sessionId
   * @param {string} exerciseName
   * @returns {Promise<Object>} session detail
   */
  async skipExercise(sessionId, exerciseName) {
    const session = await sessionRepository.findById(sessionId);
    if (!session) throw new AppError('Session not found', 404);
    if (session.status !== 'active') throw new AppError('This session is no longer active', 400);

    await sessionRepository.skipExercise(sessionId, exerciseName);
    return this._buildSessionDetail(sessionId);
  },

  /**
   * Re-enable a previously skipped exercise (user changes their mind at end of session).
   * @param {string} sessionId
   * @param {string} exerciseName
   * @returns {Promise<Object>} session detail
   */
  async reEnableExercise(sessionId, exerciseName) {
    const session = await sessionRepository.findById(sessionId);
    if (!session) throw new AppError('Session not found', 404);

    await sessionRepository.reEnableExercise(sessionId, exerciseName);
    return this._buildSessionDetail(sessionId);
  },

  /**
   * Get names of skipped exercises in a session (used for end-of-session dialog).
   * @param {string} sessionId
   * @returns {Promise<string[]>}
   */
  async getSkippedExercises(sessionId) {
    return sessionRepository.findSkippedExerciseNames(sessionId);
  },

  /**
   * Complete a session.
   * @param {string} sessionId
   * @param {{ notes?: string }} data
   * @returns {Promise<Object>} completed session detail
   */
  async complete(sessionId, data) {
    const session = await sessionRepository.findById(sessionId);
    if (!session) throw new AppError('Session not found', 404);
    if (session.status !== 'active') throw new AppError('This session is already completed', 400);

    await sessionRepository.updateSession(sessionId, {
      status: 'completed',
      completedAt: new Date(),
      notes: data.notes || null,
    });

    return this._buildSessionDetail(sessionId);
  },

  /**
   * Cancel an active session.
   * @param {string} sessionId
   */
  async cancel(sessionId) {
    const session = await sessionRepository.findById(sessionId);
    if (!session) throw new AppError('Session not found', 404);
    await sessionRepository.updateSession(sessionId, { status: 'cancelled' });
  },

  /**
   * Delete a session and all its sets.
   * @param {string} sessionId
   */
  async delete(sessionId) {
    const session = await sessionRepository.findById(sessionId);
    if (!session) throw new AppError('Session not found', 404);
    await sessionRepository.deleteSession(sessionId);
  },

  /**
   * Paginated session history.
   * @param {{ page: number, limit: number }} opts
   */
  async history({ page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    const { data, total } = await sessionRepository.findHistory({ limit, offset });

    // Attach full session detail (exercises & sets) to each history item
    const withDetail = await Promise.all(
      data.map(async (s) => {
        return this._buildSessionDetail(s.id);
      }),
    );

    return { data: withDetail, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  /**
   * Log a cardio session with duration, speed, and incline.
   * @param {{ activityName: string, durationSeconds?: number, speed?: number, incline?: number, notes?: string }} data
   * @returns {Promise<Object>}
   */
  async logCardio(data) {
    const activityName = data.activityName || 'Cardio';
    const now = new Date();
    const session = await sessionRepository.createSession({
      planName: activityName,
      status: 'completed',
      sessionType: 'cardio',
      startedAt: now,
      completedAt: now,
      notes: data.notes || null,
      cardioDurationSeconds: data.durationSeconds || null,
      cardioSpeed: data.speed || null,
      cardioIncline: data.incline || null,
    });

    return this._buildSessionDetail(session.id);
  },

  /**
   * Get full session detail by ID.
   * @param {string} sessionId
   */
  async getById(sessionId) {
    const session = await sessionRepository.findById(sessionId);
    if (!session) throw new AppError('Session not found', 404);
    return this._buildSessionDetail(sessionId);
  },

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  async _buildSessionDetail(sessionId) {
    const session = await sessionRepository.findById(sessionId);
    const sets = await sessionRepository.findSets(sessionId);

    // Group sets by exercise for easier UI consumption
    const exerciseMap = new Map();
    for (const set of sets) {
      if (!exerciseMap.has(set.exercise_name)) {
        exerciseMap.set(set.exercise_name, { exerciseName: set.exercise_name, sortOrder: set.sort_order, sets: [] });
      }
      exerciseMap.get(set.exercise_name).sets.push(set);
    }

    const exercises = Array.from(exerciseMap.values()).sort((a, b) => a.sortOrder - b.sortOrder);

    return { ...session, exercises };
  },
};

module.exports = sessionService;
