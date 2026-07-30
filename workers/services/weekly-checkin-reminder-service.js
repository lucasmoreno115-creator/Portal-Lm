import { createD1PremiumStudentRepository } from '../premium/repositories/d1-premium-student-repository.js';
import { createD1WeeklyFeedbackRepository } from '../premium/repositories/d1-weekly-feedback-repository.js';
import { createWeeklyFeedbackScheduleService } from '../premium/services/weekly-feedback-schedule-service.js';
import { createPortalNotificationResult, PORTAL_NOTIFICATION_TYPES } from './portal-notification-service.js';
import { deliverPortalPush } from './portal-push-delivery-service.js';

export const WEEKLY_CHECKIN_TIME_ZONE = 'America/Sao_Paulo';

const NOTIFICATION = Object.freeze({
  type: PORTAL_NOTIFICATION_TYPES.WEEKLY_CHECKIN_REMINDER,
  title: 'Hora do seu check-in semanal',
  body: 'Responda seu acompanhamento para que seu planejamento seja atualizado.',
  action_url: '/portal-checkin.html',
});

function localScheduleParts(date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: WEEKLY_CHECKIN_TIME_ZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return Object.fromEntries(formatter.formatToParts(date)
    .filter(({ type }) => type !== 'literal')
    .map(({ type, value }) => [type, value]));
}

export function isWeeklyCheckinReminderTime(date) {
  const local = localScheduleParts(date);
  return local.weekday === 'Sat' && local.hour === '09' && local.minute === '00';
}

function emptyPushSummary() {
  return { subscriptions: 0, sent: 0, failed: 0, expired: 0, deduplicated: 0 };
}

function addPushSummary(total, value = {}) {
  for (const key of Object.keys(total)) total[key] += Number(value[key] || 0);
}

export async function runWeeklyCheckinReminder(env, options = {}) {
  if (!env?.DB) throw new Error('DB binding is required.');
  const scheduledAt = new Date(options.scheduledTime ?? Date.now());
  if (Number.isNaN(scheduledAt.getTime())) throw new Error('scheduledTime inválido.');

  const summary = {
    scheduled_time: scheduledAt.toISOString(),
    operational_week: null,
    eligible: 0,
    created: 0,
    deduplicated: 0,
    already_answered: 0,
    failed_students: 0,
    push: emptyPushSummary(),
  };
  if (!isWeeklyCheckinReminderTime(scheduledAt)) {
    console.info('weekly_checkin_reminder_skipped', summary);
    return { ...summary, skipped: true };
  }

  const scheduleService = options.scheduleService || createWeeklyFeedbackScheduleService({ timeZone: WEEKLY_CHECKIN_TIME_ZONE });
  const studentRepository = options.studentRepository || createD1PremiumStudentRepository(env.DB);
  const feedbackRepository = options.feedbackRepository || createD1WeeklyFeedbackRepository(env.DB);
  const createNotification = options.createNotification || createPortalNotificationResult;
  const deliverPush = options.deliverPush || deliverPortalPush;
  summary.operational_week = scheduleService.getWeekRef(scheduledAt);

  // This repository contract is the canonical Premium consultation rule. Access
  // and weekly eligibility retain the same statuses used by listMissingResponses.
  const activeStudents = await studentRepository.list({ status: 'ACTIVE', limit: 10_000 });
  const eligibleStudents = activeStudents.filter((student) => student.access_status === 'ACTIVE');
  summary.eligible = eligibleStudents.length;

  for (const student of eligibleStudents) {
    try {
      const checkin = await feedbackRepository.findByStudentAndWeek(student.student_id, summary.operational_week);
      if (checkin?.submitted_at) {
        summary.already_answered += 1;
        continue;
      }
      const result = await createNotification(env, {
        ...NOTIFICATION,
        student_id: student.student_id,
        student_email: student.email,
        reference_key: `weekly-checkin-reminder:${student.student_id}:${summary.operational_week}`,
      });
      if (!result.created) {
        summary.deduplicated += 1;
        continue;
      }
      summary.created += 1;
      try {
        addPushSummary(summary.push, await deliverPush(env, result.notification));
      } catch {
        // The internal notification remains authoritative when its delivery channel fails.
        summary.push.failed += 1;
      }
    } catch {
      summary.failed_students += 1;
    }
  }

  console.info('weekly_checkin_reminder_completed', summary);
  return summary;
}
