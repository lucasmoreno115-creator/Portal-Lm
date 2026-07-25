import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

await import('../public/assets/js/portal-notifications.js');
const notifications = globalThis.PortalNotifications;
const source = await readFile(new URL('../public/assets/js/portal-notifications.js', import.meta.url), 'utf8');
const home = await readFile(new URL('../public/portal-premium-home.html', import.meta.url), 'utf8');
const canonicalHome = await readFile(new URL('../portal-premium-home.html', import.meta.url), 'utf8');
const styles = await readFile(new URL('../public/assets/css/portal-notifications.css', import.meta.url), 'utf8');

test('badge oculta zero e limita contagens acima de 99', () => {
  assert.equal(notifications.badgeText(0), '');
  assert.equal(notifications.badgeText(7), '7');
  assert.equal(notifications.badgeText(100), '99+');
});

test('notificações são agrupadas em português por data', () => {
  const now = new Date('2026-07-25T14:00:00-03:00'); // sábado
  const items = [
    { id: 1, created_at: '2026-07-25T08:00:00-03:00' },
    { id: 2, created_at: '2026-07-24T08:00:00-03:00' },
    { id: 3, created_at: '2026-07-22T08:00:00-03:00' },
    { id: 4, created_at: '2026-07-18T08:00:00-03:00' },
  ];
  const grouped = notifications.groupNotifications(items, now);
  assert.deepEqual(notifications.GROUP_ORDER, ['Hoje', 'Ontem', 'Esta semana', 'Mais antigas']);
  assert.deepEqual(Object.values(grouped).map((group) => group.map(({ id }) => id)), [[1], [2], [3], [4]]);
});

test('mapa de ícones cobre os contratos do Notification Engine e tem fallback', () => {
  assert.deepEqual(notifications.ICONS, {
    WEEKLY_CHECKIN_REMINDER: '📋', ANAMNESIS_REQUIRED: '📝', PLANNING_PUBLISHED: '🥗',
    WORKOUT_UPDATED: '🏋️', COACH_REPLY: '💬', ACCOUNT_RELEASED: '🔓', CUSTOM: '🔔',
  });
  assert.equal(notifications.iconFor('DESCONHECIDO'), '🔔');
});

test('Home carrega módulo isolado e módulo usa somente endpoints N2.1', () => {
  assert.match(home, /assets\/js\/portal-notifications\.js/);
  assert.match(source, /\/portal\/notifications\?limit=50/);
  assert.match(source, /\/portal\/notifications\/unread-count/);
  assert.match(source, /\/portal\/notifications\/\$\{encodeURIComponent\(notification\.id\)\}\/read/);
  assert.match(source, /\/portal\/notifications\/read-all/);
});

test('drawer contempla estados, leitura, navegação e acessibilidade por teclado', () => {
  for (const phrase of ['Carregando notificações', 'Você está em dia.', 'Quando houver novidades', 'elas aparecerão aqui.', 'Não foi possível carregar', 'Marcar todas como lidas']) {
    assert.ok(source.includes(phrase), `texto ausente: ${phrase}`);
  }
  assert.match(source, /global\.location\.assign\(notification\.action_url\)/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /returnFocus\.focus\(\)/);
  assert.match(source, /aria-modal/);
  assert.match(source, /event\.key !== 'Tab'/);
});

test('polish N2.2.1 posiciona sino no header e oferece configuração de push no drawer', () => {
  assert.match(home, /<header class='hero hero-premium hero-app'>/);
  assert.match(source, /⚙️ Configurações/);
  assert.match(source, /✓ Notificações ativadas/);
  assert.match(source, /Desativar neste dispositivo/);
  assert.match(source, /PortalPushNotifications\?\.disableCurrent/);
  assert.match(source, /closeDrawer\(\)/);
  assert.match(styles, /min-width:44px/);
  assert.match(styles, /min-height:44px/);
  assert.match(styles, /\.notification-panel\{width:94%/);
  assert.match(styles, /notification-badge-in/);
  assert.match(styles, /transition:background-color \.25s ease,opacity \.25s ease,transform \.25s ease/);
});

test('hotfix N2.2.1 monta o sino no contêiner dedicado e mantém as Homes sincronizadas', () => {
  const actionsMarkup = "<div id='premiumHomeHeaderActions' class='premium-home-header-actions'></div>";
  assert.ok(home.includes(actionsMarkup));
  assert.ok(canonicalHome.includes(actionsMarkup));
  assert.equal(home.match(/<div id='premiumHomeHeaderActions'[^>]*><\/div>/)?.[0], canonicalHome.match(/<div id='premiumHomeHeaderActions'[^>]*><\/div>/)?.[0]);
  assert.match(source, /document\.getElementById\('premiumHomeHeaderActions'\)/);
  assert.match(source, /headerActions\.append\(trigger\)/);
  assert.doesNotMatch(source, /querySelector\('\.hero-app'\)|hero\.append\(trigger\)/);
});

test('hotfix N2.2.1 preserva toque mobile de 44 px acima dos overlays e separado da logo', () => {
  assert.match(styles, /\.premium-home-header-actions\{[^}]*z-index:7[^}]*pointer-events:auto/);
  assert.match(styles, /\.notification-trigger\{[^}]*min-width:44px[^}]*min-height:44px/);
  assert.match(styles, /@media\(max-width:720px\)\{\.premium-home-header-actions\{top:10px;right:104px\}\.notification-trigger\{width:44px;height:44px\}/);
});
