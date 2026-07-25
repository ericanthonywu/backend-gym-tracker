'use strict';

const db = require('../config/database');
const moment = require('moment-timezone');

const TZ = 'Asia/Jakarta';

/**
 * Weight Repository — all DB access for weight log entries.
 * Returns plain objects. No business logic.
 */
const weightRepository = {
  /**
   * @param {{ weightKg: number, notes?: string, loggedAt?: Date }} data
   * @returns {Promise<Object>}
   */
  async create(data) {
    const [row] = await db('weight_logs')
      .insert({
        weight_kg: data.weightKg,
        notes: data.notes || null,
        logged_at: data.loggedAt || new Date(),
      })
      .returning('*');
    return row;
  },

  /**
   * @param {string} id
   * @returns {Promise<Object|undefined>}
   */
  async findById(id) {
    return db('weight_logs').where({ id }).first();
  },

  /**
   * Most recent weight entry.
   * @returns {Promise<Object|undefined>}
   */
  async findLatest() {
    return db('weight_logs').orderBy('logged_at', 'desc').first();
  },

  /**
   * @param {string} id
   */
  async delete(id) {
    return db('weight_logs').where({ id }).delete();
  },

  /**
   * Get daily weight entries for a date range.
   * Returns one entry per day (the most recent that day).
   * @param {Date} dateFrom
   * @param {Date} dateTo
   * @returns {Promise<Array<{ date: string, weight_kg: number }>>}
   */
  async findDailyRange(dateFrom, dateTo) {
    const rows = await db('weight_logs')
      .whereBetween('logged_at', [dateFrom, dateTo])
      .select(
        db.raw(`DATE(logged_at AT TIME ZONE 'Asia/Jakarta') as date`),
        db.raw('AVG(weight_kg) as weight_kg'),
      )
      .groupByRaw(`DATE(logged_at AT TIME ZONE 'Asia/Jakarta')`)
      .orderBy('date', 'asc');

    return rows.map((r) => ({
      date: moment.tz(r.date, TZ).format('YYYY-MM-DD'),
      weightKg: parseFloat(r.weight_kg),
    }));
  },

  /**
   * Stats: min, max, avg weight and first/last entries.
   * @param {Date} dateFrom
   * @param {Date} dateTo
   * @returns {Promise<Object>}
   */
  async findSummary(dateFrom, dateTo) {
    const [row] = await db('weight_logs')
      .whereBetween('logged_at', [dateFrom, dateTo])
      .select(
        db.raw('MIN(weight_kg) as min_kg'),
        db.raw('MAX(weight_kg) as max_kg'),
        db.raw('AVG(weight_kg) as avg_kg'),
        db.raw('COUNT(*) as entry_count'),
      );
    return {
      minKg: row.min_kg ? parseFloat(row.min_kg) : null,
      maxKg: row.max_kg ? parseFloat(row.max_kg) : null,
      avgKg: row.avg_kg ? parseFloat(parseFloat(row.avg_kg).toFixed(1)) : null,
      entryCount: parseInt(row.entry_count, 10),
    };
  },

  /**
   * Raw list of all entries (for history list), newest first.
   * @param {{ limit: number, offset: number }} opts
   * @returns {Promise<{ data: Array, total: number }>}
   */
  async findAll({ limit = 30, offset = 0 } = {}) {
    const data = await db('weight_logs').orderBy('logged_at', 'desc').limit(limit).offset(offset);
    const [{ count }] = await db('weight_logs').count('id as count');
    return { data, total: parseInt(count, 10) };
  },
};

module.exports = weightRepository;
