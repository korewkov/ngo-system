(function () {
  const DEFAULT_CONFIG = {
    supabaseUrl: '',
    supabaseAnonKey: '',
    aiEndpoint: '/api/generate'
  };

  const config = { ...DEFAULT_CONFIG, ...(window.NGO_CONFIG || {}) };

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function qsa(selector, root = document) {
    return [...root.querySelectorAll(selector)];
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

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
    return value;
  }

  function uid(prefix = 'ngo') {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function notify(message, selector = '#toast', timeout = 2400) {
    const node = qs(selector);
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
    window.clearTimeout(node.dataset.ngoTimer);
    node.dataset.ngoTimer = window.setTimeout(() => node.classList.remove('show'), timeout);
  }

  function downloadFile(filename, content, type = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function copyText(text, successMessage = 'Скопировано.') {
    await navigator.clipboard.writeText(text);
    notify(successMessage);
  }

  function requireSupabaseConfig() {
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      throw new Error('Supabase не настроен: добавь supabaseUrl и supabaseAnonKey в window.NGO_CONFIG.');
    }
  }

  async function supabaseFetch(path, options = {}) {
    requireSupabaseConfig();
    const url = `${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/${path.replace(/^\//, '')}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...(options.headers || {})
      }
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new Error(data?.message || data?.error || `Supabase HTTP ${response.status}`);
    }
    return data;
  }

  const supabase = {
    select(table, query = 'select=*') {
      return supabaseFetch(`${encodeURIComponent(table)}?${query}`);
    },
    insert(table, row) {
      return supabaseFetch(encodeURIComponent(table), {
        method: 'POST',
        body: JSON.stringify(row)
      });
    },
    upsert(table, row, conflictKey = 'id') {
      return supabaseFetch(`${encodeURIComponent(table)}?on_conflict=${encodeURIComponent(conflictKey)}`, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(row)
      });
    },
    remove(table, id, idColumn = 'id') {
      return supabaseFetch(`${encodeURIComponent(table)}?${encodeURIComponent(idColumn)}=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
    }
  };

  async function generateText(payload) {
    const response = await fetch(config.aiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `AI HTTP ${response.status}`);
    }
    return data;
  }

  window.NgoCore = {
    config,
    qs,
    qsa,
    escapeHtml,
    readJson,
    writeJson,
    uid,
    notify,
    downloadFile,
    copyText,
    supabase,
    ai: { generateText }
  };

  window.NGO = window.NgoCore;
  document.documentElement.dataset.ngoCore = 'ready';
})();
