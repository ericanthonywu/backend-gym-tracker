'use strict';

const Joi = require('joi');
const sessionService = require('../services/session.service');
const validate = require('../middlewares/validator');

// Plan-based start (planId required, but exercises may be provided to override the plan template)
const startSchema = Joi.object({
  planId: Joi.string().uuid().allow(null).optional(),
  planName: Joi.string().max(255).allow(null, '').optional(), // required when planId is null (free-form)
  wasMakeUpSession: Joi.boolean().default(false),
  skipId: Joi.string().uuid().allow(null).optional(),
  // Optional: inline exercise list to override/replace the plan template.
  // Each item: { name, targetSets, targetReps, activityType?, targetDurationSeconds? }
  exercises: Joi.array().items(
    Joi.object({
      name: Joi.string().min(1).max(255).required(),
      targetSets: Joi.number().integer().min(1).max(100).required(),
      targetReps: Joi.number().integer().min(0).max(999).default(0),
      activityType: Joi.string().valid('reps', 'time').default('reps'),
      targetDurationSeconds: Joi.number().integer().min(0).max(86400).allow(null).optional(),
    }),
  ).optional(),
});

const recordSetSchema = Joi.object({
  reps: Joi.number().integer().min(0).max(999).allow(null).optional(),
  weightKg: Joi.number().min(0).max(999).allow(null).optional(),
  durationSeconds: Joi.number().integer().min(0).max(86400).allow(null).optional(),
});

const exerciseNameSchema = Joi.object({
  exerciseName: Joi.string().min(1).max(255).required(),
});

const completeSchema = Joi.object({
  notes: Joi.string().max(1000).allow('', null).optional(),
});

const cardioSchema = Joi.object({
  activityName: Joi.string().min(1).max(255).default('Cardio'),
  durationSeconds: Joi.number().integer().min(0).max(86400).allow(null).optional(),
  speed: Joi.number().min(0).max(100).allow(null).optional(),
  incline: Joi.number().min(0).max(50).allow(null).optional(),
  notes: Joi.string().max(1000).allow('', null).optional(),
});

const addExerciseSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  targetSets: Joi.number().integer().min(1).max(100).required(),
  targetReps: Joi.number().integer().min(0).max(999).default(0),
  activityType: Joi.string().valid('reps', 'time').default('reps'),
  targetDurationSeconds: Joi.number().integer().min(0).max(86400).allow(null).optional(),
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

  /** GET /api/sessions/last-by-plan/:planId */
  async lastByPlan(req, res, next) {
    try {
      const session = await sessionService.getLastByPlan(req.params.planId);
      if (!session) return res.status(404).json({ message: 'No previous session found for this plan' });
      return res.status(200).json(session);
    } catch (err) { next(err); }
  },

  /** GET /api/sessions/:id */
  async getById(req, res, next) {
    try {
      const session = await sessionService.getById(req.params.id);
      return res.status(200).json(session);
    } catch (err) { next(err); }
  },

  /** POST /api/sessions/start
   *  Supports:
   *   - planId only → start session from plan template
   *   - planId + exercises → start session with custom exercise list (overrides template)
   *   - exercises + planName → free-form "quick workout" with no plan
   */
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
        const result = await sessionService.recordSet(req.params.id, req.params.setId, req.body);
        return res.status(200).json(result); // { set, comparison }
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

  /** DELETE /api/sessions/:id */
  async delete(req, res, next) {
    try {
      await sessionService.delete(req.params.id);
      return res.status(204).send();
    } catch (err) { next(err); }
  },

  /** POST /api/sessions/cardio */
  logCardio: [
    validate(cardioSchema),
    async (req, res, next) => {
      try {
        const session = await sessionService.logCardio(req.body);
        return res.status(201).json(session);
      } catch (err) { next(err); }
    },
  ],

  /** POST /api/sessions/:id/add-exercise
   *  Add a new exercise to an already-active session (mid-session custom addition).
   */
  addExercise: [
    validate(addExerciseSchema),
    async (req, res, next) => {
      try {
        const session = await sessionService.addExercise(req.params.id, req.body);
        return res.status(200).json(session);
      } catch (err) { next(err); }
    },
  ],

  /** POST /api/sessions/:id/reorder-exercises
   *  Reorder exercises in an active session.
   */
  reorderExercises: [
    validate(Joi.object({
      exerciseNames: Joi.array().items(Joi.string().required()).min(1).required(),
    })),
    async (req, res, next) => {
      try {
        const session = await sessionService.reorderExercises(req.params.id, req.body.exerciseNames);
        return res.status(200).json(session);
      } catch (err) { next(err); }
    },
  ],

  /** POST /api/sessions/:id/remove-exercise
   *  Remove an exercise (pending sets only) from an active session.
   */
  removeExercise: [
    validate(exerciseNameSchema),
    async (req, res, next) => {
      try {
        const session = await sessionService.removeExercise(req.params.id, req.body.exerciseName);
        return res.status(200).json(session);
      } catch (err) { next(err); }
    },
  ],

  /** POST /api/sessions/:id/edit-exercise
   *  Edit an exercise's target sets/reps in an active session.
   */
  editExercise: [
    validate(Joi.object({
      exerciseName: Joi.string().min(1).max(255).required(),
      targetSets: Joi.number().integer().min(1).max(100).required(),
      targetReps: Joi.number().integer().min(0).max(999).default(0),
      activityType: Joi.string().valid('reps', 'time').default('reps'),
      targetDurationSeconds: Joi.number().integer().min(0).max(86400).allow(null).optional(),
    })),
    async (req, res, next) => {
      try {
        const session = await sessionService.editExercise(req.params.id, req.body);
        return res.status(200).json(session);
      } catch (err) { next(err); }
    },
  ],
};

module.exports = sessionController;
