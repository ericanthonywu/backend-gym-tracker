'use strict';

const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');

const authController = require('../controllers/auth.controller');
const workoutPlanController = require('../controllers/workout-plan.controller');
const scheduleController = require('../controllers/schedule.controller');
const sessionController = require('../controllers/session.controller');
const weightController = require('../controllers/weight.controller');
const mealController = require('../controllers/meal.controller');
const activityController = require('../controllers/activity.controller');
const statsController = require('../controllers/stats.controller');

const router = Router();

// --- Public ---
router.post('/auth/login', ...authController.login);

// --- Protected (JWT required) ---
router.use(authMiddleware);

// Workout Plans
router.get('/workout-plans', workoutPlanController.list);
router.get('/workout-plans/:id', workoutPlanController.getById);
router.post('/workout-plans', ...workoutPlanController.create);
router.put('/workout-plans/:id', ...workoutPlanController.update);
router.delete('/workout-plans/:id', workoutPlanController.delete);

// Weekly Schedule
router.get('/schedule', scheduleController.getAll);
router.get('/schedule/today', scheduleController.getToday);
router.get('/schedule/notification-check', scheduleController.notificationCheck);
router.put('/schedule', ...scheduleController.updateAll);
router.post('/schedule/skip-today', scheduleController.skipToday);
router.post('/schedule/dismiss-skip/:skipId', scheduleController.dismissSkip);
router.post('/schedule/rest-today', scheduleController.restToday);

// Workout Sessions
router.get('/sessions/active', sessionController.getActive);
router.get('/sessions/history', sessionController.history);
router.get('/sessions/:id', sessionController.getById);
router.post('/sessions/start', ...sessionController.start);
router.post('/sessions/cardio', ...sessionController.logCardio);
router.post('/sessions/:id/sets/:setId', ...sessionController.recordSet);
router.post('/sessions/:id/skip', ...sessionController.skip);
router.post('/sessions/:id/re-enable', ...sessionController.reEnable);
router.get('/sessions/:id/skipped-exercises', sessionController.getSkipped);
router.post('/sessions/:id/complete', ...sessionController.complete);
router.post('/sessions/:id/cancel', sessionController.cancel);
router.delete('/sessions/:id', sessionController.delete);

// Weight
router.get('/weight/latest', weightController.getLatest);
router.get('/weight/chart', weightController.getChart);
router.get('/weight/summary', weightController.getSummary);
router.get('/weight', weightController.list);
router.post('/weight', ...weightController.log);
router.delete('/weight/:id', weightController.delete);

// Meals
router.get('/meals/settings', mealController.getSettings);
router.post('/meals/settings', ...mealController.addSetting);
router.patch('/meals/settings/:id', ...mealController.updateSetting);
router.delete('/meals/settings/:id', mealController.deleteSetting);
router.get('/meals/today', mealController.getToday);
router.patch('/meals/toggle', ...mealController.toggle);
router.get('/meals/summary', mealController.getSummary);

// Master Activities
router.get('/activities', activityController.list);
router.get('/activities/search', activityController.search);
router.post('/activities', ...activityController.create);

// Stats / Progress Graphs
router.get('/stats/exercises', statsController.listExercises);
router.get('/stats/exercises/:exerciseName/progress', statsController.exerciseProgress);

module.exports = router;
