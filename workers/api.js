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
        const studentEmail = providedEmail || buildFallbackAnamnesisEmail(studentName, studentPhone);
        const status = nullableTrimmed(body?.status) || 'RECEBIDA';
        const answers = body?.answers && typeof body.answers === 'object' ? body.answers : {};
        const internalScores = body?.internal_scores && typeof body.internal_scores === 'object' ? body.internal_scores : {
          adherence_score: null,
          risk_score: null,
          routine_score: null,
          recovery_score: null
        };

        if (!studentName) {
          return json({ ok: false, error: 'student_name é obrigatório.' }, 400);
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

        return json({ ok: true, data: { id, created_at: now } });
      }

      if (url.pathname === '/api/portal/login' && method === 'POST') {
        const body = await safeJson(request);
        const email = String(body?.email || '').trim().toLowerCase();
        const token = String(body?.token || '').trim();

        if (!email || !token) {
          return json({ ok: false, error: 'Email e token são obrigatórios.' }, 400);
        }

        const student = await env.DB.prepare(
          `SELECT name, email, plan_type FROM student_access WHERE lower(email)=? AND access_token=? AND status='ACTIVE'`
        ).bind(email, token).first();

        if (!student) {
          return json({ ok: false, error: 'Credenciais inválidas.' }, 401);
        }

        return json({
          ok: true,
          data: {
            name: student.name,
            email: student.email,
            planType: student.plan_type || 'START'
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


        if (url.pathname === '/api/admin/student-360' && method === 'GET') {
          const email = String(url.searchParams.get('email') || '').trim().toLowerCase();
          if (!email) {
            return json({ ok: false, error: 'email é obrigatório.' }, 400);
          }

          const studentAccess = await env.DB.prepare(
            `SELECT name, email, whatsapp, plan_type, status
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

          const student = {
            name: studentAccess?.name
              || latestAnamnesis?.student_name
              || latestCheckin?.student_name
              || activeNutritionPlan?.student_name
              || email,
            email,
            whatsapp: studentAccess?.whatsapp || latestAnamnesis?.student_phone || null,
            plan_type: studentAccess?.plan_type || 'Não cadastrado',
            status: studentAccess?.status || 'Sem acesso criado'
          };

          const timeline = [];
          if (latestAnamnesis?.created_at) {
            timeline.push({ type: 'anamnese_enviada', at: latestAnamnesis.created_at, title: 'Anamnese enviada' });
          }
          if (latestCheckin?.created_at) {
            timeline.push({ type: 'checkin_enviado', at: latestCheckin.created_at, title: 'Check-in enviado' });
          }
          if (latestCheckin?.coach_reply_at || latestCheckin?.coach_reply) {
            timeline.push({
              type: 'resposta_coach',
              at: latestCheckin.coach_reply_at || latestCheckin.created_at,
              title: 'Resposta do coach',
              detail: latestCheckin.coach_reply || null
            });
          }
          if (activeWeeklyPlan?.updated_at) {
            timeline.push({ type: 'plano_semanal_atualizado', at: activeWeeklyPlan.updated_at, title: 'Plano semanal atualizado' });
          }
          if (activeNutritionPlan?.updated_at || activeNutritionPlan?.created_at) {
            timeline.push({
              type: 'plano_alimentar_atualizado',
              at: activeNutritionPlan.updated_at || activeNutritionPlan.created_at,
              title: 'Plano alimentar atualizado'
            });
          }

          const clinicalPriority = computeClinicalPriority(latestCheckin, activeWeeklyPlan);
          const nextRecommendedAction = computeNextRecommendedAction(latestCheckin, activeWeeklyPlan);

          timeline.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));

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
          const buildActionUrl = (email) => `/admin-student.html?email=${encodeURIComponent(String(email || '').toLowerCase())}`;

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

          const { results: pendingCheckinsListRaw = [] } = await env.DB.prepare(
            `SELECT sa.name, sa.email, sc.created_at
             FROM student_checkins sc
             JOIN student_access sa ON lower(sa.email)=lower(sc.student_email)
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
              `SELECT sa.name, sa.email, fl.due_date
               FROM followup_logs fl
               JOIN student_access sa ON lower(sa.email)=lower(fl.student_email)
               WHERE fl.resolution_status='OPEN'
                 AND fl.due_date IS NOT NULL
                 AND datetime(fl.due_date) <= datetime('now')
               ORDER BY datetime(fl.due_date) ASC
               LIMIT 10`
            ).all()).results || []
            : [];

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
              pending_checkins_list: pendingCheckinsList,
              students_without_checkin_week_list: studentsWithoutCheckinWeekList,
              new_anamneses_list: newAnamnesesList,
              students_without_weekly_plan_list: studentsWithoutWeeklyPlanList,
              students_without_nutrition_plan_list: studentsWithoutNutritionPlanList,
              overdue_followups_list: overdueFollowupsList,
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
    whatsapp TEXT,
    created_at TEXT NOT NULL
  )`).run();

  await ensureColumn(db, 'student_access', 'whatsapp', 'TEXT');

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

function inferRiskLevelFromOutcome(outcome) {
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

function nullableTrimmed(value) {
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

function getWeekRef(date) {
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

async function validateStudent(request, db) {
  const email = String(request.headers.get('x-student-email') || '').trim().toLowerCase();
  const token = String(request.headers.get('x-student-token') || '').trim();

  if (!email || !token) {
    return { ok: false, error: 'Credenciais do aluno ausentes.' };
  }

  const student = await db.prepare(
    `SELECT name, email, plan_type
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
      planType: student.plan_type || 'START'
    }
  };
}
