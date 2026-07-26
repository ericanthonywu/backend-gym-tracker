'use strict';

const Joi = require('joi');
const activityService = require('../services/activity.service');
const validate = require('../middlewares/validator');

const createSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  category: Joi.string().max(100).allow('', null).optional(),
  muscleGroup: Joi.string().max(100).allow('', null).optional(),
});

const activityController = {
  /** GET /api/activities */
  async list(req, res, next) {
    try {
      const activities = await activityService.listAll();
      return res.status(200).json(activities);
    } catch (err) { next(err); }
  },

  /** GET /api/activities/search?q=leg */
  async search(req, res, next) {
    try {
      const query = (req.query.q || '').toString();
      const activities = await activityService.search(query);
      return res.status(200).json(activities);
    } catch (err) { next(err); }
  },

  /** POST /api/activities */
  create: [
    validate(createSchema),
    async (req, res, next) => {
      try {
        const activity = await activityService.create(req.body);
        return res.status(201).json(activity);
      } catch (err) { next(err); }
    },
  ],
};

module.exports = activityController;
