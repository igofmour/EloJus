(async () => {
  'use strict';
  const A = window.EloAuth, O = window.EloOffice, P = window.EloPlans;
  P.fill(document);
  const $ = id => document.getElementById(id);
  const loginAction = { href:'login.html?reason=session&next=%23contratacao', label:'Entrar para continuar' };
  const sessionError = error => ['session_missing','session_not_found','refresh_token_not_found','refresh_token_already_used','bad_jwt'].includes(error?.code) || error?.name === 'AuthSessionMissingError' || error?.status === 401;
  let user = null, epoch = 0;

  function clearSummary() {
    $('contractSummary').hidden = true;
    $('paymentLink').hidden = true; $('paymentLink').removeAttribute('href');
    $('paymentUnavailable').hidden = false;
    document.querySelectorAll('[data-office-detail]').forEach(element => { element.textContent = ''; });
    ['officeStep', 'planStep'].forEach((id, i) => {
      $(id).classList.remove('completed');
      $(id).querySelector('span').textContent = '0' + (i + 1);
    });
  }
  function gate(message, action = null, error = '') {
    clearSummary();
    $('accountGate').hidden = false;
    $('gateMessage').textContent = message;
    $('gateError').textContent = error; $('gateError').hidden = !error;
    $('gateAction').hidden = !action;
    if (action) { $('gateAction').href = action.href; $('gateAction').textContent = action.label + ' →'; }
    $('retryLoad').hidden = !error;
  }
  function clearAccount() {
    ++epoch; user = null;
    $('accountLink').href = loginAction.href; $('accountLink').textContent = 'Entrar ↗';
    gate('Entre com a conta responsável para conferir o resumo do escritório.', loginAction);
  }
  async function initialize() {
    const request = ++epoch;
    $('retryLoad').disabled = true;
    try {
      const result = await O.load();
      if (request !== epoch) return;
      user = result.user;
      $('accountLink').href = 'index.html#inicio'; $('accountLink').textContent = 'Meu ambiente ↗';
      const office = result.office;
      if (!office) {
        gate('Cadastre seu escritório para preparar o resumo da contratação.', {href:'cadastro-escritorio.html', label:'Cadastrar escritório'});
        return;
      }
      const plan = P.find(office.plan_code);
      if (!plan || !office.plan_selected_at) {
        gate('Escolha e salve um plano para conferir o resumo da contratação.', {href:'planos.html', label:'Escolher plano'});
        return;
      }
      $('summaryOffice').textContent = office.name;
      $('summaryResponsible').textContent = office.responsible_name;
      $('summaryOab').textContent = office.oab_number + ' / ' + office.oab_state;
      $('summaryEmail').textContent = office.responsible_email;
      $('summaryPhone').textContent = office.phone || 'Não informado';
      $('summaryPlan').textContent = plan.name;
      $('summaryPlanDescription').textContent = plan.description;
      P.fill($('contractSummary'), plan.code);
      const checkout = P.paymentUrl(plan.code);
      $('paymentLink').hidden = !checkout;
      $('paymentUnavailable').hidden = !!checkout;
      if (checkout) $('paymentLink').href = checkout;
      $('availabilityNote').textContent = checkout ? 'Confira a quantidade de acessos, o total e as condições no pagamento. Abrir o link não ativa sua assinatura na EloJus.' : 'A contratação ainda não está disponível. Nenhum pagamento será solicitado nesta etapa.';
      ['officeStep', 'planStep'].forEach(id => {
        $(id).classList.add('completed'); $(id).querySelector('span').textContent = '✓';
      });
      $('accountGate').hidden = true; $('contractSummary').hidden = false;
    } catch (error) {
      if (request !== epoch) return;
      if (sessionError(error)) clearAccount();
      else gate('Não foi possível carregar o resumo agora.', null, 'Confira sua conexão e tente novamente.');
    } finally { if (request === epoch) $('retryLoad').disabled = false; }
  }
  $('retryLoad').addEventListener('click', initialize);
  window.addEventListener('elo-auth-change', event => {
    if (event.detail.event === 'SIGNED_OUT' || (user && event.detail.userId && event.detail.userId !== user.id)) clearAccount();
  });
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
  // Reopening the tab re-reads the saved choice, including changes in another tab.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { gate('Atualizando o resumo do escritório…'); initialize(); }
  });
  await initialize();
})();
