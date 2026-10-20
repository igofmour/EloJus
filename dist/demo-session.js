(() => {
  'use strict';
  // Prototype navigation only. This client-side marker is NOT authentication
  // or authorization and must be replaced by a server-validated session.
  const KEY = 'elojus-demo-session-v1';
  const safeRoute = route => /^#(?:inicio|casos|revisoes|caso\/ELO-\d+(?:\/(?:context|history))?)$/.test(route || '') ? route : '#inicio';
  function hasSession() {
    try { const value = JSON.parse(sessionStorage.getItem(KEY)); return value?.mode === 'demo' && value?.userId === 'marina'; }
    catch { return false; }
  }
  function start(profile = {}) {
    try { sessionStorage.setItem(KEY, JSON.stringify({ mode: 'demo', userId: 'marina', name: String(profile.name || 'Marina Exemplo').slice(0, 120) })); return hasSession(); }
    catch { return false; }
  }
  function displayName() {
    try { const value = JSON.parse(sessionStorage.getItem(KEY)); return hasSession() && typeof value.name === 'string' ? value.name.slice(0, 120) : 'Marina Exemplo'; }
    catch { return 'Marina Exemplo'; }
  }
  function end() {
    try { sessionStorage.removeItem(KEY); return !hasSession(); }
    catch { return false; }
  }
  function requireSession() {
    if (hasSession()) { document.documentElement.removeAttribute('data-session-required'); return true; }
    location.replace('login.html?next=' + encodeURIComponent(safeRoute(location.hash)));
    return false;
  }
  window.EloSession = { hasSession, start, end, safeRoute, displayName };
  if (document.documentElement.hasAttribute('data-session-required')) {
    requireSession();
    window.addEventListener('pageshow', requireSession);
  }
})();
