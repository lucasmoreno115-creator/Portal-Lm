(function (global) {
  'use strict';

  function text(value) { return value == null ? '' : String(value).trim(); }
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function splitLines(value) {
    return String(value == null ? '' : value).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }
  function isMarked(line) { return /^\s*(?:[-•*]\s+|\d+[.)]\s+)/.test(line); }
  function unmark(line) { return String(line).replace(/^\s*(?:[-•*]\s+|\d+[.)]\s+)/, '').trim(); }

  function formatStructuredItem(item) {
    if (typeof item === 'string') return item.trim();
    if (!item || typeof item !== 'object') return '';
    const amount = [text(item.quantity), text(item.unit)].filter(Boolean).join(' ');
    const food = text(item.food || item.name || item.text);
    const main = amount && food ? `${amount} de ${food}` : amount || food;
    const note = text(item.note || item.guidance);
    return [main, note ? `— ${note}` : ''].filter(Boolean).join(' ').trim();
  }

  function normalizeMealLines(value) {
    if (Array.isArray(value)) return value.flatMap((item) => splitLines(formatStructuredItem(item)));
    return splitLines(typeof value === 'object' ? formatStructuredItem(value) : value);
  }

  function getMealPrimaryContent(meal) {
    const primary = text(meal && meal.primary_text);
    if (primary) return { source: 'primary_text', lines: splitLines(primary) };
    const items = meal && meal.items;
    if (Array.isArray(items) && items.length) return { source: 'items', lines: normalizeMealLines(items) };
    return { source: 'empty', lines: [] };
  }
  function getMealPrimaryLines(meal) { return getMealPrimaryContent(meal).lines; }

  function getMealSubstitutions(meal) {
    if (!Array.isArray(meal && meal.substitutions)) return [];
    return meal.substitutions.map((substitution) => {
      if (typeof substitution === 'string') return normalizeMealLines(substitution);
      if (substitution && typeof substitution === 'object' && text(substitution.text)) return splitLines(substitution.text);
      return normalizeMealLines(substitution);
    }).filter((lines) => lines.length);
  }

  function renderLines(lines, options) {
    const className = options && options.className ? ` class='${options.className}'` : '';
    if (!lines.length) return options && options.emptyHtml ? options.emptyHtml : '';
    const marked = lines.some(isMarked);
    if (marked) return `<ul${className}>${lines.map((line) => `<li>${escapeHtml(unmark(line))}</li>`).join('')}</ul>`;
    return `<p${className} style='white-space: pre-wrap;'>${escapeHtml(lines.join('\n'))}</p>`;
  }

  function renderMealContent(meal, options) {
    const primary = getMealPrimaryContent(meal);
    const primaryHtml = renderLines(primary.lines, { emptyHtml: options && options.emptyHtml });
    const substitutions = getMealSubstitutions(meal);
    const substitutionsHtml = substitutions.length ? `<section class='meal-substitutions'><h4>Substituições</h4>${substitutions.map((lines, index) => `<div class='meal-substitution'><strong>Alternativa ${index + 1}</strong>${renderLines(lines)}</div>`).join('')}</section>` : '';
    return { primary, primaryHtml, substitutions, substitutionsHtml };
  }

  global.PortalNutritionPlanRenderer = { escapeHtml, formatStructuredItem, normalizeMealLines, getMealPrimaryContent, getMealPrimaryLines, getMealSubstitutions, renderLines, renderMealContent };
}(window));
