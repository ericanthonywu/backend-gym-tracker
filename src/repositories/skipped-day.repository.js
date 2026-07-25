'use strict';

const db = require('../config/database');

/**
 * Skipped Days Repository — tracks skipped workout days for cascade carry-forward.
 * Returns plain objects. No business logic.
 */
const skippedDayRepository = {
  /**
   * Find an active (not completed, not dismissed) skip for a given date.
   * @param {string} date 'YYYY-MM-DD'
   * @returns {Promise<Object|undefined>}
   */
  async findActiveByRescheduledDate(date) {
    return db('skipped_days')
      .where({ rescheduled_to: date, is_completed: false, is_dismissed: false })
      .first();
  },

  /**
   * Find all active skips not yet completed or dismissed.
   * @returns {Promise<Array>}
   */
  async findAllActive() {
    return db('skipped_days')
      .where({ is_completed: false, is_dismissed: false })
      .orderBy('original_date', 'asc');
  },

  /**
   * @param {{ originalDate: string, planId: string|null, planName: string, rescheduledTo: string }} data
   * @returns {Promise<Object>}
   */
  async create(data) {
    const [row] = await db('skipped_days')
      .insert({
        original_date: data.originalDate,
        plan_id: data.planId || null,
        plan_name: data.planName,
        rescheduled_to: data.rescheduledTo,
        created_at: new Date(),
      })
      .returning('*');
    return row;
  },

  /**
   * @param {string} id
   * @param {{ isCompleted?: boolean, isDismissed?: boolean, rescheduledTo?: string }} data
   * @returns {Promise<Object|undefined>}
   */
  async update(id, data) {
    const updates = {};
    if (data.isCompleted !== undefined) updates.is_completed = data.isCompleted;
    if (data.isDismissed !== undefined) updates.is_dismissed = data.isDismissed;
    if (data.rescheduledTo !== undefined) updates.rescheduled_to = data.rescheduledTo;
    const [row] = await db('skipped_days').where({ id }).update(updates).returning('*');
    return row;
  },
};

module.exports = skippedDayRepository;
