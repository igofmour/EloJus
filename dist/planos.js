(async () => {
  'use strict';
  const A = window.EloAuth, O = window.EloOffice;
  const $ = id => document.getElementById(id);
  const form = $('planForm');
  const radios = Array.from(form.querySelectorAll('input[name="plan"]'));
  const catalog = new Map(radios.map(input => [input.value, {
    input,
    name: $(input.getAttribute('aria-labelledby')).textContent,
    description: $(input.getAttribute('aria-describedby').split(' ')[0]).textContent
  }]));
  let user = null, office = null, epoch = 0, saving = false;
  const sessionError = error => ['session_missing','session_not_found','refresh_token_not_found','refresh_token_already_used','bad_jwt'].includes(error?.code) || error?.name === 'AuthSessionMissingError' || error?.status === 401;

  function selection() {
    return catalog.get(form.querySelector('input[name="plan"]:checked')?.value);
  }
  function updateChoice() {
    const plan = selection();
    $('selectedPlan').textContent = plan ? 'Plano ' + plan.name : 'Nenhum plano selecionado';
    $('selectionHint').textContent = plan ? (plan.input.value === office?.plan_code ? 'Escolha salva · sem cobrança' : 'Valor a definir · escolha ainda não salva') : 'Selecione uma das opções acima para continuar.';
    $('planError').hidden = true;
    catalog.forEach(item => {
      item.input.removeAttribute('aria-invalid');
      item.input.closest('label').querySelector('.select-word').textContent = item.input.checked ? 'Selecionado' : 'Selecionar ' + item.name;
    });
  }
  function gate(message, action = null, error = '') {
    $('planChoices').hidden = $('planReview').hidden = $('officeContext').hidden = true;
    $('accountGate').hidden = false;
    $('gateMessage').textContent = message;
    $('gateError').textContent = error;
    $('gateError').hidden = !error;
    $('gateAction').hidden = !action;
    if (action) { $('gateAction').href = action.href; $('gateAction').textContent = action.label + ' →'; }
    $('retryLoad').hidden = false;
  }
  const loginAction = { href: 'login.html?reason=session&next=%23planos', label: 'Entrar para continuar' };
  function setSaving(value) {
    saving = value;
    $('planReview').setAttribute('aria-busy', String(value));
    $('savePlan').disabled = $('changePlan').disabled = value;
    $('savePlan').textContent = value ? 'Salvando escolha…' : 'Salvar escolha';
  }
  function showReview(moveFocus = true) {
    const plan = selection();
    if (!plan || !office) return;
    const saved = plan.input.value === office.plan_code && !!office.plan_selected_at;
    $('reviewName').textContent = plan.name;
    $('reviewDescription').textContent = plan.description;
    $('reviewOffice').textContent = office.name;
    $('reviewResponsible').textContent = office.responsible_name;
    $('reviewTitle').textContent = saved ? 'Escolha salva para o escritório.' : 'Confira sua escolha.';
    $('reviewStatus').textContent = saved ? 'Escolha salva · sem assinatura ativa' : 'Aguardando sua confirmação';
    $('savedMessage').hidden = !saved;
    $('savedMessage').textContent = saved ? 'Plano ' + plan.name + ' salvo para ' + office.name + '. Nenhuma cobrança foi ativada.' : '';
    $('savedAt').hidden = !saved;
    $('savedAt').textContent = saved ? 'Última alteração em ' + new Intl.DateTimeFormat('pt-BR', { dateStyle:'short', timeStyle:'short' }).format(new Date(office.plan_selected_at)) + '.' : '';
    $('saveError').hidden = true;
    $('savePlan').hidden = !!saved;
    $('continueContract').hidden = !saved;
    $('planChoices').hidden = true; $('planReview').hidden = false;
    if (moveFocus) {
      $('reviewTitle').focus();
      $('planReview').scrollIntoView({ behavior:'instant', block:'start' });
    }
  }
  function clearAccount() {
    ++epoch; user = office = null; setSaving(false); form.reset(); updateChoice();
    $('continueContract').hidden = true;
    ['officeName','reviewOffice','reviewResponsible','reviewName','reviewDescription','savedMessage','savedAt','saveError'].forEach(id => { $(id).textContent = ''; });
    $('officeStep').classList.remove('completed');
    $('officeStep').querySelector('span').textContent = '01';
    $('accountLink').href = loginAction.href; $('accountLink').textContent = 'Entrar ↗';
    gate('Entre novamente para consultar os planos do seu escritório.', loginAction);
  }
  async function initialize() {
    const request = ++epoch;
    $('retryLoad').disabled = true;
    try {
      const result = await O.load();
      if (request !== epoch) return;
      user = result.user; office = result.office;
      $('accountLink').href = 'index.html#inicio'; $('accountLink').textContent = 'Meu ambiente ↗';
      if (!office) {
        gate('Cadastre seu escritório para continuar à escolha do plano.', { href: 'cadastro-escritorio.html', label: 'Cadastrar escritório' });
        return;
      }
      $('officeName').textContent = office.name;
      $('officeContext').hidden = false;
      $('officeStep').classList.add('completed');
      $('officeStep').querySelector('span').textContent = '✓';
      $('accountGate').hidden = true;
      $('planChoices').hidden = false;
      form.reset();
      const savedPlan = catalog.get(office.plan_code);
      if (savedPlan) savedPlan.input.checked = true;
      updateChoice();
      if (savedPlan) showReview(false);
    } catch (error) {
      if (request !== epoch) return;
      user = office = null;
      if (sessionError(error)) gate('Entre com a conta responsável para escolher o plano do escritório cadastrado.', loginAction);
      else gate('Não foi possível consultar seu escritório agora.', null, 'Confira sua conexão e tente novamente.');
    } finally { if (request === epoch) $('retryLoad').disabled = false; }
  }
  radios.forEach(input => input.addEventListener('change', updateChoice));
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!user || !office) return;
    const plan = selection();
    if (!plan) {
      $('planError').hidden = false;
      radios.forEach(input => input.setAttribute('aria-invalid', 'true'));
      radios[0].focus();
      return;
    }
    showReview();
  });
  $('savePlan').addEventListener('click', async () => {
    const plan = selection();
    if (saving || !plan || !user || !office) return;
    const request = epoch;
    setSaving(true); $('saveError').hidden = true;
    try {
      const saved = await O.savePlan(plan.input.value, office.id, user.id);
      if (request !== epoch) return;
      office = saved; updateChoice(); showReview();
    } catch (error) {
      if (request !== epoch) return;
      if (sessionError(error) || error?.code === 'account_changed') { clearAccount(); return; }
      $('saveError').textContent = O.planMessage(error);
      $('saveError').hidden = false; $('saveError').focus();
    } finally { if (request === epoch) setSaving(false); }
  });
  $('changePlan').addEventListener('click', () => {
    if (saving) return;
    $('planReview').hidden = true; $('planChoices').hidden = false;
    selection()?.input.focus();
    $('planChoices').scrollIntoView({ behavior:'instant', block:'start' });
  });
  $('retryLoad').addEventListener('click', initialize);
  window.addEventListener('elo-auth-change', event => {
    if (event.detail.event === 'SIGNED_OUT' || (user && event.detail.userId && event.detail.userId !== user.id)) clearAccount();
  });
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden || !user) return;
    const request = epoch;
    try {
      const current = await A.user();
      if (request === epoch && user && user.id !== current.id) clearAccount();
    } catch (error) { if (request === epoch && sessionError(error)) clearAccount(); }
  });
  await initialize();
})();
