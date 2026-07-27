'use strict';

const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const menstruationRepository = {
  async findAll() {
    return db('menstruation_logs')
      .orderBy('start_date', 'desc');
  },

  async findById(id) {
    return db('menstruation_logs').where({ id }).first();
  },

  async create(data) {
    const id = uuidv4();
    const [row] = await db('menstruation_logs')
      .insert({
        id,
        start_date: data.start_date,
        end_date: data.end_date || null,
        flow_intensity: data.flow_intensity || null,
        notes: data.notes || null,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    return row;
  },

  async update(id, data) {
    const updates = { ...data, updated_at: new Date() };
    const [row] = await db('menstruation_logs')
      .where({ id })
      .update(updates)
      .returning('*');
    return row;
  },

  async delete(id) {
    return db('menstruation_logs').where({ id }).del();
  }
};

module.exports = menstruationRepository;
