'use strict';

const Joi = require('joi');
const workoutPlanService = require('../services/workout-plan.service');
const validate = require('../middlewares/validator');

const exerciseSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  targetSets: Joi.number().integer().min(1).max(20).default(4),
  targetReps: Joi.number().integer().min(1).max(200).default(12),
});

const createSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  exercises: Joi.array().items(exerciseSchema).min(1).required(),
});

const updateSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  exercises: Joi.array().items(exerciseSchema).min(1).required(),
});

const workoutPlanController = {
  /** GET /api/workout-plans */
  async list(req, res, next) {
    try {
      const plans = await workoutPlanService.list();
      return res.status(200).json({ data: plans });
    } catch (err) { next(err); }
  },

  /** GET /api/workout-plans/:id */
  async getById(req, res, next) {
    try {
      const plan = await workoutPlanService.getById(req.params.id);
      return res.status(200).json(plan);
    } catch (err) { next(err); }
  },

  /** POST /api/workout-plans */
  create: [
    validate(createSchema),
    async (req, res, next) => {
      try {
        const plan = await workoutPlanService.create(req.body);
        return res.status(201).json(plan);
      } catch (err) { next(err); }
    },
  ],

  /** PUT /api/workout-plans/:id */
  update: [
    validate(updateSchema),
    async (req, res, next) => {
      try {
        const plan = await workoutPlanService.update(req.params.id, req.body);
        return res.status(200).json(plan);
      } catch (err) { next(err); }
    },
  ],

  /** DELETE /api/workout-plans/:id */
  async delete(req, res, next) {
    try {
      await workoutPlanService.delete(req.params.id);
      return res.status(204).send();
    } catch (err) { next(err); }
  },
};

module.exports = workoutPlanController;
