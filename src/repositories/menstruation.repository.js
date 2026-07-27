'use strict';

const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const menstruationRepository = {
  async findAllByUser(userId) {
    return db('menstruation_logs')
      .where({ user_id: userId })
      .orderBy('start_date', 'desc');
  },

  async findById(id) {
    return db('menstruation_logs').where({ id }).first();
  },

  async create(data) {
    const id = uuidv4();
    await db('menstruation_logs').insert({
      id,
      ...data,
      created_at: new Date(),
      updated_at: new Date(),
    });
    return this.findById(id);
  },

  async update(id, data) {
    await db('menstruation_logs')
      .where({ id })
      .update({
        ...data,
        updated_at: new Date(),
      });
    return this.findById(id);
  },

  async delete(id) {
    return db('menstruation_logs').where({ id }).del();
  }
};

module.exports = menstruationRepository;
