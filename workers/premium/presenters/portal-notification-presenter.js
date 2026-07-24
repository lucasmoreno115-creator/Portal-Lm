export function presentPortalNotification(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    action_url: row.action_url,
    status: row.status,
    created_at: row.created_at,
    read_at: row.read_at,
  };
}
