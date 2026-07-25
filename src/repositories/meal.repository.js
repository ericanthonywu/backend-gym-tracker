'use strict';

const db = require('../config/database');

/**
 * Meal Repository — all DB access for meal settings and logs.
 * Returns plain objects. No business logic.
 */
const mealRepository = {
  // ---------------------------------------------------------------------------
  // Settings (user-configurable meal slots)
  // ---------------------------------------------------------------------------

  /**
   * @returns {Promise<Array>} active meal slots ordered by sort_order
   */
  async findAllSettings() {
    return db('meal_settings').where({ is_active: true }).orderBy('sort_order', 'asc');
  },

  /**
   * @param {string} id
   * @returns {Promise<Object|undefined>}
   */
  async findSettingById(id) {
    return db('meal_settings').where({ id }).first();
  },

  /**
   * @param {{ name: string, sortOrder: number }} data
   * @returns {Promise<Object>}
   */
  async createSetting(data) {
    const [row] = await db('meal_settings')
      .insert({ name: data.name, sort_order: data.sortOrder, created_at: new Date() })
      .returning('*');
    return row;
  },

  /**
   * @param {string} id
   * @param {{ name?: string, sortOrder?: number, isActive?: boolean }} data
   * @returns {Promise<Object|undefined>}
   */
  async updateSetting(id, data) {
    const updates = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.sortOrder !== undefined) updates.sort_order = data.sortOrder;
    if (data.isActive !== undefined) updates.is_active = data.isActive;
    const [row] = await db('meal_settings').where({ id }).update(updates).returning('*');
    return row;
  },

  /**
   * @param {string} id
   */
  async deleteSetting(id) {
    return db('meal_settings').where({ id }).delete();
  },

  // ---------------------------------------------------------------------------
  // Logs (per-day check-ins)
  // ---------------------------------------------------------------------------

  /**
   * Get all meal logs for a specific date, joined with setting names.
   * @param {string} date  'YYYY-MM-DD'
   * @returns {Promise<Array>}
   */
  async findByDate(date) {
    // Left-join so even unchecked meals appear with is_checked=false
    const settings = await db('meal_settings').where({ is_active: true }).orderBy('sort_order', 'asc');

    const logs = await db('meal_logs')
      .where({ log_date: date })
      .whereIn('meal_setting_id', settings.map((s) => s.id));

    // Merge: for each setting, find its log or default to unchecked
    return settings.map((s) => {
      const log = logs.find((l) => l.meal_setting_id === s.id);
      return {
        mealSettingId: s.id,
        name: s.name,
        sortOrder: s.sort_order,
        logDate: date,
        isChecked: log ? log.is_checked : false,
        logId: log ? log.id : null,
      };
    });
  },

  /**
   * Toggle (upsert) a meal check-in for a given setting + date.
   * @param {{ mealSettingId: string, logDate: string, isChecked: boolean }} data
   * @returns {Promise<Object>}
   */
  async upsertLog(data) {
    const [row] = await db('meal_logs')
      .insert({
        meal_setting_id: data.mealSettingId,
        log_date: data.logDate,
        is_checked: data.isChecked,
      })
      .onConflict(['meal_setting_id', 'log_date'])
      .merge(['is_checked'])
      .returning('*');
    return row;
  },

  /**
   * Compliance data for a date range: how many meals checked vs total.
   * @param {string} dateFrom  'YYYY-MM-DD'
   * @param {string} dateTo    'YYYY-MM-DD'
   * @returns {Promise<{ totalPossible: number, totalChecked: number, byDate: Array }>}
   */
  async findSummary(dateFrom, dateTo) {
    const settingCount = await db('meal_settings').where({ is_active: true }).count('id as count').first();
    const mealsPerDay = parseInt(settingCount.count, 10);

    const rows = await db('meal_logs')
      .whereBetween('log_date', [dateFrom, dateTo])
      .select('log_date')
      .select(db.raw('SUM(CASE WHEN is_checked THEN 1 ELSE 0 END) as checked_count'))
      .select(db.raw('COUNT(*) as total_count'))
      .groupBy('log_date')
      .orderBy('log_date', 'asc');

    return {
      mealsPerDay,
      byDate: rows.map((r) => ({
        date: r.log_date instanceof Date
          ? moment(r.log_date).format('YYYY-MM-DD')
          : String(r.log_date).substring(0, 10),
        checkedCount: parseInt(r.checked_count, 10),
        totalCount: parseInt(r.total_count, 10),
      })),
    };
  },
};

module.exports = mealRepository;
