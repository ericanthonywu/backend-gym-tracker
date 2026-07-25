'use strict';

const Joi = require('joi');
const weightService = require('../services/weight.service');
const validate = require('../middlewares/validator');

const logSchema = Joi.object({
  weightKg: Joi.number().min(1).max(300).required(),
  notes: Joi.string().max(500).allow('').optional(),
});

const weightController = {
  /** GET /api/weight/latest */
  async getLatest(req, res, next) {
    try {
      const entry = await weightService.getLatest();
      return res.status(200).json(entry || null);
    } catch (err) { next(err); }
  },

  /** GET /api/weight/chart?range=daily|weekly|monthly */
  async getChart(req, res, next) {
    try {
      const range = req.query.range || 'weekly';
      const data = await weightService.getChartData(range);
      return res.status(200).json({ data });
    } catch (err) { next(err); }
  },

  /** GET /api/weight/summary?range=weekly|monthly|alltime */
  async getSummary(req, res, next) {
    try {
      const range = req.query.range || 'monthly';
      const summary = await weightService.getSummary(range);
      return res.status(200).json(summary);
    } catch (err) { next(err); }
  },

  /** GET /api/weight?page=1&limit=30 */
  async list(req, res, next) {
    try {
      const page = parseInt(req.query.page || '1', 10);
      const limit = parseInt(req.query.limit || '30', 10);
      const result = await weightService.list({ page, limit });
      return res.status(200).json(result);
    } catch (err) { next(err); }
  },

  /** POST /api/weight */
  log: [
    validate(logSchema),
    async (req, res, next) => {
      try {
        const entry = await weightService.log(req.body);
        return res.status(201).json(entry);
      } catch (err) { next(err); }
    },
  ],

  /** DELETE /api/weight/:id */
  async delete(req, res, next) {
    try {
      await weightService.delete(req.params.id);
      return res.status(204).send();
    } catch (err) { next(err); }
  },
};

module.exports = weightController;
