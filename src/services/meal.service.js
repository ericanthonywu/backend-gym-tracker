'use strict';

const moment = require('moment-timezone');
const mealRepository = require('../repositories/meal.repository');
const AppError = require('../utils/app-error');

const TZ = 'Asia/Jakarta';

/**
 * Meal Service — business logic for meal settings and daily check-ins.
 */
const mealService = {
  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  /**
   * @returns {Promise<Array>} all active meal slots
   */
  async getSettings() {
    return mealRepository.findAllSettings();
  },

  /**
   * Add a new meal slot.
   * @param {{ name: string }} data
   * @returns {Promise<Object>}
   */
  async addSetting(data) {
    const existing = await mealRepository.findAllSettings();
    const sortOrder = existing.length; // append at end
    return mealRepository.createSetting({ name: data.name.trim(), sortOrder });
  },

  /**
   * Update a meal slot (name or order).
   * @param {string} id
   * @param {{ name?: string, sortOrder?: number, isActive?: boolean }} data
   * @returns {Promise<Object>}
   */
  async updateSetting(id, data) {
    const setting = await mealRepository.findSettingById(id);
    if (!setting) throw new AppError('Meal slot not found', 404);
    return mealRepository.updateSetting(id, data);
  },

  /**
   * Delete a meal slot (and all its logs via CASCADE).
   * @param {string} id
   */
  async deleteSetting(id) {
    const setting = await mealRepository.findSettingById(id);
    if (!setting) throw new AppError('Meal slot not found', 404);
    await mealRepository.deleteSetting(id);
  },

  // ---------------------------------------------------------------------------
  // Logs
  // ---------------------------------------------------------------------------

  /**
   * Get today's meal checklist.
   * @returns {Promise<Array>}
   */
  async getToday() {
    const today = moment.tz(TZ).format('YYYY-MM-DD');
    return mealRepository.findByDate(today);
  },

  /**
   * Toggle a meal slot for today.
   * @param {{ mealSettingId: string, isChecked: boolean }} data
   * @returns {Promise<Array>} updated today's checklist
   */
  async toggle(data) {
    const setting = await mealRepository.findSettingById(data.mealSettingId);
    if (!setting) throw new AppError('Meal slot not found', 404);

    const today = moment.tz(TZ).format('YYYY-MM-DD');
    await mealRepository.upsertLog({
      mealSettingId: data.mealSettingId,
      logDate: today,
      isChecked: data.isChecked,
    });

    return mealRepository.findByDate(today);
  },

  /**
   * Summary compliance data for a given range.
   * @param {'weekly'|'monthly'} range
   * @returns {Promise<Object>}
   */
  async getSummary(range) {
    const now = moment.tz(TZ);
    const dateTo = now.format('YYYY-MM-DD');
    const dateFrom = range === 'monthly'
      ? now.clone().subtract(29, 'days').format('YYYY-MM-DD')
      : now.clone().subtract(6, 'days').format('YYYY-MM-DD');

    const { mealsPerDay, byDate } = await mealRepository.findSummary(dateFrom, dateTo);

    const totalPossible = byDate.reduce((acc, d) => acc + mealsPerDay, 0);
    const totalChecked = byDate.reduce((acc, d) => acc + d.checkedCount, 0);
    const totalSkipped = totalPossible - totalChecked;
    const compliancePct = totalPossible > 0
      ? Math.round((totalChecked / totalPossible) * 100)
      : 0;

    return {
      range,
      dateFrom,
      dateTo,
      mealsPerDay,
      totalPossible,
      totalChecked,
      totalSkipped,
      compliancePct,
      byDate,
    };
  },
};

module.exports = mealService;
