import { EVENT_TYPES } from './event-types.js';
import { nullableTrimmed, safeJsonParse, getWeekRef } from './lm-utils.js';
import { buildBaseTimeline, appendActivityRows } from './timeline-engine.js';
import { inferRiskLevelFromOutcome } from './student-lifecycle.js';
import { buildActionUrl } from './command-center.js';
import { buildStudentSummary } from './student360.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    if (method === 'OPTIONS') return corsResponse();

    try {
      await ensureSchema(env.DB);

      if (url.pathname === '/api/health' && method === 'GET') {
        return json({ ok: true, status: 'healthy' });
      }

      if (url.pathname === '/api/diagnostic/evaluate' && method === 'POST') {
        const body = await safeJson(request);
        return json({ ok: true, data: { score: 0, received: body || {} } });
      }


      if (url.pathname === '/api/anamnese-premium' && method === 'POST') {
        const body = await safeJson(request);
        const studentName = nullableTrimmed(body?.student_name);
        const providedEmail = nullableTrimmed(body?.student_email)?.toLowerCase() || null;
        const studentPhone = nullableTrimmed(body?.student_phone);
        const studentEmail = providedEmail;
        const status = nullableTrimmed(body?.status) || 'RECEBIDA';
        const answers = body?.answers && typeof body.answers === 'object' ? body.answers : {};
        const internalScores = calculateAnamnesisInternalScores(answers);

        if (!studentName) {
          return json({ ok: false, error: 'student_name é obrigatório.' }, 400);
        }
        if (!studentEmail) {
          return json({ ok: false, error: 'student_email é obrigatório.' }, 400);
        }
        if (!studentPhone) {
          return json({ ok: false, error: 'student_phone é obrigatório.' }, 400);
        }

        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        await env.DB.prepare(
          `INSERT INTO premium_anamnesis (
            id, student_name, student_email, student_phone, status,
            answers_json, internal_scores_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id,
          studentName,
          studentEmail,
          studentPhone,
          status,
          JSON.stringify(answers),
          JSON.stringify(internalScores),
          now,
          now
        ).run();
        await logActivityEvent(env.DB, { student_email: studentEmail, event_type: EVENT_TYPES.ANAMNESE_SUBMITTED, source: 'portal', title: 'Anamnese enviada', payload: { anamnesis_id: id, status } });

        const normalizedWhatsapp = normalizeWhatsapp(studentPhone);
        const existingAccess = await env.DB.prepare(
          `SELECT id, name, email, access_token, status, plan_type, whatsapp
           FROM student_access
           WHERE lower(email)=?
           LIMIT 1`
        ).bind(studentEmail).first();

        let accessCreated = false;
        let accessStatus = 'PENDING_ONBOARDING';

        if (!existingAccess) {
          await env.DB.prepare(
            `INSERT INTO student_access (
              id, name, email, access_token, status, plan_type, whatsapp, created_at
            ) VALUES (?, ?, ?, ?, 'PENDING_ONBOARDING', 'PREMIUM', ?, ?)`
          ).bind(
            crypto.randomUUID(),
            studentName,
            studentEmail,
            generateAccessToken(),
            normalizedWhatsapp,
            now
          ).run();
          accessCreated = true;
        } else {
          const ensuredToken = nullableTrimmed(existingAccess.access_token) || generateAccessToken();
          accessStatus = nullableTrimmed(existingAccess.status) || 'PENDING_ONBOARDING';
          await env.DB.prepare(
            `UPDATE student_access
             SET name=?, access_token=?, status=?, plan_type=?, whatsapp=?
             WHERE id=?`
          ).bind(
            nullableTrimmed(existingAccess.name) || studentName,
            ensuredToken,
            accessStatus,
            nullableTrimmed(existingAccess.plan_type) || 'PREMIUM',
            nullableTrimmed(existingAccess.whatsapp) || normalizedWhatsapp,
            existingAccess.id
          ).run();
        }

        return json({ ok: true, data: { id, created_at: now, access_created: accessCreated, access_status: accessStatus } });
      }

      if (url.pathname === '/api/portal/login' && method === 'POST') {
        const body = await safeJson(request);
        const email = String(body?.email || '').trim().toLowerCase();
        const token = String(body?.token || '').trim();

        if (!email || !token) {
          return json({ ok: false, error: 'Email e token são obrigatórios.' }, 400);
        }

        const student = await env.DB.prepare(
          `SELECT name, email, plan_type, plan FROM student_access WHERE lower(email)=? AND access_token=? AND status='ACTIVE'`
        ).bind(email, token).first();

        if (!student) {
          return json({ ok: false, error: 'Credenciais inválidas.' }, 401);
        }

        return json({
          ok: true,
          data: {
            name: student.name,
            email: student.email,
            planType: student.plan_type || 'PREMIUM',
            plan: normalizeStudentPlan(student.plan)
          }
        });
      }

      if (url.pathname.startsWith('/api/portal/')) {
        const auth = await validateStudent(request, env.DB);
        if (!auth.ok) return json({ ok: false, error: auth.error }, 401);

        const studentEmail = auth.student.email;

        if (url.pathname === '/api/portal/me' && method === 'GET') {
          return json({ ok: true, data: auth.student });
        }

        if (url.pathname === '/api/portal/project-lm/profile' && method === 'GET') {
          const profile = await getProjectLmProfile(env.DB, studentEmail);
          return json({ ok: true, data: profile });
        }

        if (url.pathname === '/api/portal/project-lm/profile' && method === 'POST') {
          const body = await safeJson(request);
          const goal = sanitizeProjectLmValue(body?.goal);
          const mainDifficulty = sanitizeProjectLmValue(body?.mainDifficulty);

          if (!PROJECT_LM_GOALS.has(goal)) {
            return json({ ok: false, error: 'goal inválido.' }, 400);
          }
          if (!PROJECT_LM_DIFFICULTIES.has(mainDifficulty)) {
            return json({ ok: false, error: 'mainDifficulty inválido.' }, 400);
          }

          const now = new Date().toISOString();
          await env.DB.prepare(
            `INSERT INTO project_lm_profile (
              student_email, goal, main_difficulty, onboarding_completed, created_at, updated_at
            ) VALUES (?, ?, ?, 1, ?, ?)
            ON CONFLICT(student_email) DO UPDATE SET
              goal=excluded.goal,
              main_difficulty=excluded.main_difficulty,
              onboarding_completed=1,
              updated_at=excluded.updated_at`
          ).bind(studentEmail, goal, mainDifficulty, now, now).run();

          const profile = await getProjectLmProfile(env.DB, studentEmail);
          return json({ ok: true, data: profile });
        }

        if (url.pathname === '/api/portal/weekly-plan' && method === 'GET') {
          const weeklyPlan = await env.DB.prepare(
            `SELECT training_focus, cardio_target, nutrition_focus, main_risk, coach_message
             FROM weekly_plans
             WHERE student_email=? AND status='ACTIVE'
             ORDER BY updated_at DESC
             LIMIT 1`
          ).bind(studentEmail).first();

          return json({ ok: true, data: weeklyPlan || null });
        }


        if (url.pathname === '/api/portal/nutrition-plan' && method === 'GET') {
          const plan = await getActiveNutritionPlanByEmail(env.DB, studentEmail);
          if (!plan) {
            return json({
              ok: true,
              data: null,
              message: 'Seu plano alimentar ainda não foi liberado no portal. Assim que estiver disponível, ele aparecerá aqui.'
            });
          }
          return json({ ok: true, data: plan });
        }

        if (url.pathname === '/api/portal/checkin' && method === 'POST') {
          const body = await safeJson(request);
          const now = new Date().toISOString();
          const weekRef = getWeekRef(new Date());
          const id = crypto.randomUUID();

          await env.DB.prepare(`INSERT INTO student_checkins (
            id, student_email, week_ref, training_adherence, nutrition_adherence, cardio_adherence,
            free_meals, hunger_level, binge_or_snacking, sleep_quality, energy_level, stress_level,
            weekly_weight, waist, strength_status, main_difficulty, routine_context, weekly_score,
            support_needed, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(
            id,
            studentEmail,
            weekRef,
            body?.trainingAdherence || null,
            body?.nutritionAdherence || null,
            body?.cardioAdherence || null,
            body?.freeMeals || null,
            body?.hungerLevel || null,
            body?.bingeOrSnacking || null,
            body?.sleepQuality || null,
            body?.energyLevel || null,
            body?.stressLevel || null,
            body?.weeklyWeight || null,
            body?.waist || null,
            body?.strengthStatus || null,
            body?.mainDifficulty || null,
            body?.routineContext || null,
            body?.weeklyScore || null,
            body?.supportNeeded || null,
            now
          ).run();
          await logActivityEvent(env.DB, { student_email: studentEmail, event_type: EVENT_TYPES.CHECKIN_SUBMITTED, source: 'portal', title: 'Check-in enviado', payload: { checkin_id: id, week_ref: weekRef } });

          return json({ ok: true, data: { id, weekRef, createdAt: now } });
        }

        if (url.pathname === '/api/portal/checkins' && method === 'GET') {
          const { results } = await env.DB.prepare(
            `SELECT id, student_email, week_ref, training_adherence, nutrition_adherence, cardio_adherence, free_meals, hunger_level, binge_or_snacking, sleep_quality, energy_level, stress_level, weekly_weight, waist, strength_status, main_difficulty, routine_context, weekly_score, support_needed, created_at, coach_status, coach_reply, coach_reply_at FROM student_checkins WHERE student_email=? ORDER BY created_at DESC LIMIT 20`
          ).bind(studentEmail).all();

          return json({ ok: true, data: results || [] });
        }

        if (url.pathname === '/api/portal/progression' && method === 'POST') {
          const body = await safeJson(request);
          const id = crypto.randomUUID();
          const now = new Date().toISOString();

          await env.DB.prepare(
            `INSERT INTO progression_logs (
              id, student_email, exercise, target_zone, load_used, reps_done, rir, decision, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            id,
            studentEmail,
            body?.exercise || 'Exercício',
            body?.targetZone || '8–10',
            Number(body?.loadUsed || 0),
            Number(body?.repsDone || 0),
            body?.rir || 'Não sei',
            body?.decision || 'Manter carga',
            now
          ).run();
          await logActivityEvent(env.DB, { student_email: studentEmail, event_type: EVENT_TYPES.PROGRESSION_LOG_SUBMITTED, source: 'portal', title: 'Progresso registrado', payload: { progression_id: id } });

          return json({ ok: true, data: { id, createdAt: now } });
        }

        if (url.pathname === '/api/portal/progression' && method === 'GET') {
          const { results } = await env.DB.prepare(
            `SELECT * FROM progression_logs WHERE student_email=? ORDER BY created_at DESC LIMIT 30`
          ).bind(studentEmail).all();

          return json({ ok: true, data: results || [] });
        }
      }

      if (url.pathname.startsWith('/api/admin/')) {
        if (!isAdminAuthorized(request, env)) {
          return json({ ok: false, error: 'Unauthorized' }, 401);
        }


        if (url.pathname === '/api/admin/students' && method === 'GET') {
          const search = String(url.searchParams.get('search') || '').trim().toLowerCase();
          const where = [];
          const params = [];
          if (search) {
            where.push(`(lower(name) LIKE ? OR lower(email) LIKE ? OR lower(COALESCE(whatsapp, '')) LIKE ?)`);
            const term = `%${search}%`;
            params.push(term, term, term);
          }

          const query = `SELECT name, email, status, plan_type, whatsapp
             FROM student_access
             ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
             ORDER BY CASE upper(status)
               WHEN 'ACTIVE' THEN 0
               WHEN 'PENDING_ONBOARDING' THEN 1
               WHEN 'INACTIVE' THEN 2
               ELSE 3
             END,
             lower(name) ASC
             LIMIT 100`;
          const { results = [] } = await env.DB.prepare(query).bind(...params).all();

          return json((results || []).map((student) => ({
            name: student.name || '',
            email: student.email || '',
            status: student.status || '',
            plan_type: student.plan_type || '',
            whatsapp: student.whatsapp || ''
          })));
        }


        if (url.pathname === '/api/admin/student-360' && method === 'GET') {
          const email = String(url.searchParams.get('email') || '').trim().toLowerCase();
          if (!email) {
            return json({ ok: false, error: 'email é obrigatório.' }, 400);
          }

          const studentAccess = await env.DB.prepare(
            `SELECT name, email, whatsapp, plan_type, status, access_token
             FROM student_access
             WHERE lower(email)=?
             LIMIT 1`
          ).bind(email).first();

          const latestAnamnesis = await env.DB.prepare(
            `SELECT id, student_name, student_email, student_phone, status, answers_json, internal_scores_json, created_at, updated_at
             FROM premium_anamnesis
             WHERE lower(student_email)=?
             ORDER BY created_at DESC
             LIMIT 1`
          ).bind(email).first();

          const latestCheckin = await env.DB.prepare(
            `SELECT id, student_email, week_ref, training_adherence, nutrition_adherence, cardio_adherence, free_meals, hunger_level,
                    binge_or_snacking, sleep_quality, energy_level, stress_level, weekly_weight, waist, strength_status,
                    main_difficulty, routine_context, weekly_score, support_needed, coach_status, coach_reply, coach_reply_at, created_at
             FROM student_checkins
             WHERE lower(student_email)=?
             ORDER BY created_at DESC
             LIMIT 1`
          ).bind(email).first();

          const activeWeeklyPlan = await env.DB.prepare(
            `SELECT id, student_email, week_ref, training_focus, cardio_target, nutrition_focus, main_risk, coach_message, status, updated_at
             FROM weekly_plans
             WHERE lower(student_email)=? AND week_ref=?
             ORDER BY updated_at DESC
             LIMIT 1`
          ).bind(email, getWeekRef(new Date())).first();

          const activeNutritionPlan = await getActiveNutritionPlanByEmail(env.DB, email);


          const latestWeeklyPlanByEmail = await env.DB.prepare(
            `SELECT id, student_email, week_ref, training_focus, cardio_target, nutrition_focus, main_risk, coach_message, status, updated_at
             FROM weekly_plans
             WHERE lower(student_email)=?
             ORDER BY updated_at DESC
             LIMIT 1`
          ).bind(email).first();

          const hasAnyData = Boolean(
            studentAccess
            || latestAnamnesis
            || latestCheckin
            || activeNutritionPlan
            || latestWeeklyPlanByEmail
          );

          if (!hasAnyData) {
            return json({ ok: false, error: 'Nenhum dado encontrado para este email. Verifique se há acesso, anamnese, check-in ou plano alimentar cadastrado.' }, 404);
          }

          const student = buildStudentSummary({ studentAccess, latestAnamnesis, latestCheckin, activeNutritionPlan, email });
          const timeline = buildBaseTimeline({ latestAnamnesis, latestCheckin, activeWeeklyPlan, activeNutritionPlan });

          const timelineType = String(url.searchParams.get('timeline_type') || '').trim().toUpperCase() || null;
          const timelineLimitRaw = Number(url.searchParams.get('timeline_limit') || 30);
          const timelineLimit = Number.isFinite(timelineLimitRaw) ? Math.min(Math.max(Math.trunc(timelineLimitRaw), 1), 100) : 30;
          const whereTimeline = ['lower(student_email)=?'];
          const timelineParams = [email];
          if (timelineType) { whereTimeline.push('event_type=?'); timelineParams.push(timelineType); }
          const { results: activityRows = [] } = await env.DB.prepare(`SELECT event_type, created_at, title, metadata_json FROM activity_timeline WHERE ${whereTimeline.join(' AND ')} ORDER BY datetime(created_at) DESC LIMIT ?`).bind(...timelineParams, timelineLimit).all();
          appendActivityRows(timeline, activityRows);

          const clinicalPriority = computeClinicalPriority(latestCheckin, activeWeeklyPlan);
          const nextRecommendedAction = computeNextRecommendedAction(latestCheckin, activeWeeklyPlan);

          

          return json({
            ok: true,
            data: {
              student,
              latest_anamnesis: latestAnamnesis || null,
              latest_checkin: latestCheckin || null,
              active_weekly_plan: activeWeeklyPlan || null,
              active_nutrition_plan: activeNutritionPlan || null,
              clinical_priority: clinicalPriority,
              next_recommended_action: nextRecommendedAction,
              timeline
            }
          });
        }

        if (url.pathname === '/api/admin/student-access' && method === 'POST') {
          const body = await safeJson(request);

          const name = String(body?.name || '').trim();
          const email = String(body?.email || '').trim().toLowerCase();
          const accessToken = String(body?.access_token || '').trim();
          const planType = String(body?.plan_type || 'PREMIUM').trim();
          const status = String(body?.status || 'ACTIVE').trim();
          const whatsapp = normalizeWhatsapp(body?.whatsapp);

          if (!name || !email || !accessToken) {
            return json({
              ok: false,
              error: 'name, email e access_token são obrigatórios.'
            }, 400);
          }

          const existing = await env.DB.prepare(
            `SELECT id FROM student_access WHERE lower(email)=? LIMIT 1`
          ).bind(email).first();

          if (existing) {
            await env.DB.prepare(
              `UPDATE student_access
               SET name=?, access_token=?, plan_type=?, status=?, whatsapp=?
               WHERE id=?`
            ).bind(
              name,
              accessToken,
              planType,
              status,
              whatsapp,
              existing.id
            ).run();
          } else {
            await env.DB.prepare(
              `INSERT INTO student_access (
                id, name, email, access_token, plan_type, status, whatsapp, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              crypto.randomUUID(),
              name,
              email,
              accessToken,
              planType,
              status,
              whatsapp,
              new Date().toISOString()
            ).run();
          }

          return json({
            ok: true,
            data: {
              name,
              email,
              planType,
              status,
              whatsapp
            }
          });
        }

        if (url.pathname === '/api/admin/student-access/token' && method === 'POST') {
          const body = await safeJson(request);
          const email = String(body?.email || '').trim().toLowerCase();
          if (!email) {
            return json({ ok: false, error: 'email é obrigatório.' }, 400);
          }

          const existing = await env.DB.prepare(
            `SELECT id FROM student_access WHERE lower(email)=? LIMIT 1`
          ).bind(email).first();

          if (!existing) {
            return json({ ok: false, error: 'Aluno não encontrado no student_access.' }, 404);
          }

          const accessToken = generateAccessToken();
          await env.DB.prepare(
            `UPDATE student_access SET access_token=? WHERE id=?`
          ).bind(accessToken, existing.id).run();

          await logActivityEvent(env.DB, {
            student_email: email,
            event_type: EVENT_TYPES.STUDENT_TOKEN_UPDATED,
            source: 'admin',
            title: 'Token de acesso atualizado',
            payload: { reason: 'Token regenerado pelo Student 360' }
          });

          return json({ ok: true, data: { email, access_token: accessToken, token: accessToken } });
        }

        if (url.pathname === '/api/admin/student-access/activate' && method === 'POST') {
          const body = await safeJson(request);
          const email = String(body?.email || '').trim().toLowerCase();
          if (!email) {
            return json({ ok: false, error: 'email é obrigatório.' }, 400);
          }

          const existing = await env.DB.prepare(
            `SELECT id, status FROM student_access WHERE lower(email)=? LIMIT 1`
          ).bind(email).first();

          if (!existing) {
            return json({ ok: false, error: 'Aluno não encontrado no student_access.' }, 404);
          }

          await env.DB.prepare(
            `UPDATE student_access SET status='ACTIVE' WHERE id=?`
          ).bind(existing.id).run();

          const previousStatus = String(existing.status || '').toUpperCase();
          if (previousStatus !== 'ACTIVE') {
            await logActivityEvent(env.DB, {
              student_email: email,
              event_type: EVENT_TYPES.STUDENT_REACTIVATED,
              source: 'admin',
              title: 'Acesso liberado',
              payload: { previous_status: previousStatus || null, new_status: 'ACTIVE', reason: 'Liberação manual pelo Student 360' }
            });
          }

          return json({ ok: true, data: { email, status: 'ACTIVE' } });
        }

        if (url.pathname === '/api/admin/student-access/status' && method === 'POST') {
          const body = await safeJson(request);
          const email = String(body?.email || '').trim().toLowerCase();
          const requestedStatus = String(body?.status || '').trim().toUpperCase();
          const reason = nullableTrimmed(body?.reason);
          if (!email) {
            return json({ ok: false, error: 'email é obrigatório.' }, 400);
          }
          if (!['ACTIVE', 'INACTIVE'].includes(requestedStatus)) {
            return json({ ok: false, error: 'status deve ser ACTIVE ou INACTIVE.' }, 400);
          }

          const existing = await env.DB.prepare(
            `SELECT id, status FROM student_access WHERE lower(email)=? LIMIT 1`
          ).bind(email).first();
          if (!existing) {
            return json({ ok: false, error: 'Aluno não encontrado no student_access.' }, 404);
          }

          await env.DB.prepare(
            `UPDATE student_access SET status=? WHERE id=?`
          ).bind(requestedStatus, existing.id).run();

          const previousStatus = String(existing.status || '').toUpperCase();
          if (previousStatus !== requestedStatus) {
            const eventType = requestedStatus === 'INACTIVE' ? EVENT_TYPES.STUDENT_INACTIVATED : EVENT_TYPES.STUDENT_REACTIVATED;
            const title = requestedStatus === 'INACTIVE' ? 'Aluno inativado' : 'Aluno reativado';
            await logActivityEvent(env.DB, {
              student_email: email,
              event_type: eventType,
              source: 'admin',
              title,
              payload: { previous_status: previousStatus || null, new_status: requestedStatus, reason: reason || null }
            });
          }

          return json({ ok: true, data: { email, status: requestedStatus, reason: reason || null } });
        }

        if (url.pathname === '/api/admin/reactivation-contact' && method === 'POST') {
          const body = await readJson(request);
          const email = String(body?.email || '').trim().toLowerCase();
          if (!email) {
            return json({ ok: false, error: 'email é obrigatório.' }, 400);
          }
          const reason = nullableTrimmed(body?.reason) || 'Contato de reativação enviado pelo Command Center';
          await logActivityEvent(env.DB, {
            student_email: email,
            event_type: EVENT_TYPES.REACTIVATION_CONTACT_SENT,
            source: 'admin',
            title: 'Contato de reativação enviado',
            payload: { reason }
          });

          return json({ ok: true, data: { email, event_type: EVENT_TYPES.REACTIVATION_CONTACT_SENT, reason } });
        }

        if (url.pathname === '/api/admin/followup-log' && method === 'POST') {
          const body = await safeJson(request);
          const studentEmail = String(body?.student_email || '').trim().toLowerCase();
          const contactType = String(body?.contact_type || 'WHATSAPP').trim().toUpperCase() || 'WHATSAPP';
          const reason = body?.reason == null ? null : String(body.reason).trim() || null;
          const note = body?.note == null ? null : String(body.note).trim() || null;
          const outcome = body?.outcome == null ? null : String(body.outcome).trim().toUpperCase() || null;
          const incomingRiskLevel = body?.risk_level == null ? null : String(body.risk_level).trim().toUpperCase() || null;
          const nextAction = body?.next_action == null ? null : String(body.next_action).trim().toUpperCase() || null;
          const riskLevel = incomingRiskLevel || inferRiskLevelFromOutcome(outcome);

          if (!studentEmail) {
            return json({ ok: false, error: 'student_email é obrigatório.' }, 400);
          }

          const id = crypto.randomUUID();
          const createdAt = new Date().toISOString();
          const dueDate = resolveDueDate(nextAction, createdAt);
          const resolutionStatus = resolveResolutionStatus(nextAction, dueDate);

          await env.DB.prepare(
            `INSERT INTO followup_logs (
              id, student_email, contact_type, reason, note, outcome, risk_level, next_action, due_date, resolution_status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(id, studentEmail, contactType, reason, note, outcome, riskLevel, nextAction, dueDate, resolutionStatus, createdAt).run();
          await logActivityEvent(env.DB, { student_email: studentEmail, event_type: EVENT_TYPES.FOLLOWUP_LOGGED, source: 'admin', title: 'Follow-up registrado', payload: { followup_id: id } });

          return json({
            ok: true,
            data: {
              id,
              student_email: studentEmail,
              contact_type: contactType,
              reason,
              note,
              outcome,
              risk_level: riskLevel,
              next_action: nextAction,
              due_date: dueDate,
              resolution_status: resolutionStatus,
              created_at: createdAt
            }
          });
        }

        if (url.pathname === '/api/admin/followup-logs' && method === 'GET') {
          const { results = [] } = await env.DB.prepare(
            `SELECT id, student_email, contact_type, reason, note, outcome, risk_level, next_action, due_date, resolved_at, resolution_status, created_at
             FROM followup_logs
             ORDER BY created_at DESC
             LIMIT 30`
          ).all();

          return json({ ok: true, data: results });
        }



        if (url.pathname === '/api/admin/followup-resolve' && method === 'POST') {
          const body = await safeJson(request);
          const followupId = String(body?.id || '').trim();
          const studentEmail = String(body?.student_email || '').trim().toLowerCase();
          const resolutionStatus = String(body?.resolution_status || 'RESOLVED').trim().toUpperCase() || 'RESOLVED';

          if (!followupId && !studentEmail) {
            return json({ ok: false, error: 'id ou student_email é obrigatório.' }, 400);
          }

          const now = new Date().toISOString();

          if (followupId) {
            await env.DB.prepare(
              `UPDATE followup_logs
               SET resolved_at=?, resolution_status=?
               WHERE id=?`
            ).bind(now, resolutionStatus, followupId).run();
          } else {
            await env.DB.prepare(
              `UPDATE followup_logs
               SET resolved_at=?, resolution_status=?
               WHERE lower(student_email)=?
                 AND (resolution_status IS NULL OR resolution_status='OPEN')`
            ).bind(now, resolutionStatus, studentEmail).run();
          }

          return json({
            ok: true,
            data: {
              id: followupId || null,
              student_email: studentEmail || null,
              resolved_at: now,
              resolution_status: resolutionStatus
            }
          });
        }

        if (url.pathname === '/api/admin/retention-action' && method === 'POST') {
          const body = await safeJson(request);
          const studentEmail = String(body?.student_email || '').trim().toLowerCase();
          const financialReason = body?.financial_reason == null ? null : String(body.financial_reason).trim() || null;
          const proposedAction = String(body?.proposed_action || '').trim().toUpperCase();
          const acceptedStatus = String(body?.accepted_status || 'OFFERED').trim().toUpperCase() || 'OFFERED';
          const note = body?.note == null ? null : String(body.note).trim() || null;

          if (!studentEmail || !proposedAction) {
            return json({ ok: false, error: 'student_email e proposed_action são obrigatórios.' }, 400);
          }

          if (!RETENTION_PROPOSED_ACTIONS.includes(proposedAction)) {
            return json({ ok: false, error: 'proposed_action inválido.' }, 400);
          }

          if (!RETENTION_ACCEPTED_STATUS.includes(acceptedStatus)) {
            return json({ ok: false, error: 'accepted_status inválido.' }, 400);
          }

          const id = crypto.randomUUID();
          const createdAt = new Date().toISOString();

          await env.DB.prepare(
            `INSERT INTO retention_actions (
              id, student_email, financial_reason, proposed_action, accepted_status, note, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).bind(id, studentEmail, financialReason, proposedAction, acceptedStatus, note, createdAt).run();

          return json({
            ok: true,
            data: {
              id,
              student_email: studentEmail,
              financial_reason: financialReason,
              proposed_action: proposedAction,
              accepted_status: acceptedStatus,
              note,
              created_at: createdAt
            }
          });
        }

        if (url.pathname === '/api/admin/retention-actions' && method === 'GET') {
          const { results = [] } = await env.DB.prepare(
            `SELECT student_email, financial_reason, proposed_action, accepted_status, note, created_at
             FROM retention_actions
             ORDER BY created_at DESC
             LIMIT 30`
          ).all();

          return json({ ok: true, data: results });
        }

        if (url.pathname === '/api/admin/weekly-plan' && method === 'POST') {
          const body = await safeJson(request);

          const studentEmail = String(body?.student_email || '').trim().toLowerCase();
          const weekRef = String(body?.week_ref || '').trim();

          if (!studentEmail || !weekRef) {
            return json({ ok: false, error: 'student_email e week_ref são obrigatórios.' }, 400);
          }

          const now = new Date().toISOString();

          const existing = await env.DB.prepare(
            `SELECT id FROM weekly_plans WHERE student_email=? AND week_ref=? LIMIT 1`
          ).bind(studentEmail, weekRef).first();

          const trainingFocus = body?.training_focus || null;
          const cardioTarget = body?.cardio_target || null;
          const nutritionFocus = body?.nutrition_focus || null;
          const mainRisk = body?.main_risk || null;
          const coachMessage = body?.coach_message || null;

          const id = existing?.id || crypto.randomUUID();

          if (existing) {
            await env.DB.prepare(
              `UPDATE weekly_plans
               SET training_focus=?, cardio_target=?, nutrition_focus=?, main_risk=?, coach_message=?, status='ACTIVE', updated_at=?
               WHERE id=?`
            ).bind(
              trainingFocus,
              cardioTarget,
              nutritionFocus,
              mainRisk,
              coachMessage,
              now,
              id
            ).run();
          } else {
            await env.DB.prepare(
              `INSERT INTO weekly_plans (
                id, student_email, week_ref, training_focus, cardio_target,
                nutrition_focus, main_risk, coach_message, status, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`
            ).bind(
              id,
              studentEmail,
              weekRef,
              trainingFocus,
              cardioTarget,
              nutritionFocus,
              mainRisk,
              coachMessage,
              now,
              now
            ).run();
          }

          await logActivityEvent(env.DB, { student_email: studentEmail, event_type: EVENT_TYPES.WEEKLY_PLAN_UPDATED, source: 'admin', title: 'Plano semanal atualizado', payload: { weekly_plan_id: id, week_ref: weekRef } });

          const saved = await env.DB.prepare(
            `SELECT id, student_email, week_ref, training_focus, cardio_target,
                    nutrition_focus, main_risk, coach_message, status, created_at, updated_at
             FROM weekly_plans
             WHERE id=?`
          ).bind(id).first();

          return json({ ok: true, data: saved });
        }

        if (url.pathname === '/api/admin/nutrition-plan' && method === 'GET') {
          const email = String(url.searchParams.get('email') || '').trim().toLowerCase();
          if (!email) {
            return json({ ok: false, error: 'email é obrigatório.' }, 400);
          }

          const plan = await getActiveNutritionPlanByEmail(env.DB, email);
          return json({ ok: true, data: plan || null });
        }

        if (url.pathname === '/api/admin/nutrition-plan' && method === 'POST') {
          const body = await safeJson(request);
          const studentEmail = String(body?.student_email || '').trim().toLowerCase();
          const title = nullableTrimmed(body?.title);
          const goal = nullableTrimmed(body?.goal);
          const strategy = nullableTrimmed(body?.strategy);
          const notes = nullableTrimmed(body?.notes);
          const whatsappMessage = nullableTrimmed(body?.whatsapp_message);
          const meals = body?.meals;
          const substitutions = body?.substitutions ?? [];
          const adherenceRules = body?.adherence_rules ?? [];

          if (!studentEmail) return json({ ok: false, error: 'student_email é obrigatório.' }, 400);
          if (!Array.isArray(meals) || meals.length === 0) {
            return json({ ok: false, error: 'meals deve ser um array com pelo menos uma refeição.' }, 400);
          }
          if (!Array.isArray(substitutions)) {
            return json({ ok: false, error: 'substitutions deve ser um array.' }, 400);
          }
          if (!Array.isArray(adherenceRules)) {
            return json({ ok: false, error: 'adherence_rules deve ser um array.' }, 400);
          }

          const now = new Date().toISOString();
          const id = crypto.randomUUID();

          await env.DB.prepare(
            `UPDATE nutrition_plans
             SET is_active=0, updated_at=?
             WHERE lower(student_email)=? AND is_active=1`
          ).bind(now, studentEmail).run();

          await env.DB.prepare(
            `INSERT INTO nutrition_plans (
              id, student_email, title, goal, strategy, meals_json, substitutions_json,
              adherence_rules_json, notes, whatsapp_message, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
          ).bind(
            id,
            studentEmail,
            title,
            goal,
            strategy,
            JSON.stringify(meals),
            JSON.stringify(substitutions),
            JSON.stringify(adherenceRules),
            notes,
            whatsappMessage,
            now,
            now
          ).run();

          await logActivityEvent(env.DB, { student_email: studentEmail, event_type: EVENT_TYPES.NUTRITION_PLAN_UPDATED, source: 'admin', title: 'Plano alimentar atualizado', payload: { nutrition_plan_id: id } });
          const saved = await getActiveNutritionPlanByEmail(env.DB, studentEmail);
          return json({ ok: true, data: saved });
        }


        if (url.pathname === '/api/admin/checkins' && method === 'GET') {
          const statusFilter = nullableTrimmed(url.searchParams.get('status'));
          const studentEmailFilter = nullableTrimmed(url.searchParams.get('student_email'))?.toLowerCase() || null;
          const limitRaw = Number(url.searchParams.get('limit') || 50);
          const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 200) : 50;

          const where = [];
          const params = [];

          if (statusFilter && statusFilter !== 'all') {
            where.push('sc.coach_status = ?');
            params.push(statusFilter);
          }

          if (studentEmailFilter) {
            where.push(`(lower(sc.student_email) LIKE ? OR lower(coalesce(sa.name,'')) LIKE ?)`);
            const like = `%${studentEmailFilter}%`;
            params.push(like, like);
          }

          const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

          const query = `SELECT
              sc.id,
              sc.student_email,
              coalesce(sa.name, '') AS student_name,
              sc.created_at,
              sc.training_adherence,
              sc.nutrition_adherence,
              sc.cardio_adherence,
              sc.free_meals,
              sc.hunger_level,
              sc.binge_or_snacking,
              sc.sleep_quality,
              sc.energy_level,
              sc.stress_level,
              sc.weekly_weight,
              sc.waist,
              sc.strength_status,
              sc.main_difficulty,
              sc.routine_context,
              sc.weekly_score,
              sc.support_needed,
              sc.coach_status,
              sc.coach_reply,
              sc.coach_reply_at
            FROM student_checkins sc
            LEFT JOIN student_access sa ON lower(sa.email) = lower(sc.student_email)
            ${whereSql}
            ORDER BY sc.created_at DESC
            LIMIT ?`;

          const { results } = await env.DB.prepare(query).bind(...params, limit).all();
          return json({ ok: true, data: results || [] });
        }

        if (/^\/api\/admin\/checkins\/[^/]+\/reply$/.test(url.pathname) && method === 'PATCH') {
          const id = decodeURIComponent(url.pathname.split('/')[4] || '').trim();
          if (!id) {
            return json({ ok: false, error: 'id é obrigatório.' }, 400);
          }

          const body = await safeJson(request);
          const coachReply = nullableTrimmed(body?.coach_reply);
          const coachStatus = nullableTrimmed(body?.coach_status) || 'replied';

          if (!coachReply) {
            return json({ ok: false, error: 'coach_reply é obrigatório.' }, 400);
          }

          const now = new Date().toISOString();
          const reviewedBy = request.headers.get('x-admin-user') || 'admin';

          const existing = await env.DB.prepare(
            `SELECT id FROM student_checkins WHERE id=? LIMIT 1`
          ).bind(id).first();

          if (!existing) {
            return json({ ok: false, error: 'Check-in não encontrado.' }, 404);
          }

          await env.DB.prepare(
            `UPDATE student_checkins
             SET coach_reply=?,
                 coach_reply_at=?,
                 coach_status=?,
                 reviewed_at=?,
                 reviewed_by=?
             WHERE id=?`
          ).bind(coachReply, now, coachStatus, now, reviewedBy, id).run();
          const studentEmailForActivity = await env.DB.prepare(`SELECT student_email FROM student_checkins WHERE id=? LIMIT 1`).bind(id).first();
          await logActivityEvent(env.DB, { student_email: String(studentEmailForActivity?.student_email || '').toLowerCase(), event_type: EVENT_TYPES.COACH_REPLY_SENT, source: 'admin', title: 'Resposta do coach enviada', payload: { checkin_id: id, coach_status: coachStatus } });

          const updated = await env.DB.prepare(
            `SELECT id, coach_status, coach_reply, coach_reply_at, reviewed_at, reviewed_by
             FROM student_checkins
             WHERE id=?`
          ).bind(id).first();

          return json({ ok: true, data: updated });
        }


        if (url.pathname === '/api/admin/command-center' && method === 'GET') {
          const currentWeekRef = getWeekRef(new Date());
          const hasNutritionPlans = await tableExists(env.DB, 'nutrition_plans');
          const hasFollowupLogs = await tableExists(env.DB, 'followup_logs');
          

          const pendingCheckinsRow = await env.DB.prepare(
            `SELECT COUNT(*) AS total
             FROM student_checkins
             WHERE coach_status IS NULL
                OR coach_status='pending'`
          ).first();

          const studentsWithoutCheckinWeekRow = await env.DB.prepare(
            `SELECT COUNT(*) AS total
             FROM student_access sa
             WHERE sa.status='ACTIVE'
               AND NOT EXISTS (
                 SELECT 1
                 FROM student_checkins sc
                 WHERE lower(sc.student_email)=lower(sa.email)
                   AND sc.week_ref=?
               )`
          ).bind(currentWeekRef).first();

          const newAnamnesesRow = await env.DB.prepare(
            `SELECT COUNT(*) AS total
             FROM premium_anamnesis
             WHERE status='RECEBIDA'`
          ).first();
          const pendingOnboardingRow = await env.DB.prepare(
            `SELECT COUNT(*) AS total
             FROM student_access
             WHERE status='PENDING_ONBOARDING'`
          ).first();
          const inactiveStudentsRow = await env.DB.prepare(
            `SELECT COUNT(*) AS total
             FROM student_access
             WHERE status='INACTIVE'`
          ).first();

          const { results: inactiveStudentsListRaw = [] } = await env.DB.prepare(
            `SELECT sa.name,
                    sa.email,
                    sa.plan_type,
                    COALESCE((
                      SELECT at.created_at
                      FROM activity_timeline at
                      WHERE lower(at.student_email)=lower(sa.email)
                        AND at.event_type='STUDENT_INACTIVATED'
                      ORDER BY datetime(at.created_at) DESC
                      LIMIT 1
                    ), sa.created_at) AS inactivated_at,
                    (
                      SELECT at.metadata_json
                      FROM activity_timeline at
                      WHERE lower(at.student_email)=lower(sa.email)
                        AND at.event_type='STUDENT_INACTIVATED'
                      ORDER BY datetime(at.created_at) DESC
                      LIMIT 1
                    ) AS inactivation_meta
             FROM student_access sa
             WHERE sa.status='INACTIVE'
             ORDER BY datetime(inactivated_at) DESC
             LIMIT 10`
          ).all();

          const studentsWithoutWeeklyPlanRow = await env.DB.prepare(
            `SELECT COUNT(*) AS total
             FROM student_access sa
             WHERE sa.status='ACTIVE'
               AND NOT EXISTS (
                 SELECT 1
                 FROM weekly_plans wp
                 WHERE lower(wp.student_email)=lower(sa.email)
                   AND wp.week_ref=?
                   AND wp.status='ACTIVE'
               )`
          ).bind(currentWeekRef).first();

          const studentsWithoutNutritionPlanRow = hasNutritionPlans
            ? await env.DB.prepare(
              `SELECT COUNT(*) AS total
               FROM student_access sa
               WHERE sa.status='ACTIVE'
                 AND NOT EXISTS (
                   SELECT 1
                   FROM nutrition_plans np
                   WHERE lower(np.student_email)=lower(sa.email)
                     AND np.is_active=1
                 )`
            ).first()
            : { total: 0 };

          const overdueFollowupsRow = hasFollowupLogs
            ? await env.DB.prepare(
              `SELECT COUNT(*) AS total
               FROM followup_logs
               WHERE resolution_status='OPEN'
                 AND due_date IS NOT NULL
                 AND datetime(due_date) <= datetime('now')`
            ).first()
            : { total: 0 };

          const pendingCheckins = Number(pendingCheckinsRow?.total || 0);
          const studentsWithoutCheckinWeek = Number(studentsWithoutCheckinWeekRow?.total || 0);
          const newAnamneses = Number(newAnamnesesRow?.total || 0);
          const studentsWithoutWeeklyPlan = Number(studentsWithoutWeeklyPlanRow?.total || 0);
          const studentsWithoutNutritionPlan = Number(studentsWithoutNutritionPlanRow?.total || 0);
          const overdueFollowups = Number(overdueFollowupsRow?.total || 0);
          const pendingOnboarding = Number(pendingOnboardingRow?.total || 0);
          const inactiveStudents = Number(inactiveStudentsRow?.total || 0);
          const revenueByPlanType = {
            START: 0,
            PREMIUM: 497,
            VIP: 997
          };
          const reactivationRevenuePotential = (inactiveStudentsListRaw || []).reduce((sum, item) => {
            const planType = String(item?.plan_type || '').trim().toUpperCase();
            return sum + Number(revenueByPlanType[planType] || revenueByPlanType.PREMIUM);
          }, 0);
          const { results: recentActivitiesRaw = [] } = await env.DB.prepare(`SELECT student_email, event_type, title, created_at FROM activity_timeline ORDER BY datetime(created_at) DESC LIMIT 8`).all();

          const { results: pendingCheckinsListRaw = [] } = await env.DB.prepare(
            `SELECT sa.name,
                    COALESCE(sa.email, sc.student_email) AS email,
                    sc.created_at
             FROM student_checkins sc
             LEFT JOIN student_access sa ON lower(sa.email)=lower(sc.student_email)
             WHERE sc.coach_status IS NULL OR sc.coach_status='pending'
             ORDER BY datetime(sc.created_at) ASC
             LIMIT 10`
          ).all();

          const { results: studentsWithoutCheckinWeekListRaw = [] } = await env.DB.prepare(
            `SELECT sa.name, sa.email,
                    (
                      SELECT sc_last.created_at
                      FROM student_checkins sc_last
                      WHERE lower(sc_last.student_email)=lower(sa.email)
                      ORDER BY datetime(sc_last.created_at) DESC
                      LIMIT 1
                    ) AS last_checkin_at
             FROM student_access sa
             WHERE sa.status='ACTIVE'
               AND NOT EXISTS (
                 SELECT 1
                 FROM student_checkins sc
                 WHERE lower(sc.student_email)=lower(sa.email)
                   AND sc.week_ref=?
               )
             ORDER BY datetime(last_checkin_at) ASC NULLS FIRST, sa.name ASC
             LIMIT 10`
          ).bind(currentWeekRef).all();

          const { results: newAnamnesesListRaw = [] } = await env.DB.prepare(
            `SELECT student_name AS name, student_email AS email, created_at
             FROM premium_anamnesis
             WHERE status='RECEBIDA'
             ORDER BY datetime(created_at) ASC
             LIMIT 10`
          ).all();

          const { results: studentsWithoutWeeklyPlanListRaw = [] } = await env.DB.prepare(
            `SELECT sa.name, sa.email
             FROM student_access sa
             WHERE sa.status='ACTIVE'
               AND NOT EXISTS (
                 SELECT 1
                 FROM weekly_plans wp
                 WHERE lower(wp.student_email)=lower(sa.email)
                   AND wp.week_ref=?
                   AND wp.status='ACTIVE'
               )
             ORDER BY sa.name ASC
             LIMIT 10`
          ).bind(currentWeekRef).all();

          const studentsWithoutNutritionPlanListRaw = hasNutritionPlans
            ? (await env.DB.prepare(
              `SELECT sa.name, sa.email
               FROM student_access sa
               WHERE sa.status='ACTIVE'
                 AND NOT EXISTS (
                   SELECT 1
                   FROM nutrition_plans np
                   WHERE lower(np.student_email)=lower(sa.email)
                     AND np.is_active=1
                 )
               ORDER BY sa.name ASC
               LIMIT 10`
            ).all()).results || []
            : [];

          const overdueFollowupsListRaw = hasFollowupLogs
            ? (await env.DB.prepare(
              `SELECT sa.name,
                      COALESCE(sa.email, fl.student_email) AS email,
                      fl.due_date
               FROM followup_logs fl
               LEFT JOIN student_access sa ON lower(sa.email)=lower(fl.student_email)
               WHERE fl.resolution_status='OPEN'
                 AND fl.due_date IS NOT NULL
                 AND datetime(fl.due_date) <= datetime('now')
               ORDER BY datetime(fl.due_date) ASC
               LIMIT 10`
            ).all()).results || []
            : [];
          const { results: pendingOnboardingListRaw = [] } = await env.DB.prepare(
            `SELECT name, email, created_at
             FROM student_access
             WHERE status='PENDING_ONBOARDING'
             ORDER BY datetime(created_at) ASC
             LIMIT 10`
          ).all();

          const pendingCheckinsList = pendingCheckinsListRaw.map((item) => ({
            name: item.name || item.email,
            email: item.email,
            reason: 'Check-in aguardando resposta',
            last_event_at: item.created_at || null,
            action_url: buildActionUrl(item.email)
          }));

          const studentsWithoutCheckinWeekList = studentsWithoutCheckinWeekListRaw.map((item) => ({
            name: item.name || item.email,
            email: item.email,
            reason: 'Sem check-in na semana atual',
            last_event_at: item.last_checkin_at || null,
            action_url: buildActionUrl(item.email)
          }));

          const newAnamnesesList = newAnamnesesListRaw.map((item) => ({
            name: item.name || item.email,
            email: item.email,
            reason: 'Anamnese aguardando análise',
            last_event_at: item.created_at || null,
            action_url: buildActionUrl(item.email)
          }));

          const studentsWithoutWeeklyPlanList = studentsWithoutWeeklyPlanListRaw.map((item) => ({
            name: item.name || item.email,
            email: item.email,
            reason: 'Plano semanal ausente',
            last_event_at: null,
            action_url: buildActionUrl(item.email)
          }));

          const studentsWithoutNutritionPlanList = studentsWithoutNutritionPlanListRaw.map((item) => ({
            name: item.name || item.email,
            email: item.email,
            reason: 'Plano alimentar ausente',
            last_event_at: null,
            action_url: buildActionUrl(item.email)
          }));

          const overdueFollowupsList = overdueFollowupsListRaw.map((item) => ({
            name: item.name || item.email,
            email: item.email,
            reason: 'Follow-up vencido aguardando resolução',
            last_event_at: item.due_date || null,
            action_url: buildActionUrl(item.email)
          }));
          const pendingOnboardingList = pendingOnboardingListRaw.map((item) => ({
            name: item.name || item.email,
            email: item.email,
            reason: 'Aguardando liberação de acesso',
            last_event_at: item.created_at || null,
            action_url: buildActionUrl(item.email)
          }));
          const inactiveStudentsList = inactiveStudentsListRaw.map((item) => {
            const meta = safeJsonParse(item.inactivation_meta);
            const reason = String(meta?.reason || 'Sem motivo informado').trim();
            const inactivatedAt = item.inactivated_at || null;
            const daysSinceInactivation = inactivatedAt
              ? Math.max(0, Math.floor((Date.now() - new Date(inactivatedAt).getTime()) / (1000 * 60 * 60 * 24)))
              : null;
            return {
              name: item.name || item.email,
              email: item.email,
              reason,
              inactivated_at: inactivatedAt,
              days_since_inactivation: daysSinceInactivation,
              action_url: buildActionUrl(item.email)
            };
          });

          let priorityMessage = 'Operação em dia.';
          if (pendingCheckinsList.length > 0) {
            priorityMessage = `Comece respondendo o check-in de ${pendingCheckinsList[0].name}.`;
          } else if (studentsWithoutCheckinWeekList.length > 0) {
            priorityMessage = `Comece cobrando check-in de ${studentsWithoutCheckinWeekList[0].name}.`;
          } else if (newAnamnesesList.length > 0) {
            priorityMessage = `Comece analisando a anamnese de ${newAnamnesesList[0].name}.`;
          } else if (studentsWithoutWeeklyPlan > 0) {
            priorityMessage = 'Atualizar planos da semana.';
          }

          return json({
            ok: true,
            data: {
              pending_checkins: pendingCheckins,
              students_without_checkin_week: studentsWithoutCheckinWeek,
              new_anamneses: newAnamneses,
              students_without_weekly_plan: studentsWithoutWeeklyPlan,
              students_without_nutrition_plan: studentsWithoutNutritionPlan,
              overdue_followups: overdueFollowups,
              pending_onboarding: pendingOnboarding,
              inactive_students: inactiveStudents,
              reactivation_revenue_potential: reactivationRevenuePotential,
              pending_checkins_list: pendingCheckinsList,
              students_without_checkin_week_list: studentsWithoutCheckinWeekList,
              new_anamneses_list: newAnamnesesList,
              students_without_weekly_plan_list: studentsWithoutWeeklyPlanList,
              students_without_nutrition_plan_list: studentsWithoutNutritionPlanList,
              overdue_followups_list: overdueFollowupsList,
              pending_onboarding_list: pendingOnboardingList,
              inactive_students_list: inactiveStudentsList,
              recent_activities: (recentActivitiesRaw || []).map((row) => ({ student_email: row.student_email, type: row.event_type, title: row.title, at: row.created_at, action_url: buildActionUrl(row.student_email) })),
              priority_message: priorityMessage,
              schema_audit: {
                nutrition_plans_exists: hasNutritionPlans,
                followup_logs_exists: hasFollowupLogs
              }
            }
          });
        }


        if (url.pathname === '/api/admin/followup-alerts' && method === 'GET') {
          const currentWeekRef = getWeekRef(new Date());

          const { results: activeStudents = [] } = await env.DB.prepare(
            `SELECT name, email, plan_type, whatsapp
             FROM student_access
             WHERE status='ACTIVE'
             ORDER BY name ASC`
          ).all();

          const followupStudents = [];

          for (const student of activeStudents) {
            const normalizedEmail = String(student.email || '').toLowerCase();
            if (!normalizedEmail) continue;

            const lastCheckinMeta = await env.DB.prepare(
              `SELECT created_at, week_ref
               FROM student_checkins
               WHERE lower(student_email)=?
               ORDER BY created_at DESC
               LIMIT 1`
            ).bind(normalizedEmail).first();

            const currentWeekCheckin = await env.DB.prepare(
              `SELECT 1
               FROM student_checkins
               WHERE lower(student_email)=?
                 AND week_ref=?
               LIMIT 1`
            ).bind(normalizedEmail, currentWeekRef).first();

            const currentWeekPlan = await env.DB.prepare(
              `SELECT 1
               FROM weekly_plans
               WHERE lower(student_email)=?
                 AND week_ref=?
                 AND status='ACTIVE'
               LIMIT 1`
            ).bind(normalizedEmail, currentWeekRef).first();

            const recentFollowup = await env.DB.prepare(
              `SELECT created_at
               FROM followup_logs
               WHERE lower(student_email)=?
                 AND datetime(created_at) >= datetime('now', '-5 days')
               ORDER BY created_at DESC
               LIMIT 1`
            ).bind(normalizedEmail).first();

            const latestFollowup = await env.DB.prepare(
              `SELECT created_at, outcome, risk_level, next_action, reason
               FROM followup_logs
               WHERE lower(student_email)=?
               ORDER BY created_at DESC
               LIMIT 1`
            ).bind(normalizedEmail).first();

            const lastFollowupAt = recentFollowup?.created_at || latestFollowup?.created_at || null;
            const recentlyContacted = Boolean(lastFollowupAt);

            followupStudents.push({
              name: student.name || 'Aluno',
              email: student.email || '',
              planType: student.plan_type || 'N/A',
              lastCheckin: lastCheckinMeta?.created_at || null,
              lastCheckinWeek: lastCheckinMeta?.week_ref || null,
              hasCurrentWeekCheckin: Boolean(currentWeekCheckin),
              hasCurrentWeekPlan: Boolean(currentWeekPlan),
              whatsapp: normalizeWhatsapp(student.whatsapp),
              recentlyContacted,
              lastFollowupAt,
              latestOutcome: latestFollowup?.outcome || null,
              latestRiskLevel: latestFollowup?.risk_level || null,
              latestNextAction: latestFollowup?.next_action || null,
              latestReason: latestFollowup?.reason || null
            });
          }

          const missingMessage = `Seu check-in da semana ainda não foi enviado.

Ele é o que direciona seus próximos ajustes de treino, cardio e estratégia.

Leva menos de 2 minutos e evita que a semana fique sem direção.

Clique aqui para responder:
https://portal.lucasmorenopersonal.com.br/portal-checkin.html`;
          const highRiskMessage = `Percebi que você ficou algumas semanas sem enviar seu check-in.

Isso normalmente é o primeiro sinal de queda de consistência, e prefiro agir antes disso virar abandono.

Me responde aqui rapidamente:
o que mais está dificultando sua rotina agora?`;
          const criticalMessage = `Quero alinhar sua semana antes que a rotina perca direção.

Seu check-in ainda não foi enviado e seu plano da semana precisa ser atualizado com base no seu momento atual.

Me responde aqui para ajustarmos o foco da semana.`;

          const missingCheckins = [];
          const highRiskStudents = [];
          const criticalRiskStudents = [];
          const cancellationRiskStudents = [];
          const financialRiskStudents = [];

          const cancellationHighMessage = `Quero alinhar sua semana para evitar que a rotina perca força.

Me responde rapidamente o que mais está dificultando sua execução agora.`;
          const cancellationCriticalMessage = `Quero falar com você rapidamente para alinharmos sua continuidade.

Percebi um ponto importante no seu acompanhamento e prefiro ajustar antes que isso vire cancelamento.

Me responde assim que puder.`;

          const financialMessage = `Entendo totalmente seu ponto sobre o momento financeiro.

Antes de cancelar direto, quero te propor uma alternativa para mantermos sua evolução sem perder completamente o acompanhamento.

Me responde aqui para eu te explicar as opções.`;

          for (const student of followupStudents) {
            const missingWhatsappUrl = student.whatsapp
              ? `https://wa.me/${student.whatsapp}?text=${encodeURIComponent(missingMessage)}`
              : null;
            const highRiskWhatsappUrl = student.whatsapp
              ? `https://wa.me/${student.whatsapp}?text=${encodeURIComponent(highRiskMessage)}`
              : null;
            const criticalWhatsappUrl = student.whatsapp
              ? `https://wa.me/${student.whatsapp}?text=${encodeURIComponent(criticalMessage)}`
              : null;

            if (!student.hasCurrentWeekCheckin) {
              missingCheckins.push({
                name: student.name,
                email: student.email,
                planType: student.planType,
                lastCheckin: student.lastCheckin,
                priority: 'MEDIUM',
                reason: 'Check-in semanal pendente',
                whatsappUrl: missingWhatsappUrl,
                message: missingMessage,
                recentlyContacted: student.recentlyContacted,
                lastFollowupAt: student.lastFollowupAt
              });
            }

            const weeksWithoutCheckin = student.lastCheckinWeek
              ? weekRefDiff(student.lastCheckinWeek, currentWeekRef)
              : null;

            if (weeksWithoutCheckin === null || weeksWithoutCheckin >= 2) {
              highRiskStudents.push({
                name: student.name,
                email: student.email,
                planType: student.planType,
                lastCheckin: student.lastCheckin,
                weeksWithoutCheckin,
                priority: 'HIGH',
                reason: '2 semanas ou mais sem check-in',
                whatsappUrl: highRiskWhatsappUrl,
                message: highRiskMessage,
                recentlyContacted: student.recentlyContacted,
                lastFollowupAt: student.lastFollowupAt
              });
            }

            const riskLevel = String(student.latestRiskLevel || '').toUpperCase();
            if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
              const cancellationMessage = riskLevel === 'CRITICAL' ? cancellationCriticalMessage : cancellationHighMessage;
              const cancellationWhatsappUrl = student.whatsapp
                ? `https://wa.me/${student.whatsapp}?text=${encodeURIComponent(cancellationMessage)}`
                : null;

              cancellationRiskStudents.push({
                name: student.name,
                email: student.email,
                planType: student.planType,
                lastCheckin: student.lastCheckin,
                lastFollowupAt: student.lastFollowupAt,
                outcome: student.latestOutcome,
                riskLevel,
                nextAction: student.latestNextAction,
                reason: student.latestReason || 'Follow-up recente com risco de cancelamento',
                whatsappUrl: cancellationWhatsappUrl,
                message: cancellationMessage
              });
            }

            if (isFinancialRiskFollowup(student)) {
              const financialWhatsappUrl = student.whatsapp
                ? `https://wa.me/${student.whatsapp}?text=${encodeURIComponent(financialMessage)}`
                : null;

              financialRiskStudents.push({
                name: student.name,
                email: student.email,
                planType: student.planType,
                lastFollowupAt: student.lastFollowupAt,
                outcome: student.latestOutcome,
                riskLevel: student.latestRiskLevel,
                nextAction: student.latestNextAction,
                reason: student.latestReason || 'Risco financeiro identificado no follow-up',
                suggestedRetentionActions: RETENTION_ACTION_SUGGESTIONS,
                whatsappUrl: financialWhatsappUrl,
                message: financialMessage
              });
            }

            if (!student.hasCurrentWeekCheckin && !student.hasCurrentWeekPlan) {
              criticalRiskStudents.push({
                name: student.name,
                email: student.email,
                planType: student.planType,
                lastCheckin: student.lastCheckin,
                priority: 'CRITICAL',
                reason: 'Sem check-in e sem plano semanal',
                whatsappUrl: criticalWhatsappUrl,
                message: criticalMessage,
                recentlyContacted: student.recentlyContacted,
                lastFollowupAt: student.lastFollowupAt
              });
            }
          }


          const overdueMessage = `Seu retorno estava previsto para hoje e quero alinhar rapidamente sua continuidade.

Me responde aqui para ajustarmos o próximo passo e evitar que sua semana fique sem direção.`;
          const overdueFollowups = [];

          const { results: openFollowups = [] } = await env.DB.prepare(
            `SELECT id, student_email, reason, outcome, risk_level, next_action, due_date, created_at
             FROM followup_logs
             WHERE resolution_status='OPEN'
               AND due_date IS NOT NULL
               AND datetime(due_date) <= datetime('now')`
          ).all();

          const studentLookup = new Map(followupStudents.map((student) => [String(student.email || '').toLowerCase(), student]));

          for (const followup of openFollowups) {
            const email = String(followup.student_email || '').toLowerCase();
            const student = studentLookup.get(email);
            if (!student) continue;

            const followupTime = Date.parse(followup.created_at || '') || 0;
            const lastCheckinTime = Date.parse(student.lastCheckin || '') || 0;
            let computedRiskLevel = String(followup.risk_level || '').toUpperCase() || 'MEDIUM';
            if (computedRiskLevel === 'HIGH' && (!lastCheckinTime || lastCheckinTime <= followupTime)) {
              computedRiskLevel = 'CRITICAL';
            }

            const dueTime = Date.parse(followup.due_date || '') || 0;
            const nowTime = Date.now();
            const daysOverdue = Math.max(0, Math.floor((nowTime - dueTime) / 86400000));
            const whatsappUrl = student.whatsapp
              ? `https://wa.me/${student.whatsapp}?text=${encodeURIComponent(overdueMessage)}`
              : null;

            overdueFollowups.push({
              id: followup.id,
              name: student.name,
              email: student.email,
              planType: student.planType,
              whatsappUrl,
              message: overdueMessage,
              reason: followup.reason || null,
              outcome: followup.outcome || null,
              riskLevel: computedRiskLevel,
              nextAction: followup.next_action || null,
              dueDate: followup.due_date || null,
              createdAt: followup.created_at || null,
              daysOverdue
            });
          }

          overdueFollowups.sort((a, b) => {
            if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
            const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
            const riskDelta = (order[a.riskLevel] ?? 99) - (order[b.riskLevel] ?? 99);
            if (riskDelta !== 0) return riskDelta;
            return (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0);
          });
          return json({
            ok: true,
            data: {
              overdueFollowups,
              missingCheckins,
              highRiskStudents,
              criticalRiskStudents,
              cancellationRiskStudents: cancellationRiskStudents.sort((a, b) => {
                const order = { CRITICAL: 0, HIGH: 1 };
                const riskDelta = (order[a.riskLevel] ?? 99) - (order[b.riskLevel] ?? 99);
                if (riskDelta !== 0) return riskDelta;
                const aTime = Date.parse(a.lastFollowupAt || '') || 0;
                const bTime = Date.parse(b.lastFollowupAt || '') || 0;
                return bTime - aTime;
              }),
              financialRiskStudents: financialRiskStudents.sort((a, b) => {
                const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
                const riskDelta = (order[String(a.riskLevel || '').toUpperCase()] ?? 99) - (order[String(b.riskLevel || '').toUpperCase()] ?? 99);
                if (riskDelta !== 0) return riskDelta;
                const aTime = Date.parse(a.lastFollowupAt || '') || 0;
                const bTime = Date.parse(b.lastFollowupAt || '') || 0;
                return bTime - aTime;
              })
            }
          });
        }

        if (url.pathname === '/api/admin/portal-alerts' && method === 'GET') {
          const currentWeekRef = getWeekRef(new Date());

          const activeStudentsResult = await env.DB.prepare(
            `SELECT name, email, plan_type FROM student_access WHERE status='ACTIVE' ORDER BY name ASC`
          ).all();

          const activeStudents = activeStudentsResult?.results || [];

          const { results: missingWeeklyPlan = [] } = await env.DB.prepare(
            `SELECT sa.email, sa.name, sa.plan_type AS planType
             FROM student_access sa
             LEFT JOIN weekly_plans wp
               ON lower(wp.student_email)=lower(sa.email)
               AND wp.week_ref=?
               AND wp.status='ACTIVE'
             WHERE sa.status='ACTIVE' AND wp.id IS NULL
             ORDER BY sa.name ASC`
          ).bind(currentWeekRef).all();

          const { results: missingCheckin = [] } = await env.DB.prepare(
            `SELECT sa.email, sa.name,
                    (SELECT MAX(sc.created_at)
                     FROM student_checkins sc
                     WHERE lower(sc.student_email)=lower(sa.email)) AS lastCheckin
             FROM student_access sa
             WHERE sa.status='ACTIVE'
               AND NOT EXISTS (
                 SELECT 1
                 FROM student_checkins scw
                 WHERE lower(scw.student_email)=lower(sa.email)
                   AND scw.week_ref=?
               )
             ORDER BY sa.name ASC`
          ).bind(currentWeekRef).all();

          const missingWeeklyPlanSet = new Set(
            missingWeeklyPlan.map((student) => String(student.email || '').toLowerCase())
          );

          const checkinByEmail = new Map();

          for (const student of activeStudents) {
            const email = String(student.email || '').toLowerCase();
            if (!email) continue;

            const lastWeek = await env.DB.prepare(
              `SELECT week_ref
               FROM student_checkins
               WHERE lower(student_email)=?
               ORDER BY created_at DESC
               LIMIT 1`
            ).bind(email).first();

            checkinByEmail.set(email, lastWeek?.week_ref || null);
          }

          const riskStudents = [];

          for (const student of activeStudents) {
            const email = String(student.email || '').toLowerCase();
            const name = student.name;
            const hasNoWeeklyPlan = missingWeeklyPlanSet.has(email);
            const lastCheckinWeek = checkinByEmail.get(email);

            if (!lastCheckinWeek && hasNoWeeklyPlan) {
              riskStudents.push({
                email: student.email,
                name,
                reason: 'Sem plano semanal e sem check-in'
              });
              continue;
            }

            if (lastCheckinWeek) {
              const weeksDiff = weekRefDiff(lastCheckinWeek, currentWeekRef);
              if (weeksDiff >= 2) {
                riskStudents.push({
                  email: student.email,
                  name,
                  reason: `${weeksDiff} semanas sem check-in`
                });
              }
            }
          }

          return json({
            ok: true,
            data: {
              missingWeeklyPlan,
              missingCheckin,
              riskStudents
            }
          });
        }


        if (url.pathname === '/api/admin/anamneses' && method === 'GET') {
          const { results } = await env.DB.prepare(
            `SELECT id, student_name, student_email, student_phone, status, created_at, updated_at
             FROM premium_anamnesis
             ORDER BY created_at DESC`
          ).all();

          return json({ ok: true, data: results || [] });
        }

        const anamnesisDetailMatch = url.pathname.match(/^\/api\/admin\/anamneses\/([^/]+)$/);

        if (anamnesisDetailMatch && method === 'GET') {
          const id = anamnesisDetailMatch[1];
          const row = await env.DB.prepare(
            `SELECT * FROM premium_anamnesis WHERE id=? LIMIT 1`
          ).bind(id).first();

          if (!row) return json({ ok: false, error: 'Anamnese não encontrada.' }, 404);

          return json({
            ok: true,
            data: {
              ...row,
              answers: safeJsonParseObject(row.answers_json),
              internal_scores: safeJsonParseObject(row.internal_scores_json)
            }
          });
        }

        if (anamnesisDetailMatch && method === 'PATCH') {
          const id = anamnesisDetailMatch[1];
          const body = await safeJson(request);
          const status = nullableTrimmed(body?.status);

          if (!status) {
            return json({ ok: false, error: 'status é obrigatório.' }, 400);
          }

          const now = new Date().toISOString();
          const result = await env.DB.prepare(
            `UPDATE premium_anamnesis SET status=?, updated_at=? WHERE id=?`
          ).bind(status, now, id).run();

          if (!result?.meta?.changes) {
            return json({ ok: false, error: 'Anamnese não encontrada.' }, 404);
          }

          return json({ ok: true, data: { id, status, updated_at: now } });
        }

        if (url.pathname === '/api/admin/leads' && method === 'GET') {
          return json({ ok: true, data: [] });
        }

        if (url.pathname === '/api/admin/metrics' && method === 'GET') {
          return json({ ok: true, data: {} });
        }

        if (url.pathname === '/api/admin/alerts' && method === 'GET') {
          return json({ ok: true, data: [] });
        }

        if (url.pathname === '/api/admin/alerts/send' && method === 'POST') {
          return json({ ok: true });
        }

        if (/\/api\/admin\/leads\/[^/]+\/(status|commercial)$/.test(url.pathname) && method === 'PATCH') {
          return json({ ok: true });
        }
      }

      return json({ ok: false, error: 'Not found' }, 404);
    } catch (err) {
      return json({
        ok: false,
        error: 'Internal error',
        detail: String(err?.message || err)
      }, 500);
    }
  }
};

async function ensureSchema(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    created_at TEXT
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS diagnostic_results (
    id TEXT PRIMARY KEY,
    created_at TEXT
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS student_access (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    access_token TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    plan_type TEXT,
    plan TEXT DEFAULT 'premium',
    whatsapp TEXT,
    created_at TEXT NOT NULL
  )`).run();

  await ensureColumn(db, 'student_access', 'whatsapp', 'TEXT');
  await ensureColumn(db, 'student_access', 'plan', "TEXT DEFAULT 'premium'");

  await db.prepare(`CREATE TABLE IF NOT EXISTS project_lm_profile (
    student_email TEXT PRIMARY KEY,
    goal TEXT,
    main_difficulty TEXT,
    onboarding_completed INTEGER DEFAULT 0,
    created_at TEXT,
    updated_at TEXT
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS followup_logs (
    id TEXT PRIMARY KEY,
    student_email TEXT NOT NULL,
    contact_type TEXT NOT NULL DEFAULT 'WHATSAPP',
    reason TEXT,
    note TEXT,
    created_at TEXT NOT NULL
  )`).run();

  await ensureColumn(db, 'followup_logs', 'outcome', 'TEXT');
  await ensureColumn(db, 'followup_logs', 'risk_level', 'TEXT');
  await ensureColumn(db, 'followup_logs', 'next_action', 'TEXT');
  await ensureColumn(db, 'followup_logs', 'due_date', 'TEXT');
  await ensureColumn(db, 'followup_logs', 'resolved_at', 'TEXT');
  await ensureColumn(db, 'followup_logs', 'resolution_status', "TEXT DEFAULT 'OPEN'");

  await db.prepare(`CREATE TABLE IF NOT EXISTS retention_actions (
    id TEXT PRIMARY KEY,
    student_email TEXT NOT NULL,
    financial_reason TEXT,
    proposed_action TEXT,
    accepted_status TEXT,
    note TEXT,
    created_at TEXT NOT NULL
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS student_checkins (
    id TEXT PRIMARY KEY,
    student_email TEXT NOT NULL,
    week_ref TEXT NOT NULL,
    training_adherence TEXT,
    nutrition_adherence TEXT,
    cardio_adherence TEXT,
    free_meals TEXT,
    hunger_level TEXT,
    binge_or_snacking TEXT,
    sleep_quality TEXT,
    energy_level TEXT,
    stress_level TEXT,
    weekly_weight TEXT,
    waist TEXT,
    strength_status TEXT,
    main_difficulty TEXT,
    routine_context TEXT,
    weekly_score TEXT,
    support_needed TEXT,
    created_at TEXT NOT NULL
  )`).run();

  await ensureColumn(db, 'student_checkins', 'coach_reply', 'TEXT');
  await ensureColumn(db, 'student_checkins', 'coach_reply_at', 'TEXT');
  await ensureColumn(db, 'student_checkins', 'coach_status', "TEXT DEFAULT 'pending'");
  await ensureColumn(db, 'student_checkins', 'reviewed_at', 'TEXT');
  await ensureColumn(db, 'student_checkins', 'reviewed_by', 'TEXT');

  await db.prepare(`CREATE TABLE IF NOT EXISTS progression_logs (
    id TEXT PRIMARY KEY,
    student_email TEXT NOT NULL,
    exercise TEXT NOT NULL,
    target_zone TEXT NOT NULL,
    load_used REAL,
    reps_done INTEGER,
    rir TEXT,
    decision TEXT,
    created_at TEXT NOT NULL
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS weekly_plans (
    id TEXT PRIMARY KEY,
    student_email TEXT NOT NULL,
    week_ref TEXT NOT NULL,
    training_focus TEXT,
    cardio_target TEXT,
    nutrition_focus TEXT,
    main_risk TEXT,
    coach_message TEXT,
    status TEXT DEFAULT 'ACTIVE',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();

  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_weekly_plans_student_email ON weekly_plans(student_email)`
  ).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS nutrition_plans (
    id TEXT PRIMARY KEY,
    student_email TEXT NOT NULL,
    title TEXT,
    goal TEXT,
    strategy TEXT,
    meals_json TEXT NOT NULL,
    substitutions_json TEXT,
    adherence_rules_json TEXT,
    notes TEXT,
    whatsapp_message TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_nutrition_plans_student_email ON nutrition_plans(student_email)`
  ).run();
  await db.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_nutrition_plans_single_active
     ON nutrition_plans(student_email)
     WHERE is_active = 1`
  ).run();

  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_student_checkins_student_week ON student_checkins(student_email, week_ref)`
  ).run();

  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_student_access_email ON student_access(email)`
  ).run();

  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_followup_logs_student_email ON followup_logs(student_email)`
  ).run();

  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_followup_logs_created_at ON followup_logs(created_at)`
  ).run();
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_followup_logs_resolution_status_due_date ON followup_logs(resolution_status, due_date)`
  ).run();
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_followup_logs_student_created ON followup_logs(student_email, created_at)`
  ).run();
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_retention_actions_student_email ON retention_actions(student_email)`
  ).run();


  await db.prepare(`CREATE TABLE IF NOT EXISTS activity_timeline (
    id TEXT PRIMARY KEY,
    student_email TEXT NOT NULL,
    event_type TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'system',
    title TEXT NOT NULL,
    metadata_json TEXT,
    created_at TEXT NOT NULL
  )`).run();

  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_activity_timeline_student_created ON activity_timeline(student_email, created_at)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_activity_timeline_created ON activity_timeline(created_at)`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS premium_anamnesis (
    id TEXT PRIMARY KEY,
    student_name TEXT NOT NULL,
    student_email TEXT NOT NULL,
    student_phone TEXT,
    status TEXT NOT NULL DEFAULT 'RECEBIDA',
    answers_json TEXT NOT NULL,
    internal_scores_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();

  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_premium_anamnesis_created_at ON premium_anamnesis(created_at)`
  ).run();
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_premium_anamnesis_student_email ON premium_anamnesis(student_email)`
  ).run();

  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_retention_actions_created_at ON retention_actions(created_at)`
  ).run();
}


async function logActivityEvent(db, event) {
  const studentEmail = String(event?.student_email || '').trim().toLowerCase();
  if (!studentEmail) return;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO activity_timeline (id, student_email, event_type, source, title, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    studentEmail,
    String(event?.event_type || 'UNKNOWN'),
    String(event?.source || 'system'),
    String(event?.title || 'Atividade'),
    JSON.stringify(event?.payload || {}),
    now
  ).run();
}

function __deprecated_safeJsonParse(value) {
  try { return value ? JSON.parse(value) : null; } catch { return null; }
}

const RETENTION_ACTION_SUGGESTIONS = [
  { value: 'PLANO_START_TEMPORARIO', label: 'Plano Start temporário' },
  { value: 'PAUSA_ESTRATEGICA_15_30_DIAS', label: 'Pausa estratégica de 15–30 dias' },
  { value: 'REDUCAO_ACOMPANHAMENTO', label: 'Redução temporária de acompanhamento' },
  { value: 'AJUSTE_TEMPORARIO_INVESTIMENTO', label: 'Ajuste temporário de investimento' },
  { value: 'RETORNO_AGENDADO', label: 'Preservar vínculo e agendar retorno' }
];

const RETENTION_PROPOSED_ACTIONS = [
  'PLANO_START_TEMPORARIO',
  'PAUSA_ESTRATEGICA_15_30_DIAS',
  'REDUCAO_ACOMPANHAMENTO',
  'AJUSTE_TEMPORARIO_INVESTIMENTO',
  'RETORNO_AGENDADO',
  'OUTRO'
];

const RETENTION_ACCEPTED_STATUS = ['OFFERED', 'ACCEPTED', 'DECLINED', 'CANCELLED_ANYWAY', 'PENDING'];

function isFinancialRiskFollowup(student) {
  const outcome = String(student.latestOutcome || '').toUpperCase();
  if (outcome === 'PROBLEMA_FINANCEIRO') return true;

  const riskLevel = String(student.latestRiskLevel || '').toUpperCase();
  if (riskLevel !== 'HIGH' && riskLevel !== 'CRITICAL') return false;

  const reason = `${student.latestReason || ''}`.toLowerCase();
  const terms = ['financeir', 'dinheiro', 'mensalidade', 'pagament', 'custo', 'investimento', 'valor'];
  return terms.some((term) => reason.includes(term));
}


async function tableExists(db, tableName) {
  const row = await db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=? LIMIT 1`
  ).bind(tableName).first();
  return Boolean(row?.name);
}

async function ensureColumn(db, tableName, columnName, sqlType) {
  const columns = await db.prepare(`PRAGMA table_info(${tableName})`).all();
  const exists = (columns?.results || []).some((col) => col.name === columnName);
  if (!exists) {
    await db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${sqlType}`).run();
  }
}


function resolveDueDate(nextAction, baseDateIso) {
  const base = new Date(baseDateIso || Date.now());
  const action = String(nextAction || '').toUpperCase();

  let daysToAdd = null;

  if (
    action === 'REVISAR_PLANO' ||
    action === 'AJUSTAR_DIETA' ||
    action === 'CHAMADA_ESTRATEGICA'
  ) {
    daysToAdd = 0;
  } else if (action === 'RETORNO_3_DIAS') {
    daysToAdd = 3;
  } else if (action === 'RETORNO_7_DIAS') {
    daysToAdd = 7;
  } else if (action === 'OUTRO') {
    daysToAdd = 3;
  } else if (action === 'SEM_ACAO_NECESSARIA') {
    return null;
  }

  if (daysToAdd === null) return null;

  const due = new Date(base);
  due.setUTCDate(due.getUTCDate() + daysToAdd);

  return due.toISOString();
}

function resolveResolutionStatus(nextAction, dueDate) {
  const action = String(nextAction || '').toUpperCase();

  if (action === 'SEM_ACAO_NECESSARIA') return 'NO_ACTION';
  if (dueDate) return 'OPEN';

  return 'OPEN';
}

function __deprecated_inferRiskLevelFromOutcome(outcome) {
  switch (String(outcome || '').toUpperCase()) {
    case 'PEDIU_CANCELAMENTO':
      return 'CRITICAL';
    case 'PROBLEMA_FINANCEIRO':
    case 'SEM_RESPOSTA':
    case 'DESMOTIVACAO':
      return 'HIGH';
    case 'SEMANA_ATIPICA_VIAGEM':
    case 'DOR_LIMITACAO':
    case 'DIFICULDADE_ALIMENTAR':
    case 'OUTRO':
      return 'MEDIUM';
    case 'RETOMOU_ROTINA':
    case 'VAI_RESPONDER_CHECKIN':
      return 'LOW';
    default:
      return null;
  }
}

function normalizeWhatsapp(rawValue) {
  const digits = String(rawValue || '').replace(/\D+/g, '');
  if (!digits) return null;
  if (digits.startsWith('55')) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function __deprecated_nullableTrimmed(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

async function getActiveNutritionPlanByEmail(db, email) {
  const row = await db.prepare(
    `SELECT id, student_email, title, goal, strategy, meals_json, substitutions_json,
            adherence_rules_json, notes, whatsapp_message, created_at, updated_at
     FROM nutrition_plans
     WHERE lower(student_email)=? AND is_active=1
     ORDER BY updated_at DESC
     LIMIT 1`
  ).bind(String(email || '').toLowerCase()).first();

  if (!row) return null;

  return {
    id: row.id,
    student_email: row.student_email,
    title: row.title,
    goal: row.goal,
    strategy: row.strategy,
    meals: safeJsonParseArray(row.meals_json),
    substitutions: safeJsonParseArray(row.substitutions_json),
    adherence_rules: safeJsonParseArray(row.adherence_rules_json),
    notes: row.notes,
    whatsapp_message: row.whatsapp_message,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}


function calculateAnamnesisInternalScores(answers) {
  const source = answers && typeof answers === 'object' ? answers : {};

  return {
    adherence_score: averageScore([
      scoreNumber(pickAnamnesisValue(source, ['adherence.change_readiness', 'adherence.readiness', 'change_readiness']), { min: 0, max: 10 }),
      scoreBarrier(pickAnamnesisValue(source, ['adherence.consistency_barrier', 'adherence.difficulty', 'consistency_barrier']), { invert: true }),
      scoreTriedBefore(pickAnamnesisValue(source, ['adherence.tried_before', 'adherence.previous_attempts', 'tried_before'])),
      scoreFrequency(pickAnamnesisValue(source, ['nutrition.weighs_food', 'weighs_food']), { positive: true }),
      scoreOrganization(pickAnamnesisValue(source, ['nutrition.self_evaluation', 'self_evaluation'])),
      scoreFrequency(pickAnamnesisValue(source, ['nutrition.off_plan_frequency', 'off_plan_frequency']), { positive: false }),
      scoreFrequency(pickAnamnesisValue(source, ['nutrition.stress_eating', 'stress_eating']), { positive: false }),
      scoreFrequency(pickAnamnesisValue(source, ['nutrition.binge_episodes', 'binge_episodes']), { positive: false })
    ], 2),
    risk_score: averageScore([
      scoreFrequency(pickAnamnesisValue(source, ['nutrition.binge_episodes', 'binge_episodes']), { positive: true }),
      scoreFrequency(pickAnamnesisValue(source, ['nutrition.stress_eating', 'stress_eating']), { positive: true }),
      scoreNumber(pickAnamnesisValue(source, ['recovery.stress_level', 'stress_level']), { min: 0, max: 10 }),
      scoreSleepQuality(pickAnamnesisValue(source, ['recovery.sleep_quality', 'sleep.sleep_quality', 'sleep_quality']), { invert: true }),
      scoreBarrier(pickAnamnesisValue(source, ['adherence.consistency_barrier', 'adherence.difficulty', 'consistency_barrier']), { invert: false }),
      scoreMedicalText(pickAnamnesisValue(source, ['training.injuries_pain', 'injuries_pain'])),
      scoreMedicalText(pickAnamnesisValue(source, ['health.conditions', 'clinical.conditions', 'conditions'])),
      scoreMedicalText(pickAnamnesisValue(source, ['health.medications', 'clinical.medications', 'medications'])),
      scoreMedicalText(pickAnamnesisValue(source, ['health.hormones', 'clinical.hormones', 'hormones']))
    ], 2),
    routine_score: averageScore([
      scoreYesNo(pickAnamnesisValue(source, ['routine.allows_planning', 'routine.availability', 'allows_planning']), { yes: 10, no: 2 }),
      scoreWorkHours(pickAnamnesisValue(source, ['routine.work_hours', 'work_hours'])),
      scoreRoutineFlow(pickAnamnesisValue(source, ['routine.flow', 'routine.routine_flow', 'flow'])),
      scoreBarrier(pickAnamnesisValue(source, ['routine.organization_barrier', 'organization_barrier']), { invert: true }),
      scoreYesNo(pickAnamnesisValue(source, ['routine.prepares_meals', 'prepares_meals']), { yes: 10, no: 3, sometimes: 6 }),
      scoreYesNo(pickAnamnesisValue(source, ['nutrition.defined_schedule', 'defined_schedule']), { yes: 10, no: 2 }),
      scoreMealsPerDay(pickAnamnesisValue(source, ['nutrition.meals_per_day', 'meals_per_day']))
    ], 2),
    recovery_score: averageScore([
      scoreSleepQuality(pickAnamnesisValue(source, ['recovery.sleep_quality', 'sleep.sleep_quality', 'sleep_quality'])),
      scoreSleepHours(pickAnamnesisValue(source, ['recovery.sleep_hours', 'sleep.hours', 'sleep_hours'])),
      scoreNumber(pickAnamnesisValue(source, ['recovery.stress_level', 'stress_level']), { min: 0, max: 10, invert: true }),
      scoreNumber(pickAnamnesisValue(source, ['recovery.daily_energy', 'daily_energy']), { min: 0, max: 10 }),
      scoreYesNo(pickAnamnesisValue(source, ['recovery.wakes_rested', 'wakes_rested']), { yes: 10, no: 2, sometimes: 6 })
    ], 2)
  };
}

function pickAnamnesisValue(source, paths) {
  for (const path of paths) {
    const value = path.split('.').reduce((current, key) => current?.[key], source);
    if (hasAnamnesisValue(value)) return value;
  }
  return null;
}

function hasAnamnesisValue(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
}

function averageScore(values, minimumSignals = 2) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length < minimumSignals) return null;
  const average = valid.reduce((sum, value) => sum + value, 0) / valid.length;
  return Math.max(0, Math.min(10, Math.round(average)));
}

function scoreNumber(value, { min = 0, max = 10, invert = false } = {}) {
  if (!hasAnamnesisValue(value)) return null;
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (!Number.isFinite(parsed)) return null;
  const normalized = ((parsed - min) / (max - min)) * 10;
  const score = invert ? 10 - normalized : normalized;
  return clampScore(score);
}

function scoreYesNo(value, { yes = 10, no = 0, sometimes = 5 } = {}) {
  const text = normalizeScoreText(value);
  if (!text) return null;
  if (text.includes('as vezes') || text.includes('às vezes') || text.includes('parcial') || text.includes('medio')) return sometimes;
  if (text.includes('sim') || text.includes('tenho') || text.includes('consigo')) return yes;
  if (text.includes('nao') || text.includes('não') || text.includes('nunca')) return no;
  return null;
}

function scoreFrequency(value, { positive = true } = {}) {
  const text = normalizeScoreText(value);
  if (!text) return null;
  let risk;
  if (text.includes('quase nunca') || text.includes('nunca') || text.includes('nao') || text.includes('não')) risk = 0;
  else if (text.includes('as vezes') || text.includes('às vezes') || text.includes('1-2') || text.includes('1 a 2') || text.includes('pouco')) risk = 3;
  else if (text.includes('sim')) risk = 8;
  else if (text.includes('3-4') || text.includes('3 a 4') || text.includes('moderad') || text.includes('razoavel')) risk = 6;
  else if (text.includes('5 ou mais') || text.includes('frequent') || text.includes('sempre') || text.includes('muito')) risk = 9;
  else return null;
  return positive ? risk : 10 - risk;
}

function scoreOrganization(value) {
  const text = normalizeScoreText(value);
  if (!text) return null;
  if (text.includes('muito desorganizada')) return 1;
  if (text.includes('pouco organizada')) return 3;
  if (text.includes('razoavelmente organizada')) return 6;
  if (text.includes('bem organizada')) return 8;
  if (text.includes('muito organizada')) return 10;
  return scoreBarrier(value, { invert: true });
}

function scoreSleepQuality(value, { invert = false } = {}) {
  const text = normalizeScoreText(value);
  if (!text) return null;
  let score = null;
  if (text.includes('muito ruim') || text.includes('pessim') || text.includes('péssim')) score = 1;
  else if (text.includes('ruim')) score = 3;
  else if (text.includes('regular') || text.includes('razoavel') || text.includes('razoável')) score = 5;
  else if (text.includes('boa') || text.includes('bom')) score = 8;
  else if (text.includes('excelente') || text.includes('muito boa')) score = 10;
  return score === null ? null : invert ? 10 - score : score;
}

function scoreSleepHours(value) {
  const text = String(value ?? '').toLowerCase();
  const match = text.match(/\d+(?:[,.]\d+)?/);
  if (!match) return null;
  const hours = Number(match[0].replace(',', '.'));
  if (!Number.isFinite(hours)) return null;
  if (hours >= 7 && hours <= 9) return 10;
  if (hours >= 6 && hours < 7) return 7;
  if (hours >= 5 && hours < 6) return 4;
  if (hours > 9 && hours <= 10) return 7;
  return 2;
}

function scoreMealsPerDay(value) {
  const text = normalizeScoreText(value);
  if (!text) return null;
  if (text.includes('1-2') || text.includes('1 a 2')) return 3;
  if (text.includes('3 refei')) return 7;
  if (text.includes('4 refei') || text.includes('5 refei')) return 10;
  if (text.includes('6 ou mais')) return 8;
  return null;
}

function scoreWorkHours(value) {
  const text = normalizeScoreText(value);
  if (!text) return null;
  const numbers = [...text.matchAll(/\d+(?:[,.]\d+)?/g)].map((match) => Number(match[0].replace(',', '.'))).filter(Number.isFinite);
  const hours = numbers.length ? Math.max(...numbers) : null;
  if (hours !== null) {
    if (hours <= 8) return 9;
    if (hours <= 10) return 7;
    if (hours <= 12) return 5;
    return 3;
  }
  if (text.includes('flexivel') || text.includes('flexível') || text.includes('tranquil')) return 9;
  if (text.includes('plantao') || text.includes('plantão') || text.includes('escala') || text.includes('muito')) return 4;
  return null;
}

function scoreRoutineFlow(value) {
  const text = normalizeScoreText(value);
  if (!text) return null;
  if (text.includes('organizada') || text.includes('previsivel') || text.includes('previsível') || text.includes('tranquil')) return 9;
  if (text.includes('corrida') || text.includes('imprevisivel') || text.includes('imprevisível') || text.includes('caotica') || text.includes('caótica')) return 3;
  if (text.includes('razoavel') || text.includes('razoável') || text.includes('regular')) return 6;
  return null;
}

function scoreBarrier(value, { invert = false } = {}) {
  const text = normalizeScoreText(value);
  if (!text) return null;
  let barrier;
  if (text.includes('nenhum') || text.includes('sem barreira') || text.includes('nao tenho') || text.includes('não tenho')) barrier = 0;
  else if (text.includes('pouco') || text.includes('pequeno')) barrier = 3;
  else if (text.includes('tempo') || text.includes('rotina') || text.includes('organiz') || text.includes('ansiedade') || text.includes('estresse')) barrier = 6;
  else if (text.includes('muito') || text.includes('sempre') || text.includes('compuls') || text.includes('lesao') || text.includes('lesão')) barrier = 8;
  else barrier = 5;
  return invert ? 10 - barrier : barrier;
}

function scoreTriedBefore(value) {
  const text = normalizeScoreText(value);
  if (!text) return null;
  if (text.includes('nunca') || text.includes('nao') || text.includes('não')) return 6;
  return 7;
}

function scoreMedicalText(value) {
  const text = normalizeScoreText(value);
  if (!text) return null;
  if (text.includes('nenhum') || text.includes('nao') || text.includes('não') || text.includes('sem ')) return 0;
  if (text.includes('grave') || text.includes('cron') || text.includes('crôn') || text.includes('lesao') || text.includes('lesão') || text.includes('dor')) return 8;
  return 5;
}

function clampScore(score) {
  if (!Number.isFinite(score)) return null;
  return Math.max(0, Math.min(10, score));
}

function normalizeScoreText(value) {
  if (!hasAnamnesisValue(value)) return '';
  return String(Array.isArray(value) ? value.join(' ') : value).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function safeJsonParseArray(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeJsonParseObject(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,x-admin-token,x-student-email,x-student-token'
  };
}

function corsResponse() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

function generateAccessToken() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}


const PROJECT_LM_GOALS = new Set([
  'emagrecer_com_consistencia',
  'voltar_a_treinar',
  'melhorar_alimentacao',
  'mais_energia',
  'recomecar_sem_extremos'
]);

const PROJECT_LM_DIFFICULTIES = new Set([
  'falta_de_tempo',
  'alimentacao_desorganizada',
  'cansaco',
  'falta_de_constancia',
  'abandono',
  'nao_sei_por_onde_comecar'
]);

function sanitizeProjectLmValue(value) {
  return nullableTrimmed(value);
}

function mapProjectLmProfile(row) {
  if (!row) return null;
  return {
    student_email: row.student_email,
    goal: row.goal,
    main_difficulty: row.main_difficulty,
    mainDifficulty: row.main_difficulty,
    onboarding_completed: Number(row.onboarding_completed || 0),
    onboardingCompleted: Number(row.onboarding_completed || 0),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function getProjectLmProfile(db, studentEmail) {
  const row = await db.prepare(
    `SELECT student_email, goal, main_difficulty, onboarding_completed, created_at, updated_at
     FROM project_lm_profile
     WHERE lower(student_email)=?
     LIMIT 1`
  ).bind(String(studentEmail || '').trim().toLowerCase()).first();
  return mapProjectLmProfile(row);
}

function buildFallbackAnamnesisEmail(studentName, studentPhone) {
  const normalizedName = String(studentName || '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '').slice(0, 24) || 'aluno';
  const normalizedPhone = String(studentPhone || '').replace(/\D+/g, '').slice(-8) || Date.now().toString().slice(-8);
  return `${normalizedName}.${normalizedPhone}@anamnese.local`;
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders()
    }
  });
}

async function safeJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function __deprecated_getWeekRef(date) {
  const d = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  ));

  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);

  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);

  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function weekRefDiff(olderWeekRef, newerWeekRef) {
  const old = parseWeekRef(olderWeekRef);
  const newer = parseWeekRef(newerWeekRef);

  if (!old || !newer) return 0;

  const oldDate = isoWeekStartDate(old.year, old.week);
  const newDate = isoWeekStartDate(newer.year, newer.week);

  return Math.floor((newDate - oldDate) / (7 * 24 * 60 * 60 * 1000));
}

function parseWeekRef(weekRef) {
  const match = String(weekRef || '').match(/^(\d{4})-W(\d{2})$/);

  if (!match) return null;

  return {
    year: Number(match[1]),
    week: Number(match[2])
  };
}

function isoWeekStartDate(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;

  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);

  const target = new Date(week1Monday);
  target.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);

  return target;
}

function computeClinicalPriority(checkin, weeklyPlan) {
  if (!checkin) {
    return { level: 'HIGH', message: 'Sem check-in recente. Prioridade em reativar contato clínico.' };
  }

  const stress = Number(checkin.stress_level || 0);
  const energy = Number(checkin.energy_level || 0);
  const sleep = Number(checkin.sleep_quality || 0);
  const hasSupportSignal = String(checkin.support_needed || '').trim().length > 0;
  const pendingCoachReply = !checkin.coach_reply;
  const hasRiskInPlan = String(weeklyPlan?.main_risk || '').trim().length > 0;

  if (stress >= 8 || energy <= 3 || sleep <= 3 || hasSupportSignal) {
    return { level: 'CRITICAL', message: 'Aluno em sinal clínico agudo. Ajustar plano e responder hoje.' };
  }
  if (pendingCoachReply || !hasRiskInPlan) {
    return { level: 'HIGH', message: 'Ações clínicas pendentes na semana atual.' };
  }
  return { level: 'MODERATE', message: 'Aluno estável. Manter acompanhamento e microajustes.' };
}

function computeNextRecommendedAction(checkin, weeklyPlan) {
  if (!checkin) {
    return { code: 'REQUEST_CHECKIN', label: 'Cobrar check-in da semana', reason: 'Sem check-in disponível no Student 360.' };
  }
  if (!checkin.coach_reply) {
    return { code: 'REPLY_CHECKIN', label: 'Responder último check-in', reason: 'Existe check-in sem retorno do coach.' };
  }
  if (!weeklyPlan) {
    return { code: 'CREATE_WEEKLY_PLAN', label: 'Criar plano semanal atual', reason: 'Aluno sem plano semanal ativo.' };
  }
  return { code: 'REFINE_WEEKLY_PLAN', label: 'Refinar plano semanal', reason: 'Check-in respondido; revisar foco de execução.' };
}

function isAdminAuthorized(request, env) {
  const token = String(request.headers.get('x-admin-token') || '').trim();
  const adminToken = String(env.ADMIN_TOKEN || '').trim();
  const portalToken = String(env.PORTAL_ADMIN_TOKEN || '').trim();

  return !!token && (
    (!!portalToken && token === portalToken) ||
    (!!adminToken && token === adminToken)
  );
}


function normalizeStudentPlan(plan) {
  if (!plan) return 'premium';
  const normalized = String(plan).trim().toLowerCase();
  if (normalized === 'premium' || normalized === 'projeto_lm') return normalized;
  return 'projeto_lm';
}

async function validateStudent(request, db) {
  const email = String(request.headers.get('x-student-email') || '').trim().toLowerCase();
  const token = String(request.headers.get('x-student-token') || '').trim();

  if (!email || !token) {
    return { ok: false, error: 'Credenciais do aluno ausentes.' };
  }

  const student = await db.prepare(
    `SELECT name, email, plan_type, plan
     FROM student_access
     WHERE lower(email)=?
       AND access_token=?
       AND status='ACTIVE'`
  ).bind(email, token).first();

  if (!student) {
    return { ok: false, error: 'Acesso inválido.' };
  }

  return {
    ok: true,
    student: {
      name: student.name,
      email: student.email,
      planType: student.plan_type || 'PREMIUM',
      plan: normalizeStudentPlan(student.plan)
    }
  };
}
