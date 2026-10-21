(function (root, factory) {
  const catalog = factory();
  if (typeof module === 'object' && module.exports) module.exports = catalog;
  else root.EloPlans = catalog;
})(typeof window === 'undefined' ? globalThis : window, () => {
  'use strict';
  // Preferences only: these offers do not activate billing or grant access.
  // Keep legacy "equipe" separate: its R$ 129 offer requires a new confirmation.
  const includedPeople = 3, extraPersonMonthlyCents = 1900;
  const monthly = Object.freeze({
    code: 'equipe_mensal', name: 'Equipe mensal', months: 1, chargeCents: 14990,
    description: 'Flexibilidade para começar e acompanhar a rotina da sua equipe.',
    conditions: 'Pagamento mensal · sem fidelidade anual · sem taxa obrigatória de implantação',
    benefits: Object.freeze(['Orientação inicial de até 30 minutos', 'Contratação mensal, sem fidelidade anual', 'Suporte habitual e todos os recursos do plano Equipe']),
    paymentUrl: null
  });
  const annual = Object.freeze({
    code: 'equipe_anual', name: 'Equipe anual', months: 12, chargeCents: 155880,
    description: 'Economia e acompanhamento para organizar o primeiro ano de uso.',
    conditions: 'Pagamento antecipado para 12 meses · preço-base garantido no período · sem taxa obrigatória de implantação',
    benefits: Object.freeze([
      'Implantação guiada de até 60 minutos para organizar a equipe e o primeiro fluxo',
      'Uma reunião de acompanhamento de até 30 minutos, entre o 30º e o 45º dia',
      'Checklist de elaboração e revisão adaptado durante a implantação',
      'Preço-base garantido durante os 12 meses contratados',
      'Suporte habitual e todos os recursos do plano Equipe'
    ]),
    paymentUrl: null
  });
  const options = Object.freeze([monthly, annual]);
  const find = code => options.find(plan => plan.code === code) || null;
  const money = cents => new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format(cents / 100);
  function total(code, people = includedPeople) {
    const plan = find(code);
    if (!plan) throw new RangeError('invalid_plan');
    if (!Number.isSafeInteger(people) || people < 1) throw new RangeError('invalid_people');
    const value = plan.chargeCents + Math.max(0, people - includedPeople) * extraPersonMonthlyCents * plan.months;
    if (!Number.isSafeInteger(value)) throw new RangeError('invalid_people');
    return value;
  }
  const savingCents = monthly.chargeCents * 12 - annual.chargeCents;
  const discount = new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 2}).format(savingCents / (monthly.chargeCents * 12) * 100);
  function labels(code) {
    const plan = find(code);
    if (!plan) throw new RangeError('invalid_plan');
    const yearly = plan.months === 12;
    return {
      name: plan.name, description: plan.description,
      price: money(plan.chargeCents), charge: money(plan.chargeCents) + (yearly ? '/ano' : '/mês'),
      included: 'Até ' + includedPeople + ' pessoas',
      equivalent: yearly ? 'Equivalente a ' + money(plan.chargeCents / 12) + '/mês. Pagamento antecipado para 12 meses.' : 'Pagamento mês a mês, sem fidelidade anual.',
      extra: yearly ? money(extraPersonMonthlyCents * 12) + ' por pessoa/ano (' + money(extraPersonMonthlyCents) + '/mês)' : money(extraPersonMonthlyCents) + ' por pessoa adicional/mês',
      conditions: plan.conditions,
      billing: yearly ? 'Anual · pagamento antecipado' : 'Mensal',
      savings: 'Economize ' + money(savingCents) + ' por ano (' + discount + '%)',
      terms: (yearly ? 'Contratação de 12 meses, com pagamento antecipado e preço-base garantido no período. ' : 'Contratação mensal, sem fidelidade anual. ') + 'Sem taxa obrigatória de implantação. A quantidade de acessos, o total e as regras de renovação, cancelamento e eventual reembolso serão apresentados antes da contratação.'
    };
  }
  function paymentUrl(code) {
    return safePaymentUrl(find(code)?.paymentUrl);
  }
  function safePaymentUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
    } catch { return null; }
  }
  function fill(root, code = monthly.code) {
    root.querySelectorAll('[data-plan-text]').forEach(node => {
      const values = labels(node.closest('[data-plan-code]')?.dataset.planCode || code);
      if (Object.hasOwn(values, node.dataset.planText)) node.textContent = values[node.dataset.planText];
    });
    root.querySelectorAll('[data-plan-benefits]').forEach(node => {
      const plan = find(node.closest('[data-plan-code]')?.dataset.planCode || code);
      node.replaceChildren(...plan.benefits.map(benefit => {
        const item = node.ownerDocument.createElement(node.tagName === 'UL' ? 'li' : 'span');
        if (node.tagName !== 'UL') item.setAttribute('role', 'listitem');
        item.textContent = benefit;
        return item;
      }));
    });
  }
  return Object.freeze({options, monthly, annual, includedPeople, extraPersonMonthlyCents, savingCents, find, money, total, labels, paymentUrl, safePaymentUrl, fill});
});
