// ============================================================
// LH Weekly Review — Core Logic
// ============================================================

const STORAGE_KEY = 'lh-weekly-review-v1';

// ---------- ISO Week utilities ----------

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNum };
}

function getWeekKey(date = new Date()) {
  const { year, week } = getISOWeek(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function getWeekDateRange(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: monday, end: sunday };
}

function formatDateShort(date) {
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
}

function formatDateFull(date) {
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ---------- Storage ----------

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load data:', e);
    return {};
  }
}

function saveAll(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('Failed to save:', e);
    showToast('Не удалось сохранить', true);
    return false;
  }
}

function getWeek(weekKey) {
  const all = loadAll();
  return all[weekKey] || { retro: null, plan: null };
}

function saveRetro(weekKey, data) {
  const all = loadAll();
  if (!all[weekKey]) all[weekKey] = { retro: null, plan: null };
  all[weekKey].retro = { ...data, updatedAt: new Date().toISOString() };
  return saveAll(all);
}

function savePlan(weekKey, data) {
  const all = loadAll();
  if (!all[weekKey]) all[weekKey] = { retro: null, plan: null };
  all[weekKey].plan = { ...data, updatedAt: new Date().toISOString() };
  return saveAll(all);
}

function deleteWeek(weekKey) {
  const all = loadAll();
  delete all[weekKey];
  return saveAll(all);
}

// ---------- UI helpers ----------

function showToast(message, isError = false) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('visible'), 2500);
}

function debounce(fn, ms = 600) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ---------- Form wiring ----------

function initFormAutoSave(formEl, weekKey, type) {
  const fields = formEl.querySelectorAll('[data-field]');
  const saveFn = type === 'retro' ? saveRetro : savePlan;
  const indicator = document.querySelector('.save-indicator');

  function collect() {
    const data = {};
    fields.forEach(el => {
      const name = el.dataset.field;
      if (el.type === 'number') {
        data[name] = el.value ? Number(el.value) : null;
      } else {
        data[name] = el.value || '';
      }
    });
    // Scale values from buttons
    formEl.querySelectorAll('.scale-input').forEach(group => {
      const name = group.dataset.field;
      const selected = group.querySelector('.scale-btn.selected');
      data[name] = selected ? Number(selected.dataset.value) : null;
    });
    return data;
  }

  const existing = getWeek(weekKey)[type];
  if (existing) {
    fields.forEach(el => {
      const name = el.dataset.field;
      if (existing[name] !== undefined && existing[name] !== null) {
        el.value = existing[name];
      }
    });
    formEl.querySelectorAll('.scale-input').forEach(group => {
      const name = group.dataset.field;
      const val = existing[name];
      if (val !== undefined && val !== null) {
        const btn = group.querySelector(`.scale-btn[data-value="${val}"]`);
        if (btn) btn.classList.add('selected');
      }
    });
    updateStatusBadge(true);
  }

  const doSave = debounce(() => {
    const data = collect();
    const hasContent = Object.values(data).some(v => v !== '' && v !== null && v !== undefined);
    if (!hasContent) return;
    if (saveFn(weekKey, data)) {
      if (indicator) {
        indicator.textContent = 'Сохранено ' + new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        indicator.classList.add('visible');
      }
      updateStatusBadge(true);
    }
  }, 500);

  fields.forEach(el => {
    el.addEventListener('input', doSave);
  });

  formEl.querySelectorAll('.scale-input').forEach(group => {
    group.querySelectorAll('.scale-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        doSave();
      });
    });
  });
}

function updateStatusBadge(saved) {
  const badge = document.querySelector('.status-badge');
  if (!badge) return;
  if (saved) {
    badge.textContent = 'Сохранено';
    badge.classList.remove('draft');
    badge.classList.add('saved');
  } else {
    badge.textContent = 'Черновик';
    badge.classList.remove('saved');
    badge.classList.add('draft');
  }
}

// ---------- Export ----------

function retroToMarkdown(weekKey, data) {
  const { start, end } = weekKeyToRange(weekKey);
  const lines = [];
  lines.push(`# Ретроспектива ${weekKey}`);
  lines.push(`_${formatDateFull(start)} — ${formatDateFull(end)}_`);
  lines.push('');

  lines.push('## Блок 1. Реальность недели');
  lines.push('');
  lines.push('**1. Принятые решения, меняющие компанию:**');
  lines.push(data.r1_decisions || '_(не заполнено)_');
  lines.push('');
  lines.push('**2. Движение стратегических проектов:**');
  lines.push(data.r2_strategic || '_(не заполнено)_');
  lines.push('');
  lines.push('**3. Часы в maker-режиме:** ' + (data.r3_maker_hours ?? '—'));
  lines.push('');

  lines.push('## Блок 2. Зоны имитации');
  lines.push('');
  lines.push('**4. Встречи → решения:**');
  lines.push(data.r4_meetings || '_(не заполнено)_');
  lines.push('');
  lines.push('**5. Системы vs решения на них:**');
  lines.push(data.r5_systems || '_(не заполнено)_');
  lines.push('');
  lines.push('**6. Где подменял команду:**');
  lines.push(data.r6_team || '_(не заполнено)_');
  lines.push('');

  lines.push('## Блок 3. Честная оценка');
  lines.push('');
  lines.push('**7. Реальность vs имитация (1–10):** ' + (data.r7_score ?? '—'));
  lines.push('');
  lines.push('**8. Что НЕ буду делать на следующей неделе:**');
  lines.push(data.r8_not_doing || '_(не заполнено)_');
  lines.push('');

  return lines.join('\n');
}

function planToMarkdown(weekKey, data) {
  const { start, end } = weekKeyToRange(weekKey);
  const lines = [];
  lines.push(`# План недели ${weekKey}`);
  lines.push(`_${formatDateFull(start)} — ${formatDateFull(end)}_`);
  lines.push('');

  lines.push('## Блок 1. Главный результат');
  lines.push('');
  lines.push('**9. Главный результат недели:**');
  lines.push(data.p1_main_outcome || '_(не заполнено)_');
  lines.push('');
  lines.push('**10. Второй результат (если останется время):**');
  lines.push(data.p2_second_outcome || '_(не заполнено)_');
  lines.push('');

  lines.push('## Блок 2. Защита времени');
  lines.push('');
  lines.push('**11. Maker-блоки в календаре (когда и сколько):**');
  lines.push(data.p3_maker_blocks || '_(не заполнено)_');
  lines.push('');
  lines.push('**12. Встречи на отмену/сокращение/делегирование:**');
  lines.push(data.p4_meetings_cut || '_(не заполнено)_');
  lines.push('');

  lines.push('## Блок 3. Проактивность');
  lines.push('');
  lines.push('**13. Проактивное действие недели:**');
  lines.push(data.p5_proactive || '_(не заполнено)_');
  lines.push('');
  lines.push('**14. Откладываемый неудобный разговор/решение:**');
  lines.push(data.p6_postponed || '_(не заполнено)_');
  lines.push('');

  return lines.join('\n');
}

function weekKeyToRange(weekKey) {
  // weekKey format: "2026-W15"
  const [yearStr, wStr] = weekKey.split('-W');
  const year = Number(yearStr);
  const week = Number(wStr);
  // Jan 4 is always in week 1 per ISO 8601
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  const start = new Date(week1Monday);
  start.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start, end };
}

function downloadText(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportWeekMarkdown(weekKey) {
  const week = getWeek(weekKey);
  let md = '';
  if (week.retro) md += retroToMarkdown(weekKey, week.retro) + '\n\n';
  if (week.plan) md += planToMarkdown(weekKey, week.plan) + '\n';
  if (!md) {
    showToast('Нет данных для экспорта', true);
    return;
  }
  downloadText(`review-${weekKey}.md`, md, 'text/markdown');
  showToast('Markdown скачан');
}

function exportAllJSON() {
  const all = loadAll();
  if (!Object.keys(all).length) {
    showToast('Нет данных для экспорта', true);
    return;
  }
  downloadText('lh-review-backup-' + getWeekKey() + '.json', JSON.stringify(all, null, 2), 'application/json');
  showToast('JSON backup скачан');
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      const current = loadAll();
      const merged = { ...current, ...data };
      saveAll(merged);
      showToast('Импортировано ' + Object.keys(data).length + ' недель');
      setTimeout(() => location.reload(), 800);
    } catch (err) {
      showToast('Ошибка импорта: ' + err.message, true);
    }
  };
  reader.readAsText(file);
}
