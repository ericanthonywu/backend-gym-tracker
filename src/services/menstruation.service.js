'use strict';

const menstruationRepo = require('../repositories/menstruation.repository');

const menstruationService = {
  async listByUser(userId) {
    return menstruationRepo.findAllByUser(userId);
  },

  async create(userId, data) {
    const payload = {
      user_id: userId,
      start_date: data.start_date,
      end_date: data.end_date || null,
      flow_intensity: data.flow_intensity || null,
      notes: data.notes || null,
    };
    return menstruationRepo.create(payload);
  },

  async update(userId, id, data) {
    const existing = await menstruationRepo.findById(id);
    if (!existing) {
      const error = new Error('Record not found');
      error.status = 404;
      throw error;
    }
    if (existing.user_id !== userId) {
      const error = new Error('Forbidden');
      error.status = 403;
      throw error;
    }

    const payload = {};
    if (data.start_date !== undefined) payload.start_date = data.start_date;
    if (data.end_date !== undefined) payload.end_date = data.end_date;
    if (data.flow_intensity !== undefined) payload.flow_intensity = data.flow_intensity;
    if (data.notes !== undefined) payload.notes = data.notes;

    return menstruationRepo.update(id, payload);
  },

  async delete(userId, id) {
    const existing = await menstruationRepo.findById(id);
    if (!existing) {
      const error = new Error('Record not found');
      error.status = 404;
      throw error;
    }
    if (existing.user_id !== userId) {
      const error = new Error('Forbidden');
      error.status = 403;
      throw error;
    }

    await menstruationRepo.delete(id);
  }
};

module.exports = menstruationService;
