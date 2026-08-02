'use strict';

const activityRepository = require('../repositories/activity.repository');
const AppError = require('../utils/app-error');

/**
 * Activity Service — business logic for master activities.
 */
const activityService = {
  async listAll() {
    return activityRepository.findAll();
  },

  /**
   * Search activities by name, with optional muscle filter.
   * @param {string} query
   * @param {string|null} muscle  - filter to activities that target this muscle
   */
  async search(query, muscle = null) {
    const q = query ? query.trim() : '';
    const m = muscle ? muscle.trim() : null;
    if (q.length < 1 && !m) {
      return activityRepository.findAll();
    }
    return activityRepository.search(q, m);
  },

  /**
   * Find activities by primary muscle group.
   * @param {string} muscle  - e.g. 'chest', 'biceps'
   */
  async listByPrimaryMuscle(muscle) {
    if (!muscle || muscle.trim().length < 1) {
      throw new AppError('Muscle name is required', 400);
    }
    return activityRepository.findByPrimaryMuscle(muscle.trim());
  },

  /**
   * Find activities that target a muscle (primary OR secondary).
   * @param {string} muscle
   */
  async listByMuscle(muscle) {
    if (!muscle || muscle.trim().length < 1) {
      throw new AppError('Muscle name is required', 400);
    }
    return activityRepository.findByMuscle(muscle.trim());
  },

  /**
   * Return all distinct primary muscles with exercise counts.
   */
  async listMuscles() {
    return activityRepository.listMuscles();
  },

  /**
   * Create a new master activity.
   * Returns existing if the name already exists (case-insensitive).
   */
  async create(data) {
    if (!data.name || data.name.trim().length < 1) {
      throw new AppError('Activity name is required', 400);
    }
    return activityRepository.findOrCreate(data.name.trim(), data.activityType);
  },
};

module.exports = activityService;
