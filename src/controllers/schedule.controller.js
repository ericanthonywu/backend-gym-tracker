'use strict';

const Joi = require('joi');
const scheduleService = require('../services/schedule.service');
const validate = require('../middlewares/validator');

const daySchema = Joi.object({
  dayOfWeek: Joi.number().integer().min(0).max(6).required(),
  planId: Joi.string().uuid().allow(null).optional(),
  isRestDay: Joi.boolean().default(false),
});

const updateAllSchema = Joi.object({
  days: Joi.array().items(daySchema).min(1).max(7).required(),
});

const scheduleController = {
  /** GET /api/schedule */
  async getAll(req, res, next) {
    try {
      const schedule = await scheduleService.getAll();
      return res.status(200).json({ data: schedule });
    } catch (err) { next(err); }
  },

  /** GET /api/schedule/today */
  async getToday(req, res, next) {
    try {
      const result = await scheduleService.getToday();
      return res.status(200).json(result);
    } catch (err) { next(err); }
  },

  /** GET /api/schedule/notification-check */
  async notificationCheck(req, res, next) {
    try {
      const result = await scheduleService.getNotificationCheck();
      return res.status(200).json(result);
    } catch (err) { next(err); }
  },

  /** PUT /api/schedule */
  updateAll: [
    validate(updateAllSchema),
    async (req, res, next) => {
      try {
        const schedule = await scheduleService.updateAll(req.body.days);
        return res.status(200).json({ data: schedule });
      } catch (err) { next(err); }
    },
  ],

  /** POST /api/schedule/skip-today */
  async skipToday(req, res, next) {
    try {
      const skip = await scheduleService.skipToday();
      return res.status(200).json(skip);
    } catch (err) { next(err); }
  },

  /** POST /api/schedule/dismiss-skip/:skipId */
  async dismissSkip(req, res, next) {
    try {
      await scheduleService.dismissSkip(req.params.skipId);
      return res.status(204).send();
    } catch (err) { next(err); }
  },

  /** POST /api/schedule/rest-today */
  async restToday(req, res, next) {
    try {
      const session = await scheduleService.markRestDayToday(req.body ? req.body.notes : null);
      return res.status(200).json(session);
    } catch (err) { next(err); }
  },
};

module.exports = scheduleController;
