'use strict';

const Joi = require('joi');
const mealService = require('../services/meal.service');
const validate = require('../middlewares/validator');

const addSettingSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
});

const updateSettingSchema = Joi.object({
  name: Joi.string().min(1).max(255).optional(),
  sortOrder: Joi.number().integer().min(0).optional(),
  isActive: Joi.boolean().optional(),
});

const toggleSchema = Joi.object({
  mealSettingId: Joi.string().uuid().required(),
  isChecked: Joi.boolean().required(),
});

const mealController = {
  /** GET /api/meals/settings */
  async getSettings(req, res, next) {
    try {
      const settings = await mealService.getSettings();
      return res.status(200).json({ data: settings });
    } catch (err) { next(err); }
  },

  /** POST /api/meals/settings */
  addSetting: [
    validate(addSettingSchema),
    async (req, res, next) => {
      try {
        const setting = await mealService.addSetting(req.body);
        return res.status(201).json(setting);
      } catch (err) { next(err); }
    },
  ],

  /** PATCH /api/meals/settings/:id */
  updateSetting: [
    validate(updateSettingSchema),
    async (req, res, next) => {
      try {
        const setting = await mealService.updateSetting(req.params.id, req.body);
        return res.status(200).json(setting);
      } catch (err) { next(err); }
    },
  ],

  /** DELETE /api/meals/settings/:id */
  async deleteSetting(req, res, next) {
    try {
      await mealService.deleteSetting(req.params.id);
      return res.status(204).send();
    } catch (err) { next(err); }
  },

  /** GET /api/meals/today */
  async getToday(req, res, next) {
    try {
      const meals = await mealService.getToday();
      return res.status(200).json({ data: meals });
    } catch (err) { next(err); }
  },

  /** PATCH /api/meals/toggle */
  toggle: [
    validate(toggleSchema),
    async (req, res, next) => {
      try {
        const meals = await mealService.toggle(req.body);
        return res.status(200).json({ data: meals });
      } catch (err) { next(err); }
    },
  ],

  /** GET /api/meals/summary?range=weekly|monthly */
  async getSummary(req, res, next) {
    try {
      const range = req.query.range || 'weekly';
      const summary = await mealService.getSummary(range);
      return res.status(200).json(summary);
    } catch (err) { next(err); }
  },
};

module.exports = mealController;
