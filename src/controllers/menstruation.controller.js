'use strict';

const Joi = require('joi');
const menstruationService = require('../services/menstruation.service');
const validate = require('../middlewares/validator');

const logSchema = Joi.object({
  start_date: Joi.string().isoDate().required(),
  end_date: Joi.string().isoDate().allow(null, '').optional(),
  flow_intensity: Joi.string().allow(null, '').optional(),
  notes: Joi.string().allow(null, '').optional(),
});

const updateSchema = Joi.object({
  start_date: Joi.string().isoDate().optional(),
  end_date: Joi.string().isoDate().allow(null, '').optional(),
  flow_intensity: Joi.string().allow(null, '').optional(),
  notes: Joi.string().allow(null, '').optional(),
});

const menstruationController = {
  async list(req, res, next) {
    try {
      const records = await menstruationService.listAll();
      return res.json({ data: records });
    } catch (error) {
      next(error);
    }
  },

  log: [
    validate(logSchema),
    async (req, res, next) => {
      try {
        const newRecord = await menstruationService.create(req.body);
        return res.status(201).json({ data: newRecord });
      } catch (error) {
        next(error);
      }
    }
  ],

  update: [
    validate(updateSchema),
    async (req, res, next) => {
      try {
        const updated = await menstruationService.update(req.params.id, req.body);
        return res.json({ data: updated });
      } catch (error) {
        next(error);
      }
    }
  ],

  async delete(req, res, next) {
    try {
      await menstruationService.delete(req.params.id);
      return res.json({ message: 'Deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = menstruationController;
