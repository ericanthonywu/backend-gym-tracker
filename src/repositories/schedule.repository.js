'use strict';

const db = require('../config/database');

/**
 * Schedule Repository — all DB access for the weekly workout schedule.
 * Returns plain objects. No business logic.
 */
const scheduleRepository = {
  /**
   * Get all 7 day schedule entries joined with plan names.
   * @returns {Promise<Array>}
   */
  async findAll() {
    return db('weekly_schedule as ws')
      .leftJoin('workout_plans as wp', 'ws.plan_id', 'wp.id')
      .select('ws.*', 'wp.name as plan_name')
      .orderBy('ws.day_of_week', 'asc');
  },

  /**
   * @param {number} dayOfWeek  0=Monday … 6=Sunday
   * @returns {Promise<Object|undefined>}
   */
  async findByDay(dayOfWeek) {
    return db('weekly_schedule as ws')
      .leftJoin('workout_plans as wp', 'ws.plan_id', 'wp.id')
      .select('ws.*', 'wp.name as plan_name')
      .where('ws.day_of_week', dayOfWeek)
      .first();
  },

  /**
   * Upsert a single day's schedule.
   * @param {{ dayOfWeek: number, planId: string|null, isRestDay: boolean }} data
   * @returns {Promise<Object>}
   */
  async upsertDay(data) {
    const [row] = await db('weekly_schedule')
      .insert({
        day_of_week: data.dayOfWeek,
        plan_id: data.planId || null,
        is_rest_day: data.isRestDay,
      })
      .onConflict('day_of_week')
      .merge(['plan_id', 'is_rest_day'])
      .returning('*');
    return row;
  },
};

module.exports = scheduleRepository;
