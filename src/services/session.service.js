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
   * Start a new workout session.
   * Supports three modes:
   *   1. Plan-based (planId only): load exercises from plan template
   *   2. Custom plan (planId + exercises): use the provided exercise list (user modified the plan)
   *   3. Free-form (no planId, exercises + planName): "Quick Workout" with no plan
   *
   * @param {{
   *   planId?: string|null,
   *   planName?: string|null,
   *   wasMakeUpSession?: boolean,
   *   skipId?: string,
   *   exercises?: Array<{ name, targetSets, targetReps, activityType?, targetDurationSeconds? }>
   * }} data
   * @returns {Promise<Object>} session with all pre-generated sets
   */
  async start(data) {
    // Prevent concurrent active sessions
    const existing = await sessionRepository.findActive();
    if (existing) throw new AppError('You already have an active workout session! Finish it first.', 400);

    let planId = data.planId || null;
    let planName = data.planName || null;
    let exercises = data.exercises || null; // inline exercise list (custom or quick workout)

    if (planId) {
      // Plan-based session (mode 1 or 2)
      const plan = await workoutPlanRepository.findById(planId);
      if (!plan) throw new AppError('Workout plan not found', 404);
      planName = plan.name;

      // If no inline exercises provided, load from plan template (mode 1)
      if (!exercises || exercises.length === 0) {
        const planExercises = await workoutPlanRepository.findExercises(planId);
        if (!planExercises.length) throw new AppError('This plan has no exercises yet. Add some first!', 400);
        exercises = planExercises.map((ex) => ({
          name: ex.name,
          targetSets: ex.target_sets,
          targetReps: ex.target_reps || 0,
          activityType: ex.activity_type || 'reps',
          targetDurationSeconds: ex.target_duration_seconds || null,
        }));
      }
    } else {
      // Free-form / Quick Workout (mode 3)
      if (!exercises || exercises.length === 0) {
        throw new AppError('Please add at least one exercise to start a workout.', 400);
      }
      if (!planName || planName.trim() === '') {
        planName = 'Quick Workout';
      }
    }

    const session = await sessionRepository.createSession({
      planId,
      planName,
      wasMakeUpSession: data.wasMakeUpSession || false,
    });

    // Pre-generate all sets for every exercise
    const sets = [];
    const exerciseNames = exercises.map((ex) => ex.name);

    // Look up last session's reps/weight for smart defaults
    const lastSets = await sessionRepository.findLastCompletedSets(exerciseNames, session.id);

    exercises.forEach((ex, exIndex) => {
      const prev = lastSets.get(ex.name) || null;
      for (let s = 1; s <= ex.targetSets; s++) {
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
          activity_type: ex.activityType || 'reps',
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
   * Add a new exercise to an already-active session (mid-session).
   * Creates all pre-generated sets for the exercise using smart defaults.
   *
   * @param {string} sessionId
   * @param {{ name, targetSets, targetReps, activityType?, targetDurationSeconds? }} exerciseData
   * @returns {Promise<Object>} updated session detail
   */
  async addExercise(sessionId, exerciseData) {
    const session = await sessionRepository.findById(sessionId);
    if (!session) throw new AppError('Session not found', 404);
    if (session.status !== 'active') throw new AppError('This session is no longer active', 400);

    // Determine the next sort_order (after existing exercises)
    const existingSets = await sessionRepository.findSets(sessionId);
    const maxSortOrder = existingSets.length > 0
      ? Math.max(...existingSets.map((s) => s.sort_order))
      : -1;
    const newSortOrder = maxSortOrder + 1;

    // Look up previous performance for smart defaults
    const lastSets = await sessionRepository.findLastCompletedSets([exerciseData.name], sessionId);
    const prev = lastSets.get(exerciseData.name) || null;

    const sets = [];
    for (let s = 1; s <= exerciseData.targetSets; s++) {
      sets.push({
        session_id: sessionId,
        exercise_name: exerciseData.name,
        sort_order: newSortOrder,
        set_number: s,
        reps: null,
        weight_kg: null,
        default_reps: prev ? prev.reps : null,
        default_weight_kg: prev ? prev.weightKg : null,
        default_duration_seconds: prev ? (prev.durationSeconds || null) : null,
        activity_type: exerciseData.activityType || 'reps',
        is_skipped: false,
        is_completed: false,
        rest_duration_seconds: 120,
        completed_at: null,
      });
    }

    await sessionRepository.insertSets(sets);
    return this._buildSessionDetail(sessionId);
  },

  /**
   * Reorder exercises in an active session.
   * @param {string} sessionId
   * @param {Array<string>} exerciseNames
   * @returns {Promise<Object>} updated session detail
   */
  async reorderExercises(sessionId, exerciseNames) {
    const session = await sessionRepository.findById(sessionId);
    if (!session || session.status !== 'active') {
      throw new AppError('Active session not found', 404);
    }
    await sessionRepository.reorderExercises(sessionId, exerciseNames);
    return this._buildSessionDetail(sessionId);
  },

  /**
   * Remove an exercise from an active session.
   * Only deletes pending (incomplete) sets — completed sets are preserved.
   * Throws if all sets are already completed (nothing to remove).
   * @param {string} sessionId
   * @param {string} exerciseName
   * @returns {Promise<Object>} updated session detail
   */
  async removeExercise(sessionId, exerciseName) {
    const session = await sessionRepository.findById(sessionId);
    if (!session) throw new AppError('Session not found', 404);
    if (session.status !== 'active') throw new AppError('This session is no longer active', 400);

    const sets = await sessionRepository.findSetsByExercise(sessionId, exerciseName);
    if (!sets.length) throw new AppError('Exercise not found in this session', 404);

    const completedCount = sets.filter((s) => s.is_completed).length;
    if (completedCount === sets.length) {
      throw new AppError('Cannot remove an exercise that has all sets completed', 400);
    }

    await sessionRepository.deleteSetsByExercise(sessionId, exerciseName);
    return this._buildSessionDetail(sessionId);
  },

  /**
   * Edit target sets/reps for an exercise in an active session.
   * Adds new pending sets or trims excess pending ones while preserving completed sets.
   * @param {string} sessionId
   * @param {{ exerciseName, targetSets, targetReps, activityType, targetDurationSeconds? }} data
   * @returns {Promise<Object>} updated session detail
   */
  async editExercise(sessionId, data) {
    const session = await sessionRepository.findById(sessionId);
    if (!session) throw new AppError('Session not found', 404);
    if (session.status !== 'active') throw new AppError('This session is no longer active', 400);

    const sets = await sessionRepository.findSetsByExercise(sessionId, data.exerciseName);
    if (!sets.length) throw new AppError('Exercise not found in this session', 404);

    const completedSets = sets.filter((s) => s.is_completed);
    const pendingSets = sets.filter((s) => !s.is_completed);
    const currentTotal = sets.length;
    const targetTotal = data.targetSets;

    // Determine the sort_order for this exercise (same as existing sets)
    const sortOrder = sets[0].sort_order;

    if (targetTotal > currentTotal) {
      // Need more sets — add new pending ones starting from the next set_number
      const lastSets = await sessionRepository.findLastCompletedSets([data.exerciseName], sessionId);
      const prev = lastSets.get(data.exerciseName) || null;

      const newSets = [];
      for (let s = currentTotal + 1; s <= targetTotal; s++) {
        newSets.push({
          session_id: sessionId,
          exercise_name: data.exerciseName,
          sort_order: sortOrder,
          set_number: s,
          reps: null,
          weight_kg: null,
          default_reps: data.activityType === 'reps' ? (data.targetReps || (prev ? prev.reps : null)) : null,
          default_weight_kg: prev ? prev.weightKg : null,
          default_duration_seconds: data.activityType === 'time'
            ? (data.targetDurationSeconds || (prev ? prev.durationSeconds : null))
            : null,
          activity_type: data.activityType || 'reps',
          is_skipped: false,
          is_completed: false,
          rest_duration_seconds: 120,
          completed_at: null,
        });
      }
      await sessionRepository.insertSets(newSets);
    } else if (targetTotal < currentTotal) {
      // Fewer sets needed — remove trailing pending sets, keeping completed ones
      // Only remove as many pending sets as needed (from the highest set_number down)
      const toRemoveCount = Math.min(currentTotal - targetTotal, pendingSets.length);
      if (toRemoveCount > 0) {
        // Sort pending by set_number descending and remove the last ones
        const sortedPending = [...pendingSets].sort((a, b) => b.set_number - a.set_number);
        const idsToDelete = sortedPending.slice(0, toRemoveCount).map((s) => s.id);
        await sessionRepository.deleteSetsByIds(idsToDelete);
      }
    }
    // If targetTotal === currentTotal, just a type/reps metadata update (no set count change needed)

    return this._buildSessionDetail(sessionId);
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
   * Get the most recent completed gym session for a given plan.
   * Used by the dashboard to show last workout's exercises instead of the plan template.
   * @param {string} planId
   * @returns {Promise<Object|null>}
   */
  async getLastByPlan(planId) {
    const session = await sessionRepository.findLastCompletedByPlan(planId);
    if (!session) return null;
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
   */
  async skipExercise(sessionId, exerciseName) {
    const session = await sessionRepository.findById(sessionId);
    if (!session) throw new AppError('Session not found', 404);
    if (session.status !== 'active') throw new AppError('This session is no longer active', 400);

    await sessionRepository.skipExercise(sessionId, exerciseName);
    return this._buildSessionDetail(sessionId);
  },

  /**
   * Re-enable a previously skipped exercise.
   */
  async reEnableExercise(sessionId, exerciseName) {
    const session = await sessionRepository.findById(sessionId);
    if (!session) throw new AppError('Session not found', 404);

    await sessionRepository.reEnableExercise(sessionId, exerciseName);
    return this._buildSessionDetail(sessionId);
  },

  /**
   * Get names of skipped exercises in a session.
   */
  async getSkippedExercises(sessionId) {
    return sessionRepository.findSkippedExerciseNames(sessionId);
  },

  /**
   * Complete a session.
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
   */
  async cancel(sessionId) {
    const session = await sessionRepository.findById(sessionId);
    if (!session) throw new AppError('Session not found', 404);
    await sessionRepository.updateSession(sessionId, { status: 'cancelled' });
  },

  /**
   * Delete a session and all its sets.
   */
  async delete(sessionId) {
    const session = await sessionRepository.findById(sessionId);
    if (!session) throw new AppError('Session not found', 404);
    await sessionRepository.deleteSession(sessionId);
  },

  /**
   * Paginated session history.
   */
  async history({ page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    const { data, total } = await sessionRepository.findHistory({ limit, offset });

    const withDetail = await Promise.all(
      data.map(async (s) => {
        return this._buildSessionDetail(s.id);
      }),
    );

    return { data: withDetail, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  /**
   * Log a cardio session with duration, speed, and incline.
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
