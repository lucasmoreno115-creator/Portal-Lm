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
              id, student_email, contact_type, reason, note, outcome, risk_level, next_action, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(id, studentEmail, contactType, reason, note, outcome, riskLevel, nextAction, createdAt).run();

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
              created_at: createdAt
            }
          });
        }

        if (url.pathname === '/api/admin/followup-logs' && method === 'GET') {
          const { results = [] } = await env.DB.prepare(
            `SELECT student_email, contact_type, reason, note, outcome, risk_level, next_action, created_at
             FROM followup_logs
             ORDER BY created_at DESC
             LIMIT 30`
          ).all();

          return json({ ok: true, data: results });
        }

        if (url.pathname === '/api/admin/followup-resolve' && method === 'POST') {
          const body = await safeJson(request);
          const id = String(body?.id || '').trim();

          if (!id) {
            return json({ ok: false, error: 'id é obrigatório.' }, 400);
          }

          const existing = await env.DB.prepare(
            `SELECT id FROM followup_logs WHERE id=? LIMIT 1`
          ).bind(id).first();

          if (!existing) {
            return json({ ok: false, error: 'Follow-up não encontrado.' }, 404);
          }

          const resolvedAt = new Date().toISOString();

          await env.DB.prepare(
            `UPDATE followup_logs
             SET resolution_status='RESOLVED', resolved_at=?
             WHERE id=?`
          ).bind(resolvedAt, id).run();

          return json({
            ok: true,
            data: {
              id,
              resolved_at: resolvedAt,
              resolution_status: 'RESOLVED'
            }
          });
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

          const cancellationHighMessage = `Quero alinhar sua semana para evitar que a rotina perca força.

Me responde rapidamente o que mais está dificultando sua execução agora.`;
          const cancellationCriticalMessage = `Quero falar com você rapidamente para alinharmos sua continuidade.

Percebi um ponto importante no seu acompanhamento e prefiro ajustar antes que isso vire cancelamento.

Me responde assim que puder.`;

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
}

async function ensureColumn(db, tableName, columnName, sqlType) {
  const columns = await db.prepare(`PRAGMA table_info(${tableName})`).all();
  const exists = (columns?.results || []).some((col) => col.name === columnName);
  if (!exists) {
    await db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${sqlType}`).run();
  }
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
  const token = request.headers.get('x-admin-token');
  const portalToken = env.PORTAL_ADMIN_TOKEN || env.ADMIN_TOKEN;

  return !!token && token === portalToken;
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
