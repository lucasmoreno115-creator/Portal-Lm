import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

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

        if (url.pathname === '/api/portal/nutrition-plan/pdf' && method === 'GET') {
          const plan = await getActiveNutritionPlanByEmail(env.DB, studentEmail);
          if (!plan) {
            return json({ ok: false, error: 'Plano alimentar não disponível para exportação.' }, 404);
          }

          const pdfBytes = await buildNutritionPlanPdf({
            studentName: auth.student.name || 'Aluno',
            plan
          });

          return new Response(pdfBytes, {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="planejamento-nutricional-${sanitizeFilename(studentEmail)}.pdf"`,
              'Cache-Control': 'no-store',
              ...corsHeaders()
            }
          });
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
            `SELECT * FROM student_checkins WHERE student_email=? ORDER BY created_at DESC LIMIT 20`
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



function sanitizeFilename(value) {
  return String(value || 'aluno')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'aluno';
}

async function buildNutritionPlanPdf({ studentName, plan }) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const marginX = 48;
  const marginTop = 54;
  const marginBottom = 48;
  const contentWidth = page.getWidth() - marginX * 2;
  let y = page.getHeight() - marginTop;

  const drawWrappedText = (text, options = {}) => {
    const {
      size = 11,
      lineHeight = 15,
      color = rgb(0.08, 0.1, 0.14),
      font = fontRegular,
      indent = 0,
      bullet = null
    } = options;

    const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
    const bulletPrefix = bullet ? `${bullet} ` : '';
    const maxWidth = contentWidth - indent;
    const words = `${bulletPrefix}${cleaned}`.split(' ');
    let current = '';

    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      const width = font.widthOfTextAtSize(test, size);
      if (width <= maxWidth || !current) current = test;
      else {
        if (y < marginBottom) return false;
        page.drawText(current, { x: marginX + indent, y, size, font, color });
        y -= lineHeight;
        current = word;
      }
    }

    if (current) {
      if (y < marginBottom) return false;
      page.drawText(current, { x: marginX + indent, y, size, font, color });
      y -= lineHeight;
    }

    return true;
  };

  const spacer = (height = 8) => {
    y -= height;
  };

  drawWrappedText('CONSULTORIA LM', { font: fontBold, size: 16, lineHeight: 20, color: rgb(0.06, 0.2, 0.45) });
  drawWrappedText(studentName || 'Aluno', { font: fontBold, size: 12, lineHeight: 16 });
  drawWrappedText('Planejamento Nutricional Atual', { size: 11, color: rgb(0.25, 0.3, 0.4) });
  spacer(12);

  const sections = [
    ['1. Objetivo atual', plan?.goal || 'Não informado.'],
    ['2. Estratégia da fase', plan?.strategy || 'Não informada.'],
    ['3. Plano alimentar', Array.isArray(plan?.meals) && plan.meals.length ? plan.meals : null],
    ['4. Equivalências e substituições', Array.isArray(plan?.substitutions) && plan.substitutions.length ? plan.substitutions : null],
    ['5. Regras de adesão', Array.isArray(plan?.adherence_rules) && plan.adherence_rules.length ? plan.adherence_rules : ['Sem regras cadastradas.']],
    ['6. Observações', plan?.notes || 'Sem observações.'],
    ['7. Suporte', 'Em caso de dúvidas, utilize o Portal LM ou entre em contato para ajustes.']
  ];

  for (const [title, content] of sections) {
    if (!drawWrappedText(title, { font: fontBold, size: 12, lineHeight: 17 })) break;

    if (title.startsWith('3.') && Array.isArray(content)) {
      for (const [index, meal] of content.entries()) {
        if (!drawWrappedText(`${index + 1}) ${meal?.name || 'Refeição'}`, { font: fontBold, indent: 8 })) break;
        const items = Array.isArray(meal?.items) && meal.items.length ? meal.items : ['Sem itens cadastrados.'];
        for (const item of items) {
          if (!drawWrappedText(item, { indent: 20, bullet: '•' })) break;
        }
        spacer(4);
      }
    } else if (title.startsWith('4.') && Array.isArray(content)) {
      for (const [index, sub] of content.entries()) {
        if (!drawWrappedText(`${index + 1}) ${sub?.title || 'Substituição'}`, { font: fontBold, indent: 8 })) break;
        const items = Array.isArray(sub?.items) && sub.items.length ? sub.items : ['Sem itens cadastrados.'];
        for (const item of items) {
          if (!drawWrappedText(item, { indent: 20, bullet: '•' })) break;
        }
        spacer(4);
      }
    } else if (Array.isArray(content)) {
      for (const rule of content) {
        if (!drawWrappedText(rule, { indent: 12, bullet: '•' })) break;
      }
    } else {
      drawWrappedText(content, { indent: 8 });
    }

    spacer(10);
    if (y < marginBottom) break;
  }

  return pdfDoc.save();
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
