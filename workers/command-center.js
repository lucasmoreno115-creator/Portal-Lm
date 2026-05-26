export function buildActionUrl(email) {
  return `/admin-student.html?email=${encodeURIComponent(String(email || '').toLowerCase())}`;
}
