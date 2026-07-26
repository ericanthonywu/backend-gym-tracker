'use strict';

const statsRepository = require('../repositories/stats.repository');

/**
 * Stats Controller — exercise progress graph endpoints.
 */
const statsController = {
  /**
   * GET /api/stats/exercises
   * List all distinct exercise names that have recorded completed sets.
   */
  async listExercises(req, res, next) {
    try {
      const exercises = await statsRepository.findDistinctExercises();
      return res.status(200).json({ exercises });
    } catch (err) { next(err); }
  },

  /**
   * GET /api/stats/exercises/:exerciseName/progress?days=30
   * Time-series progress for a specific exercise.
   * Query param `days` can be 30, 90, or omitted (all time).
   */
  async exerciseProgress(req, res, next) {
    try {
      const exerciseName = decodeURIComponent(req.params.exerciseName);
      const days = req.query.days ? parseInt(req.query.days, 10) : null;

      const [progress, bests] = await Promise.all([
        statsRepository.findExerciseProgress(exerciseName, days),
        statsRepository.findPersonalBests(exerciseName),
      ]);

      return res.status(200).json({ exerciseName, progress, bests });
    } catch (err) { next(err); }
  },
};

module.exports = statsController;
