'use strict';

const moment = require('moment-timezone');
const weightRepository = require('../repositories/weight.repository');
const AppError = require('../utils/app-error');

const TZ = 'Asia/Jakarta';

/**
 * Weight Service — business logic for weight tracking.
 */
const weightService = {
  /**
   * Log a weight entry.
   * @param {{ weightKg: number, notes?: string }} data
   * @returns {Promise<Object>}
   */
  async log(data) {
    if (data.weightKg <= 0 || data.weightKg > 300) {
      throw new AppError('Please enter a valid weight between 1 and 300 kg', 400);
    }
    return weightRepository.create({ weightKg: data.weightKg, notes: data.notes });
  },

  /**
   * Get latest weight entry.
   * @returns {Promise<Object|null>}
   */
  async getLatest() {
    return weightRepository.findLatest() || null;
  },

  /**
   * Get chart data for a given range.
   * @param {'daily'|'weekly'|'monthly'} range
   * @returns {Promise<Array>}
   */
  async getChartData(range) {
    const now = moment.tz(TZ);
    let dateFrom, dateTo;

    dateTo = now.clone().endOf('day').toDate();

    if (range === 'weekly') {
      dateFrom = now.clone().subtract(6, 'days').startOf('day').toDate();
    } else if (range === 'monthly') {
      dateFrom = now.clone().subtract(29, 'days').startOf('day').toDate();
    } else {
      // daily = last 7 days by default
      dateFrom = now.clone().subtract(6, 'days').startOf('day').toDate();
    }

    return weightRepository.findDailyRange(dateFrom, dateTo);
  },

  /**
   * Get summary stats (min, max, avg, trend).
   * @param {'weekly'|'monthly'|'alltime'} range
   * @returns {Promise<Object>}
   */
  async getSummary(range) {
    const now = moment.tz(TZ);
    let dateFrom;

    if (range === 'monthly') {
      dateFrom = now.clone().subtract(29, 'days').startOf('day').toDate();
    } else if (range === 'weekly') {
      dateFrom = now.clone().subtract(6, 'days').startOf('day').toDate();
    } else {
      dateFrom = new Date(0); // all time
    }

    const dateTo = now.clone().endOf('day').toDate();
    const stats = await weightRepository.findSummary(dateFrom, dateTo);

    // Trend: compare first half vs second half of range
    const midPoint = new Date((dateFrom.getTime() + dateTo.getTime()) / 2);
    const firstHalf = await weightRepository.findSummary(dateFrom, midPoint);
    const secondHalf = await weightRepository.findSummary(midPoint, dateTo);

    let trend = 'stable';
    if (firstHalf.avgKg && secondHalf.avgKg) {
      const diff = secondHalf.avgKg - firstHalf.avgKg;
      if (diff > 0.2) trend = 'up';
      else if (diff < -0.2) trend = 'down';
    }

    return { ...stats, trend };
  },

  /**
   * Delete a weight entry.
   * @param {string} id
   * @throws {AppError} 404 if not found
   */
  async delete(id) {
    const entry = await weightRepository.findById(id);
    if (!entry) throw new AppError('Weight entry not found', 404);
    await weightRepository.delete(id);
  },

  /**
   * Paginated weight history.
   * @param {{ page: number, limit: number }} opts
   */
  async list({ page = 1, limit = 30 } = {}) {
    const offset = (page - 1) * limit;
    const { data, total } = await weightRepository.findAll({ limit, offset });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  },
};

module.exports = weightService;
