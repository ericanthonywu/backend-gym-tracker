'use strict';

const Joi = require('joi');
const activityService = require('../services/activity.service');
const validate = require('../middlewares/validator');

const createSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  category: Joi.string().max(100).allow('', null).optional(),
  muscleGroup: Joi.string().max(100).allow('', null).optional(),
  activityType: Joi.string().valid('reps', 'time').default('reps').optional(),
  equipment: Joi.string().max(100).allow('', null).optional(),
  level: Joi.string().valid('beginner', 'intermediate', 'expert').allow('', null).optional(),
  force: Joi.string().valid('push', 'pull', 'static').allow('', null).optional(),
  mechanic: Joi.string().valid('compound', 'isolation').allow('', null).optional(),
  primaryMuscles: Joi.array().items(Joi.string()).optional(),
});

const activityController = {
  /** GET /api/activities */
  async list(req, res, next) {
    try {
      const activities = await activityService.listAll();
      return res.status(200).json(activities);
    } catch (err) { next(err); }
  },

  /**
   * GET /api/activities/search?q=leg&muscle=quadriceps&category=strength
   * Both params are optional — omitting both returns all.
   */
  async search(req, res, next) {
    try {
      const query = (req.query.q || '').toString();
      const muscle = (req.query.muscle || '').toString() || null;
      const category = (req.query.category || '').toString() || null;
      const activities = await activityService.search(query, muscle, category);
      return res.status(200).json(activities);
    } catch (err) { next(err); }
  },

  /**
   * GET /api/activities/muscles
   * Returns all distinct primary muscles with exercise counts.
   */
  async listMuscles(req, res, next) {
    try {
      const muscles = await activityService.listMuscles();
      return res.status(200).json(muscles);
    } catch (err) { next(err); }
  },

  /**
   * GET /api/activities/categories
   * Returns all distinct exercise categories with counts.
   */
  async listCategories(req, res, next) {
    try {
      const categories = await activityService.listCategories();
      return res.status(200).json(categories);
    } catch (err) { next(err); }
  },

  /**
   * GET /api/activities/by-muscle/:muscle
   * Returns activities whose PRIMARY muscle matches.
   * Query param ?includeSecondary=true to also include secondary targets.
   */
  async byMuscle(req, res, next) {
    try {
      const muscle = req.params.muscle || '';
      const includeSecondary = req.query.includeSecondary === 'true';

      const activities = includeSecondary
        ? await activityService.listByMuscle(muscle)
        : await activityService.listByPrimaryMuscle(muscle);

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
