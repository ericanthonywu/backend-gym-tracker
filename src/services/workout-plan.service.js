'use strict';

const workoutPlanRepository = require('../repositories/workout-plan.repository');
const AppError = require('../utils/app-error');

/**
 * Workout Plan Service — business logic for plans and exercises.
 */
const workoutPlanService = {
  /**
   * @returns {Promise<Array>} all plans with their exercises
   */
  async list() {
    const plans = await workoutPlanRepository.findAll();
    // Attach exercises to each plan
    const withExercises = await Promise.all(
      plans.map(async (p) => {
        const exercises = await workoutPlanRepository.findExercises(p.id);
        return { ...p, exercises };
      }),
    );
    return withExercises;
  },

  /**
   * @param {string} id
   * @returns {Promise<Object>} plan with exercises
   * @throws {AppError} 404 if not found
   */
  async getById(id) {
    const plan = await workoutPlanRepository.findById(id);
    if (!plan) throw new AppError('Workout plan not found', 404);
    const exercises = await workoutPlanRepository.findExercises(id);
    return { ...plan, exercises };
  },

  /**
   * @param {{ name: string, exercises: Array<{ name: string, targetSets: number, targetReps: number }> }} data
   * @returns {Promise<Object>} created plan with exercises
   */
  async create(data) {
    const plan = await workoutPlanRepository.create({ name: data.name.trim() });

    const exercises = (data.exercises || []).map((e, i) => ({
      planId: plan.id,
      name: e.name.trim(),
      targetSets: e.targetSets || 4,
      targetReps: e.targetReps || 0,
      activityType: e.activityType || 'reps',
      targetDurationSeconds: e.targetDurationSeconds || null,
      sortOrder: i,
    }));

    const insertedExercises = await workoutPlanRepository.insertExercises(exercises);
    return { ...plan, exercises: insertedExercises };
  },

  /**
   * @param {string} id
   * @param {{ name: string, exercises: Array }} data
   * @returns {Promise<Object>}
   * @throws {AppError} 404 if not found
   */
  async update(id, data) {
    const existing = await workoutPlanRepository.findById(id);
    if (!existing) throw new AppError('Workout plan not found', 404);

    const plan = await workoutPlanRepository.update(id, { name: data.name.trim() });

    // Replace all exercises (delete + re-insert preserves sort order)
    await workoutPlanRepository.deleteExercises(id);
    const exercises = (data.exercises || []).map((e, i) => ({
      planId: id,
      name: e.name.trim(),
      targetSets: e.targetSets || 4,
      targetReps: e.targetReps || 0,
      activityType: e.activityType || 'reps',
      targetDurationSeconds: e.targetDurationSeconds || null,
      sortOrder: i,
    }));
    const insertedExercises = await workoutPlanRepository.insertExercises(exercises);
    return { ...plan, exercises: insertedExercises };
  },

  /**
   * @param {string} id
   * @throws {AppError} 404 if not found
   */
  async delete(id) {
    const existing = await workoutPlanRepository.findById(id);
    if (!existing) throw new AppError('Workout plan not found', 404);
    await workoutPlanRepository.delete(id);
  },
};

module.exports = workoutPlanService;
