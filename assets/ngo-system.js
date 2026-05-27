(function () {
  const STORAGE = {
    events: 'gornEventsData',
    budgets: 'smetaGornaData',
    summary: 'ngoSystemSummary',
    activeEventId: 'ngoActiveEventId'
  };

  const SERVICES = [
    { id: 'pulse', title: 'Пульс НГО', file: 'pulse.html', short: 'Пульс' },
    { id: 'events', title: 'Горн событий', file: 'events.html', short: 'События' },
    { id: 'budget', title: 'Смета Горна', file: 'budget.html', short: 'Смета' },
    { id: 'voice', title: 'Голос НГО', file: 'voice.html', short: 'Голос' },
    { id: 'partners', title: 'Партнерский Горн', file: 'partners.html', short: 'Партнеры' },
    { id: 'sos', title: 'Штабной аварийник', file: 'emergency.html', short: 'SOS' },
    { id: 'letters', title: 'Письменный горн', file: 'letters.html', short: 'Письма' }
  ];

  const MODES = ['minimum', 'normal', 'wow'];

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.warn(`НГО: не удалось прочитать ${key}`, error);
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getEvents() {
    return readJson(STORAGE.events, []);
  }

  function getBudgets() {
    return readJson(STORAGE.budgets, []);
  }

  function uid(prefix) {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function sameEventBudget(event, budget) {
    if (budget.sourceEventId && event.id) return budget.sourceEventId === event.id;
    return normalizeText(budget.name) === normalizeText(event.name) && normalizeText(budget.date) === normalizeText(event.date);
  }

  function expensesFromEvent(event) {
    const count = Number(event.participants || 1) || 1;
    const hasMedia = (event.blocks || []).some(block => /медиа|фото|видео/i.test(`${block.type} ${block.title} ${block.comment}`));
    const hasAwards = (event.blocks || []).some(block => /награждение|приз|диплом/i.test(`${block.type} ${block.title} ${block.comment}`));
    const expenses = [
      { name: 'Печать программы и навигации', category: 'печать', qty: count, price: 45, payer: 'штаб', comment: `Автозаготовка из события «${event.name}».` },
      { name: 'Вода и расходники для участников', category: 'расходники', qty: count, price: 80, payer: 'участники', comment: 'Базовая строка для первичного расчета.' },
      { name: 'Оформление площадки', category: 'оформление', qty: 1, price: 12000, payer: 'штаб', comment: event.place ? `Площадка: ${event.place}` : 'Уточнить после выбора площадки.' }
    ];
    if (hasAwards) expenses.push({ name: 'Призы, дипломы и благодарности', category: 'призы', qty: 1, price: 18000, payer: 'партнёр', comment: 'Добавлено из блока награждения.' });
    if (hasMedia) expenses.push({ name: 'Фото/видео и быстрый контент', category: 'фото/видео', qty: 1, price: 15000, payer: 'смешанно', comment: 'Добавлено из медиа-блока программы.' });
    return expenses.map(expense => ({ ...expense, id: uid('expense') }));
  }

  function budgetFromEvent(event) {
    const expenses = expensesFromEvent(event);
    return {
      id: uid('budget'),
      sourceEventId: event.id || '',
      name: event.name || 'Смета события',
      date: event.date || '',
      place: event.place || '',
      participants: Number(event.participants || 150),
      minParticipants: Math.max(20, Math.floor(Number(event.participants || 150) * 0.75)),
      maxCapacity: Math.max(Number(event.participants || 150), Math.ceil(Number(event.participants || 150) * 1.25)),
      hqBudget: 0,
      partnerSupport: 0,
      reservePercent: 10,
      comment: `Создано автоматически из «Горна событий». Цель: ${event.goal || 'уточнить цель события.'}`,
      activeMode: 'normal',
      modes: MODES.reduce((acc, mode) => {
        const multiplier = mode === 'minimum' ? 0.82 : mode === 'wow' ? 1.22 : 1;
        acc[mode] = {
          expenses: expenses.map(expense => ({
            ...expense,
            id: uid('expense'),
            price: Math.round(Number(expense.price || 0) * multiplier)
          }))
        };
        return acc;
      }, {}),
      createdAt: new Date().toISOString(),
      order: 0
    };
  }

  function updateBudgetFromEvent(budget, event) {
    budget.sourceEventId = event.id || budget.sourceEventId || '';
    budget.name = event.name || budget.name;
    budget.date = event.date || budget.date || '';
    budget.place = event.place || budget.place || '';
    budget.participants = Number(event.participants || budget.participants || 150);
    budget.minParticipants = Math.max(20, Math.floor(Number(budget.participants || 150) * 0.75));
    budget.maxCapacity = Math.max(Number(budget.maxCapacity || 0), Math.ceil(Number(budget.participants || 150) * 1.25));
    if (!budget.comment || /^Создано автоматически из/.test(budget.comment)) {
      budget.comment = `Синхронизировано с «Горном событий». Цель: ${event.goal || 'уточнить цель события.'}`;
    }
    return budget;
  }

  function mergeBudgetsWithEvents(budgets, eventsInput) {
    const events = Array.isArray(eventsInput) ? eventsInput : readJson(STORAGE.events, []);
    const result = Array.isArray(budgets) ? budgets.map(budget => ({ ...budget })) : [];
    events.forEach(event => {
      if (!event || !event.name) return;
      const existing = result.find(budget => sameEventBudget(event, budget));
      if (existing) updateBudgetFromEvent(existing, event);
      else result.unshift(budgetFromEvent(event));
    });
    result.forEach((budget, index) => { budget.order = budget.order ?? index; });
    return result;
  }

  function getActiveEvent(eventsInput) {
    const events = Array.isArray(eventsInput) ? eventsInput : getEvents();
    if (!events.length) return null;
    const activeId = localStorage.getItem(STORAGE.activeEventId);
    return events.find(event => event.id === activeId) || events[0] || null;
  }

  function setActiveEvent(id) {
    if (id) localStorage.setItem(STORAGE.activeEventId, id);
    else localStorage.removeItem(STORAGE.activeEventId);
    updateSummary();
    refreshContextShell();
  }

  function ensureActiveEvent(events) {
    const items = Array.isArray(events) ? events : getEvents();
    const active = getActiveEvent(items);
    if (active?.id) localStorage.setItem(STORAGE.activeEventId, active.id);
    return active;
  }

  function syncActiveEventFromUrl() {
    const id = new URLSearchParams(location.search).get('event');
    if (id && getEvents().some(event => event.id === id)) {
      localStorage.setItem(STORAGE.activeEventId, id);
    }
  }

  function publishEvents(events) {
    writeJson(STORAGE.events, events);
    ensureActiveEvent(events);
    const budgets = mergeBudgetsWithEvents(readJson(STORAGE.budgets, []), events);
    writeJson(STORAGE.budgets, budgets);
    updateSummary({ events, budgets });
    refreshContextShell();
  }

  function publishBudgets(budgets) {
    writeJson(STORAGE.budgets, budgets);
    updateSummary({ events: readJson(STORAGE.events, []), budgets });
    refreshContextShell();
  }

  function budgetForEvent(event, budgetsInput) {
    if (!event) return null;
    const budgets = Array.isArray(budgetsInput) ? budgetsInput : getBudgets();
    return budgets.find(budget => sameEventBudget(event, budget)) || null;
  }

  function eventCompletion(event) {
    if (!event) return { done: 0, total: 5, missing: ['создать событие'] };
    const checks = [
      ['название', Boolean(event.name)],
      ['дата', Boolean(event.date)],
      ['место', Boolean(event.place)],
      ['участники', Boolean(event.participants)],
      ['смысл', Boolean(event.meaning || event.goal)],
      ['программа', Boolean((event.blocks || []).length)]
    ];
    const missing = checks.filter(([, ok]) => !ok).map(([title]) => title);
    return { done: checks.length - missing.length, total: checks.length, missing };
  }

  function dutyState() {
    const events = getEvents();
    const budgets = getBudgets();
    const activeEvent = getActiveEvent(events);
    const activeBudget = budgetForEvent(activeEvent, budgets);
    const completion = eventCompletion(activeEvent);
    const nextEvent = events
      .filter(event => event.date)
      .sort((a, b) => a.date.localeCompare(b.date))[0] || null;
    return {
      events,
      budgets,
      activeEvent,
      activeBudget,
      completion,
      nextEvent,
      actions: [
        activeEvent ? `Активное событие: ${activeEvent.name}` : 'Создать первое событие',
        activeBudget ? 'Смета связана' : 'Нужна смета',
        completion.missing.length ? `Заполнить: ${completion.missing.slice(0, 3).join(', ')}` : 'Карточка события заполнена'
      ]
    };
  }

  function updateSummary(data) {
    const events = data?.events || readJson(STORAGE.events, []);
    const budgets = data?.budgets || readJson(STORAGE.budgets, []);
    writeJson(STORAGE.summary, {
      updatedAt: new Date().toISOString(),
      services: SERVICES.length,
      events: events.length,
      budgets: budgets.length,
      activeEvent: getActiveEvent(events),
      nextEvent: events.filter(event => event.date).sort((a, b) => a.date.localeCompare(b.date))[0] || null
    });
  }

  function eventParam() {
    const active = getActiveEvent();
    return active?.id ? `?event=${encodeURIComponent(active.id)}` : '';
  }

  function serviceUrl(file) {
    const active = getActiveEvent();
    if (!active?.id) return file;
    return `${file}?event=${encodeURIComponent(active.id)}`;
  }

  function contextHtml() {
    const active = getActiveEvent();
    if (!active) {
      return `
        <div class="ngo-context-title">событие не выбрано</div>
        <div class="ngo-context-meta">Создай мероприятие в Горне событий, и оно станет общим контекстом для сметы, текстов, партнёров и писем.</div>
        <div class="ngo-context-actions"><a href="${SERVICES[1].file}">создать событие</a></div>
      `;
    }
    const budget = budgetForEvent(active);
    const completion = eventCompletion(active);
    return `
      <div>
        <div class="ngo-context-title">${escapeHtml(active.name || 'Событие НГО')}</div>
        <div class="ngo-context-meta">
          ${active.date ? escapeHtml(active.date) : 'дата не указана'} ·
          ${active.place ? escapeHtml(active.place) : 'место не указано'} ·
          ${active.participants ? `${escapeHtml(active.participants)} участников` : 'участники не указаны'} ·
          ${completion.done}/${completion.total} заполнено
        </div>
      </div>
      <div class="ngo-context-actions">
        <a href="${serviceUrl(SERVICES[1].file)}">событие</a>
        <a href="${serviceUrl(SERVICES[2].file)}">${budget ? 'смета' : 'создать смету'}</a>
        <a href="${serviceUrl(SERVICES[3].file)}">тексты</a>
        <a href="${serviceUrl(SERVICES[6].file)}">письмо</a>
      </div>
    `;
  }

  function refreshContextShell() {
    const node = document.querySelector('.ngo-event-context');
    if (node) node.innerHTML = contextHtml();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function injectShell() {
    syncActiveEventFromUrl();
    const current = decodeURIComponent(location.pathname.split('/').pop() || 'index.html');
    if (current === 'index.html' || document.querySelector('.ngo-system-rail')) return;
    const style = document.createElement('style');
    style.textContent = `
      .ngo-event-context{position:fixed;left:14px;right:14px;top:10px;z-index:9998;display:flex;justify-content:space-between;gap:12px;align-items:center;padding:9px 10px;border:2px solid #111;background:rgba(248,244,236,.94);backdrop-filter:blur(14px);box-shadow:5px 5px 0 rgba(17,17,17,.16);font-family:Inter,Arial,sans-serif;color:#111}
      .ngo-context-title{font-size:12px;font-weight:1000;text-transform:uppercase;letter-spacing:.06em;line-height:1}
      .ngo-context-meta{margin-top:4px;font-size:11px;font-weight:800;color:rgba(17,17,17,.66);line-height:1.2}
      .ngo-context-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
      .ngo-context-actions a{border:2px solid #111;background:#fff;color:#111;padding:7px 9px;text-decoration:none;text-transform:uppercase;font-size:9px;font-weight:950;letter-spacing:.06em}
      .ngo-context-actions a:first-child{background:#FF3B2F;color:#fff}
      .ngo-context-actions a:hover{transform:translate(-1px,-1px);box-shadow:3px 3px 0 #111}
      body.ngo-system-context-ready{padding-top:58px}
      .ngo-system-rail{position:fixed;right:14px;bottom:14px;z-index:9999;display:flex;gap:8px;align-items:center;max-width:calc(100vw - 28px);padding:8px;border:2px solid #111;background:rgba(248,244,236,.92);backdrop-filter:blur(14px);box-shadow:5px 5px 0 rgba(17,17,17,.18);font-family:Inter,Arial,sans-serif}
      .ngo-system-rail a{border:2px solid #111;background:#fff;color:#111;padding:8px 10px;text-decoration:none;text-transform:uppercase;font-size:10px;font-weight:950;letter-spacing:.06em}
      .ngo-system-rail a:first-child{background:#FF3B2F;color:#fff}
      .ngo-system-rail a:hover{transform:translate(-1px,-1px);box-shadow:3px 3px 0 #111}
      @media(max-width:720px){body.ngo-system-context-ready{padding-top:118px}.ngo-event-context{display:grid;top:8px;left:9px;right:9px}.ngo-context-actions{justify-content:start}.ngo-system-rail{left:9px;right:9px;bottom:9px;overflow-x:auto}.ngo-system-rail a{white-space:nowrap}}
      @media print{.ngo-event-context,.ngo-system-rail{display:none!important}}
    `;
    const context = document.createElement('section');
    context.className = 'ngo-event-context';
    context.setAttribute('aria-label', 'Текущее событие системы НГО');
    context.innerHTML = contextHtml();
    const rail = document.createElement('nav');
    rail.className = 'ngo-system-rail';
    rail.setAttribute('aria-label', 'Навигация системы НГО');
    rail.innerHTML = `<a href="index.html">Пульт</a>` + SERVICES
      .filter(service => service.file !== current)
      .slice(0, 4)
      .map(service => `<a href="${serviceUrl(service.file)}">${service.short}</a>`)
      .join('');
    document.head.appendChild(style);
    document.body.classList.add('ngo-system-context-ready');
    document.body.appendChild(context);
    document.body.appendChild(rail);
  }

  window.NgoSystem = {
    SERVICES,
    STORAGE,
    getEvents,
    getBudgets,
    getActiveEvent,
    setActiveEvent,
    syncActiveEventFromUrl,
    readJson,
    writeJson,
    budgetForEvent,
    dutyState,
    serviceUrl,
    mergeBudgetsWithEvents,
    publishEvents,
    publishBudgets,
    updateSummary
  };

  document.addEventListener('DOMContentLoaded', injectShell);
})();
