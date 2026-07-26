'use strict';

const moment = require('moment-timezone');
const scheduleRepository = require('../repositories/schedule.repository');
const skippedDayRepository = require('../repositories/skipped-day.repository');
const workoutPlanRepository = require('../repositories/workout-plan.repository');
const sessionRepository = require('../repositories/session.repository');
const AppError = require('../utils/app-error');

const TZ = 'Asia/Jakarta';

// Maps JS getDay() (0=Sun…6=Sat) → our day_of_week (0=Mon…6=Sun)
function jsToDbDay(jsDay) {
  return jsDay === 0 ? 6 : jsDay - 1;
}

/**
 * Schedule Service — business logic for the weekly schedule.
 */
const scheduleService = {
  /**
   * Get the full 7-day schedule.
   * @returns {Promise<Array>}
   */
  async getAll() {
    return scheduleRepository.findAll();
  },

  /**
   * Upsert the schedule for all 7 days.
   * @param {Array<{ dayOfWeek: number, planId: string|null, isRestDay: boolean }>} days
   * @returns {Promise<Array>}
   */
  async updateAll(days) {
    // Validate plan IDs exist
    for (const day of days) {
      if (day.planId) {
        const plan = await workoutPlanRepository.findById(day.planId);
        if (!plan) throw new AppError(`Plan not found: ${day.planId}`, 400);
      }
    }
    const results = await Promise.all(days.map((d) => scheduleRepository.upsertDay(d)));
    return scheduleRepository.findAll();
  },

  /**
   * Get today's workout info including any active skip carry-overs.
   * Returns the scheduled plan + any skipped-day banner info.
   *
   * @returns {Promise<{
   *   today: { dayOfWeek: number, dayName: string, plan: Object|null, isRestDay: boolean },
   *   skippedBanner: { message: string, skipId: string, planName: string } | null
   * }>}
   */
  async getToday() {
    const now = moment.tz(TZ);
    const jsDay = now.day(); // 0=Sun
    const dbDay = jsToDbDay(jsDay);
    const todayStr = now.format('YYYY-MM-DD');

    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dayName = dayNames[dbDay];

    // Get today's scheduled plan
    const scheduled = await scheduleRepository.findByDay(dbDay);

    // Check for active skip carry-overs rescheduled to today
    const skipEntry = await skippedDayRepository.findActiveByRescheduledDate(todayStr);

    let skippedBanner = null;
    if (skipEntry) {
      // User-friendly message — Vivian is not a developer
      skippedBanner = {
        skipId: skipEntry.id,
        planName: skipEntry.plan_name,
        message: `You missed ${skipEntry.plan_name} on ${moment.tz(skipEntry.original_date, TZ).format('dddd')} — no worries, you can still crush it today! 💪`,
      };
    }

    // Build today's plan object
    let todayPlan = null;
    if (scheduled && !scheduled.is_rest_day && scheduled.plan_id) {
      const exercises = await workoutPlanRepository.findExercises(scheduled.plan_id);
      todayPlan = {
        id: scheduled.plan_id,
        name: scheduled.plan_name,
        exercises,
      };
    }

    // Check if today already has a rest day session completed
    const todayStart = now.clone().startOf('day').toDate();
    const todayEnd = now.clone().endOf('day').toDate();
    const todaySessions = await sessionRepository.findCompletedSessionsBetween(todayStart, todayEnd);
    const hasRestDayToday = todaySessions.some((s) => s.session_type === 'rest_day');

    return {
      today: {
        dayOfWeek: dbDay,
        dayName,
        isRestDay: (scheduled ? scheduled.is_rest_day : false) || hasRestDayToday,
        markedRestDayToday: hasRestDayToday,
        plan: todayPlan,
      },
      skippedBanner,
      notificationCheck: await this.getNotificationCheck(),
    };
  },

  /**
   * Check if yesterday had a scheduled workout that was missed/skipped.
   * Rest days are NEVER marked as skipped days.
   * Used by frontend notification engine to customize reminder copywriting.
   *
   * @returns {Promise<{ yesterdaySkipped: boolean, yesterdayPlanName: string|null, wasRestDay: boolean }>}
   */
  async getNotificationCheck() {
    const now = moment.tz(TZ);
    const yesterday = now.clone().subtract(1, 'day');
    const dbDay = jsToDbDay(yesterday.day());

    // Check yesterday's schedule
    const scheduled = await scheduleRepository.findByDay(dbDay);

    // Yesterday's completed sessions
    const yesterdayStart = yesterday.clone().startOf('day').toDate();
    const yesterdayEnd = yesterday.clone().endOf('day').toDate();
    const completedSessions = await sessionRepository.findCompletedSessionsBetween(yesterdayStart, yesterdayEnd);

    const hasRestDay = completedSessions.some((s) => s.session_type === 'rest_day');
    const hasGymSession = completedSessions.some((s) => s.session_type === 'gym');

    // If yesterday was marked as a rest day (by session or weekly schedule)
    if (hasRestDay || !scheduled || scheduled.is_rest_day || !scheduled.plan_id) {
      return {
        yesterdaySkipped: false,
        yesterdayPlanName: null,
        wasRestDay: hasRestDay || (scheduled && scheduled.is_rest_day),
      };
    }

    // Yesterday was a scheduled gym workout day:
    if (hasGymSession) {
      // Gym session completed — not skipped!
      return {
        yesterdaySkipped: false,
        yesterdayPlanName: null,
        wasRestDay: false,
      };
    }

    // Scheduled gym workout day with NO gym session and NO rest day mark (even if cardio was logged) -> Marked as skipped!
    return {
      yesterdaySkipped: true,
      yesterdayPlanName: scheduled.plan_name,
      wasRestDay: false,
    };
  },

  /**
   * Mark today as a Rest Day (creates a rest_day session for today).
   * Does NOT alter the user's recurring weekly schedule template.
   * @param {string} [notes]
   * @returns {Promise<Object>}
   */
  async markRestDayToday(notes) {
    const now = moment.tz(TZ);
    const todayStart = now.clone().startOf('day').toDate();
    const todayEnd = now.clone().endOf('day').toDate();

    const existingSessions = await sessionRepository.findCompletedSessionsBetween(todayStart, todayEnd);
    const existingRest = existingSessions.find((s) => s.session_type === 'rest_day');
    if (existingRest) {
      return existingRest; // Already marked rest day today
    }

    const session = await sessionRepository.createSession({
      planName: 'Rest Day',
      status: 'completed',
      sessionType: 'rest_day',
      notes: notes || 'Enjoying recovery day 🛋️',
      startedAt: now.toDate(),
      completedAt: now.toDate(),
    });

    return session;
  },

  /**
   * Mark today as skipped — cascades the plan forward to the next non-rest day,
   * pushing any existing plans further down the chain.
   *
   * @returns {Promise<Object>} the created skipped_days record
   * @throws {AppError} if today has no workout scheduled
   */
  async skipToday() {
    const now = moment.tz(TZ);
    const dbDay = jsToDbDay(now.day());
    const todayStr = now.format('YYYY-MM-DD');

    const scheduled = await scheduleRepository.findByDay(dbDay);
    if (!scheduled || scheduled.is_rest_day || !scheduled.plan_id) {
      throw new AppError('Today is a rest day — nothing to skip!', 400);
    }

    // Find the next available day to reschedule to
    const rescheduledDate = await this._findNextAvailableDate(todayStr, scheduled.plan_id);

    const skip = await skippedDayRepository.create({
      originalDate: todayStr,
      planId: scheduled.plan_id,
      planName: scheduled.plan_name,
      rescheduledTo: rescheduledDate,
    });

    return skip;
  },

  /**
   * Walk forward day by day until we find a date that has no active skip already
   * rescheduled to it. Cascades forward if needed (push rule).
   *
   * @param {string} fromDate 'YYYY-MM-DD'
   * @param {string} planId
   * @returns {Promise<string>} 'YYYY-MM-DD'
   */
  async _findNextAvailableDate(fromDate, planId) {
    let candidate = moment.tz(fromDate, TZ).add(1, 'day');
    let maxAttempts = 14; // safety cap — never loop more than 2 weeks

    while (maxAttempts-- > 0) {
      const candidateStr = candidate.format('YYYY-MM-DD');
      const existingSkip = await skippedDayRepository.findActiveByRescheduledDate(candidateStr);
      if (!existingSkip) {
        return candidateStr; // this date is free
      }
      // Someone else already pushed to this date, keep going
      candidate = candidate.add(1, 'day');
    }

    // Fallback — should never happen in practice
    return moment.tz(fromDate, TZ).add(1, 'day').format('YYYY-MM-DD');
  },

  /**
   * Dismiss a skipped-day banner without completing the workout.
   * @param {string} skipId
   */
  async dismissSkip(skipId) {
    await skippedDayRepository.update(skipId, { isDismissed: true });
  },
};

module.exports = scheduleService;
