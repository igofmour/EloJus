(function (root, factory) {
  const catalog = factory();
  if (typeof module === 'object' && module.exports) module.exports = catalog;
  else root.EloPlans = catalog;
})(typeof window === 'undefined' ? globalThis : window, () => {
  'use strict';
  // Display only: saving a preference does not activate billing or grant seats.
  // Retain the existing database code; do not silently migrate legacy choices.
  const current = Object.freeze({
    code: 'equipe', name: 'Equipe',
    description: 'Um plano para organizar a elaboração e a revisão de peças em conjunto.',
    monthlyCents: 12900, includedPeople: 3, extraPersonCents: 1900,
    orientationMinutes: 30,
    paymentUrl: null // Configure a provider-approved HTTPS checkout URL when ready.
  });
  const money = cents => new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', maximumFractionDigits: 0
  }).format(cents / 100);
  function monthlyTotal(people) {
    if (!Number.isSafeInteger(people) || people < 1) throw new RangeError('invalid_people');
    const total = current.monthlyCents + Math.max(0, people - current.includedPeople) * current.extraPersonCents;
    if (!Number.isSafeInteger(total)) throw new RangeError('invalid_people');
    return total;
  }
  function paymentUrl(value = current.paymentUrl) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
    } catch { return null; }
  }
  function fill(document) {
    const labels = {
      name: current.name, description: current.description,
      price: money(current.monthlyCents), monthly: money(current.monthlyCents) + '/mês',
      included: 'Até ' + current.includedPeople + ' pessoas',
      extra: money(current.extraPersonCents) + ' por pessoa adicional/mês',
      orientation: 'Orientação inicial de até ' + current.orientationMinutes + ' minutos'
    };
    document.querySelectorAll('[data-plan-text]').forEach(node => {
      if (Object.hasOwn(labels, node.dataset.planText)) node.textContent = labels[node.dataset.planText];
    });
    document.querySelectorAll('[data-plan-people]').forEach(node => {
      node.textContent = money(monthlyTotal(Number(node.dataset.planPeople))) + '/mês';
    });
  }
  return Object.freeze({ current, money, monthlyTotal, paymentUrl, fill });
});
