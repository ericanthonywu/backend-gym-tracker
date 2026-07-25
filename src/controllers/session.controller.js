'use strict';

const Joi = require('joi');
const sessionService = require('../services/session.service');
const validate = require('../middlewares/validator');

const startSchema = Joi.object({
  planId: Joi.string().uuid().required(),
  wasMakeUpSession: Joi.boolean().default(false),
  skipId: Joi.string().uuid().allow(null).optional(),
});

const recordSetSchema = Joi.object({
  reps: Joi.number().integer().min(0).max(999).required(),
  weightKg: Joi.number().min(0).max(999).allow(null).optional(),
});

const exerciseNameSchema = Joi.object({
  exerciseName: Joi.string().min(1).max(255).required(),
});

const completeSchema = Joi.object({
  notes: Joi.string().max(1000).allow('').optional(),
});

const sessionController = {
  /** GET /api/sessions/active */
  async getActive(req, res, next) {
    try {
      const session = await sessionService.getActive();
      return res.status(200).json(session);
    } catch (err) { next(err); }
  },

  /** GET /api/sessions/history */
  async history(req, res, next) {
    try {
      const page = parseInt(req.query.page || '1', 10);
      const limit = parseInt(req.query.limit || '20', 10);
      const result = await sessionService.history({ page, limit });
      return res.status(200).json(result);
    } catch (err) { next(err); }
  },

  /** GET /api/sessions/:id */
  async getById(req, res, next) {
    try {
      const session = await sessionService.getById(req.params.id);
      return res.status(200).json(session);
    } catch (err) { next(err); }
  },

  /** POST /api/sessions/start */
  start: [
    validate(startSchema),
    async (req, res, next) => {
      try {
        const session = await sessionService.start(req.body);
        return res.status(201).json(session);
      } catch (err) { next(err); }
    },
  ],

  /** POST /api/sessions/:id/sets/:setId */
  recordSet: [
    validate(recordSetSchema),
    async (req, res, next) => {
      try {
        const set = await sessionService.recordSet(req.params.id, req.params.setId, req.body);
        return res.status(200).json(set);
      } catch (err) { next(err); }
    },
  ],

  /** POST /api/sessions/:id/skip */
  skip: [
    validate(exerciseNameSchema),
    async (req, res, next) => {
      try {
        const session = await sessionService.skipExercise(req.params.id, req.body.exerciseName);
        return res.status(200).json(session);
      } catch (err) { next(err); }
    },
  ],

  /** POST /api/sessions/:id/re-enable */
  reEnable: [
    validate(exerciseNameSchema),
    async (req, res, next) => {
      try {
        const session = await sessionService.reEnableExercise(req.params.id, req.body.exerciseName);
        return res.status(200).json(session);
      } catch (err) { next(err); }
    },
  ],

  /** GET /api/sessions/:id/skipped-exercises */
  async getSkipped(req, res, next) {
    try {
      const names = await sessionService.getSkippedExercises(req.params.id);
      return res.status(200).json({ skippedExercises: names });
    } catch (err) { next(err); }
  },

  /** POST /api/sessions/:id/complete */
  complete: [
    validate(completeSchema),
    async (req, res, next) => {
      try {
        const session = await sessionService.complete(req.params.id, req.body);
        return res.status(200).json(session);
      } catch (err) { next(err); }
    },
  ],

  /** POST /api/sessions/:id/cancel */
  async cancel(req, res, next) {
    try {
      await sessionService.cancel(req.params.id);
      return res.status(204).send();
    } catch (err) { next(err); }
  },
};

module.exports = sessionController;
