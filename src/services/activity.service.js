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

  async search(query) {
    if (!query || query.trim().length < 1) {
      return activityRepository.findAll();
    }
    return activityRepository.search(query.trim());
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
