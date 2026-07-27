'use strict';

const menstruationRepo = require('../repositories/menstruation.repository');
const AppError = require('../utils/app-error');

const menstruationService = {
  async listAll() {
    return menstruationRepo.findAll();
  },

  async create(data) {
    return menstruationRepo.create(data);
  },

  async update(id, data) {
    const existing = await menstruationRepo.findById(id);
    if (!existing) {
      throw new AppError('Record not found', 404);
    }

    const payload = {};
    if (data.start_date !== undefined) payload.start_date = data.start_date;
    if (data.end_date !== undefined) payload.end_date = data.end_date;
    if (data.flow_intensity !== undefined) payload.flow_intensity = data.flow_intensity;
    if (data.notes !== undefined) payload.notes = data.notes;

    return menstruationRepo.update(id, payload);
  },

  async delete(id) {
    const existing = await menstruationRepo.findById(id);
    if (!existing) {
      throw new AppError('Record not found', 404);
    }

    await menstruationRepo.delete(id);
  }
};

module.exports = menstruationService;
