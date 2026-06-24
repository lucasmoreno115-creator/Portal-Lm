export async function tableExists(db, tableName) {
  const row = await db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=? LIMIT 1`
  ).bind(tableName).first();
  return Boolean(row?.name);
}

export async function buildD1HealthCheck(db) {
  const studentsTableExists = await tableExists(db, 'students');
  const summary = {
    students_total: await scalarNumber(db, `SELECT COUNT(*) AS total FROM student_access`),
    students_active: await scalarNumber(db, `SELECT COUNT(*) AS total FROM student_access WHERE upper(status)='ACTIVE'`),
    premium_students: await scalarNumber(
      db,
      `SELECT COUNT(*) AS total
       FROM student_access
       WHERE lower(COALESCE(plan_type, plan, 'premium')) IN ('premium', 'premium_lm')`
    ),
    project_lm_students: await scalarNumber(
      db,
      `SELECT COUNT(*) AS total
       FROM student_access
       WHERE lower(COALESCE(plan_type, plan, '')) IN ('project_lm', 'projeto_lm', 'projeto lm')`
    )
  };

  const duplicateStudentAccessEmails = await rows(db, `
    SELECT lower(email) AS email, COUNT(*) AS count
    FROM student_access
    WHERE email IS NOT NULL AND trim(email) <> ''
    GROUP BY lower(email)
    HAVING COUNT(*) > 1
    ORDER BY count DESC, email ASC
    LIMIT 20
  `);

  const duplicateStudentsEmails = studentsTableExists
    ? await rows(db, `
        SELECT lower(email) AS email, COUNT(*) AS count
        FROM students
        WHERE email IS NOT NULL AND trim(email) <> ''
        GROUP BY lower(email)
        HAVING COUNT(*) > 1
        ORDER BY count DESC, email ASC
        LIMIT 20
      `)
    : [];

  const projectProfilesWithoutStudent = await rows(db, `
    SELECT p.id, CAST(p.user_id AS TEXT) AS student_id, p.created_at
    FROM project_lm_profiles p
    LEFT JOIN student_access sa ON CAST(p.user_id AS TEXT)=CAST(sa.id AS TEXT)
    WHERE sa.id IS NULL
    ORDER BY datetime(p.created_at) DESC
    LIMIT 20
  `);

  const studentAccessWithoutStudent = studentsTableExists
    ? await rows(db, `
        SELECT sa.id, lower(sa.email) AS email, sa.created_at
        FROM student_access sa
        LEFT JOIN students s ON lower(sa.email)=lower(s.email)
        WHERE s.email IS NULL
        ORDER BY datetime(sa.created_at) DESC
        LIMIT 20
      `)
    : [];

  const weeklyPlansWithoutStudent = await rows(db, `
    SELECT wp.id, lower(wp.student_email) AS email, wp.student_email AS student_id, wp.created_at
    FROM weekly_plans wp
    LEFT JOIN student_access sa ON lower(wp.student_email)=lower(sa.email)
    WHERE sa.email IS NULL
    ORDER BY datetime(wp.created_at) DESC
    LIMIT 20
  `);

  const timelineEventsWithoutStudent = await rows(db, `
    SELECT at.id, lower(at.student_email) AS email, at.student_email AS student_id, at.created_at
    FROM activity_timeline at
    LEFT JOIN student_access sa ON lower(at.student_email)=lower(sa.email)
    WHERE sa.email IS NULL
    ORDER BY datetime(at.created_at) DESC
    LIMIT 20
  `);

  const checkinsWithoutStudent = await rows(db, `
    SELECT sc.id, lower(sc.student_email) AS email, sc.student_email AS student_id, sc.created_at
    FROM student_checkins sc
    LEFT JOIN student_access sa ON lower(sc.student_email)=lower(sa.email)
    WHERE sa.email IS NULL
    ORDER BY datetime(sc.created_at) DESC
    LIMIT 20
  `);

  const checks = {
    duplicate_student_access_emails: formatHealthCheckItems(duplicateStudentAccessEmails),
    duplicate_students_emails: formatHealthCheckItems(duplicateStudentsEmails),
    project_profiles_without_student: formatHealthCheckItems(projectProfilesWithoutStudent),
    student_access_without_student: formatHealthCheckItems(studentAccessWithoutStudent),
    weekly_plans_without_student: formatHealthCheckItems(weeklyPlansWithoutStudent),
    timeline_events_without_student: formatHealthCheckItems(timelineEventsWithoutStudent),
    checkins_without_student: formatHealthCheckItems(checkinsWithoutStudent)
  };

  const status = Object.values(checks).some((check) => check.count > 0) ? 'warning' : 'healthy';

  return { summary, checks, status };
}

export function formatHealthCheckItems(items) {
  return {
    count: items.length,
    items: items.map((item) => sanitizeHealthCheckItem(item))
  };
}

export function sanitizeHealthCheckItem(item) {
  const sanitized = {};
  for (const key of ['id', 'student_id', 'email', 'count', 'created_at']) {
    if (item[key] !== undefined && item[key] !== null) sanitized[key] = item[key];
  }
  return sanitized;
}

export async function scalarNumber(db, query) {
  const row = await db.prepare(query).first();
  return Number(row?.total || 0);
}

export async function rows(db, query) {
  const { results = [] } = await db.prepare(query).all();
  return results || [];
}

