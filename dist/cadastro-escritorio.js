(async () => {
  'use strict';
  const A = window.EloAuth, O = window.EloOffice;
  const form = document.getElementById('officeForm');
  const details = document.getElementById('officeDetails');
  const review = document.getElementById('officeReview');
  const errorSummary = document.getElementById('officeError');
  const controls = Array.from(form.querySelectorAll('input, select'));
  const field = id => document.getElementById(id);
  const value = id => field(id).value.trim();
  let user = null, draft = null, saving = false, epoch = 0;
  const sessionError = error => ['session_missing', 'session_not_found', 'refresh_token_not_found', 'refresh_token_already_used', 'bad_jwt', 'account_changed'].includes(error?.code) || error?.name === 'AuthSessionMissingError' || error?.status === 401;

  function renderSummary(office) {
    field('summaryOffice').textContent = office.name;
    field('summaryName').textContent = office.responsible_name;
    field('summaryEmail').textContent = office.responsible_email;
    field('summaryPhone').textContent = office.phone || 'Não informado';
    field('summaryOab').textContent = office.oab_number + ' / ' + office.oab_state;
  }

  function showSaved(office, existed = false, focus = true) {
    renderSummary(office);
    showReview(true, focus);
    field('stepLabel').textContent = 'Concluído';
    field('reviewTitle').textContent = 'Seu escritório está cadastrado.';
    field('reviewIntro').textContent = existed ? 'Este escritório já está vinculado à sua conta. Os dados abaixo foram recuperados do cadastro salvo.' : 'Dados salvos. O advogado responsável está vinculado à sua conta na EloJus.';
    field('saveNoteIcon').textContent = '✓';
    field('saveNoteTitle').textContent = 'Cadastro confirmado';
    const planNames = { essencial:'Essencial', equipe:'Equipe', personalizado:'Personalizado' };
    const planName = planNames[office.plan_code];
    field('saveNoteText').textContent = planName ? 'Plano ' + planName + ' escolhido e salvo para o escritório. Você pode consultar ou alterar essa preferência. Nenhuma assinatura ou cobrança foi ativada.' : 'O próximo passo é conhecer as opções de plano para o escritório. Você poderá revisar e salvar sua escolha, sem ativar assinatura ou cobrança.';
    field('openWorkspace').textContent = planName ? 'Consultar plano →' : 'Escolher plano →';
    field('saveActions').hidden = true;
    field('saveError').hidden = true;
    field('relogin').hidden = true;
    field('openWorkspace').hidden = false;
    document.title = 'Escritório cadastrado — EloJus';
  }

  function showGate(message, error = '') {
    details.hidden = review.hidden = true;
    field('accountIdentity').hidden = true;
    field('accountGate').hidden = false;
    field('accountMessage').textContent = message;
    field('accountError').textContent = error;
    field('accountError').hidden = !error;
    field('accountActions').hidden = false;
    field('retryAccount').hidden = false;
    field('reviewButton').disabled = true;
    field('accountLink').href = 'login.html?next=%23cadastro-escritorio';
    field('accountLink').textContent = 'Entrar ↗';
  }

  function clearAccount() {
    ++epoch; user = draft = null; form.reset();
    controls.forEach(control => control.removeAttribute('aria-invalid'));
    document.querySelectorAll('.field-error').forEach(node => { node.hidden = true; });
    document.querySelectorAll('.office-summary dd, #summaryOffice, #accountIdentity').forEach(node => { node.textContent = ''; });
    field('officeError').hidden = field('saveError').hidden = true;
    field('saveActions').hidden = false;
    field('relogin').hidden = field('openWorkspace').hidden = true;
    field('reviewTitle').textContent = 'Tudo começa com estes dados.';
    field('reviewIntro').textContent = 'Confira as informações antes de cadastrar seu escritório.';
    field('saveNoteIcon').textContent = '↗';
    field('saveNoteTitle').textContent = 'Um escritório. Sua conta responsável.';
    field('saveNoteText').textContent = 'Ao cadastrar, estas informações serão salvas e vinculadas à conta identificada acima. Esta etapa não realiza contratação nem cobrança.';
    field('stepLabel').textContent = '01 / 02';
    document.title = 'Cadastre seu escritório — EloJus';
    showGate('A sessão mudou. Entre novamente para continuar.');
  }

  async function initialize() {
    const request = ++epoch;
    field('retryAccount').disabled = true;
    try {
      const result = await O.load();
      if (request !== epoch) return;
      user = result.user;
      field('accountIdentity').textContent = 'Conta responsável: ' + user.email;
      field('accountIdentity').hidden = false;
      field('accountGate').hidden = true;
      field('accountLink').href = 'index.html#inicio';
      field('accountLink').textContent = 'Meu ambiente ↗';
      if (result.office) { showSaved(result.office, true, false); return; }
      if (!value('responsibleName')) field('responsibleName').value = user.user_metadata?.full_name || '';
      if (!value('responsibleEmail')) field('responsibleEmail').value = user.email;
      field('reviewButton').disabled = false;
      showReview(false, false);
    } catch (error) {
      if (request !== epoch) return;
      user = null;
      showGate('Entre com a conta do advogado responsável para vincular o escritório. Depois do login, você volta para este cadastro.', sessionError(error) ? '' : O.message(error));
    } finally { if (request === epoch) field('retryAccount').disabled = false; }
  }

  function message(control) {
    const text = control.value.trim();
    switch (control.id) {
      case 'officeName': return text.length < 2 ? 'Informe o nome do escritório.' : '';
      case 'responsibleName': return text.length < 2 ? 'Informe o nome do advogado responsável.' : '';
      case 'responsibleEmail': return !text || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) || control.validity.typeMismatch ? 'Informe um e-mail válido.' : '';
      case 'responsiblePhone': {
        if (!text) return '';
        const digits = text.replace(/\D/g, '');
        return !/^\+?[\d\s().-]+$/.test(text) || digits.length < 10 || digits.length > 15 ? 'Informe um telefone com DDD ou deixe em branco.' : '';
      }
      case 'oabNumber': return !text || !/\d/.test(text) || !/^[\d\p{L}.\s\/-]+$/u.test(text) ? 'Informe o número de inscrição na OAB.' : '';
      case 'oabState': return !text ? 'Selecione a UF da OAB.' : '';
      default: return '';
    }
  }

  function validate(control) {
    const text = message(control);
    const hint = field(control.id + 'Error');
    hint.textContent = text;
    hint.hidden = !text;
    control.setAttribute('aria-invalid', String(Boolean(text)));
    return !text;
  }

  function showReview(visible, focus = true) {
    details.hidden = visible;
    review.hidden = !visible;
    field('stepLabel').textContent = visible ? '02 / 02' : '01 / 02';
    field('detailsStep').removeAttribute('aria-current');
    field('reviewStep').removeAttribute('aria-current');
    field(visible ? 'reviewStep' : 'detailsStep').setAttribute('aria-current', 'step');
    if (focus) {
      field(visible ? 'reviewTitle' : 'officeTitle').focus();
      field('conteudo').scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }

  controls.forEach(control => {
    control.addEventListener('blur', () => {
      if (control.value || control.getAttribute('aria-invalid') === 'true') validate(control);
    });
    control.addEventListener(control.tagName === 'SELECT' ? 'change' : 'input', () => {
      if (control.hasAttribute('aria-invalid')) validate(control);
      errorSummary.hidden = true;
    });
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!user || saving || field('reviewButton').disabled) return;
    const invalid = controls.filter(control => !validate(control));
    if (invalid.length) {
      errorSummary.textContent = 'Confira os campos indicados antes de revisar.';
      errorSummary.hidden = false;
      invalid[0].focus();
      return;
    }
    errorSummary.hidden = true;
    draft = { name: value('officeName'), responsibleName: value('responsibleName'), email: value('responsibleEmail'), phone: value('responsiblePhone'), oabNumber: value('oabNumber'), oabState: value('oabState') };
    renderSummary({name:draft.name, responsible_name:draft.responsibleName, responsible_email:draft.email, phone:draft.phone, oab_number:draft.oabNumber, oab_state:draft.oabState});
    field('saveError').hidden = true;
    showReview(true);
  });

  field('editDetails').addEventListener('click', () => { if (!saving) showReview(false); });
  field('saveOffice').addEventListener('click', async () => {
    if (saving || !user || !draft) return;
    const request = epoch;
    saving = true;
    review.setAttribute('aria-busy', 'true');
    field('saveOffice').disabled = field('editDetails').disabled = true;
    field('saveOffice').querySelector('span').textContent = 'Salvando escritório…';
    field('saveError').hidden = true;
    try {
      const result = await O.create(draft, user.id);
      if (request === epoch) showSaved(result.office, result.alreadyExists);
    } catch (error) {
      if (request !== epoch) return;
      field('saveError').textContent = O.message(error);
      field('saveError').hidden = false;
      field('saveError').focus();
      if (sessionError(error)) { field('relogin').hidden = false; field('saveActions').hidden = true; }
    } finally {
      saving = false;
      review.removeAttribute('aria-busy');
      field('saveOffice').disabled = field('editDetails').disabled = false;
      field('saveOffice').querySelector('span').textContent = 'Cadastrar escritório';
    }
  });
  field('retryAccount').addEventListener('click', initialize);
  window.addEventListener('elo-auth-change', event => {
    if (event.detail.event === 'SIGNED_OUT' || (user && event.detail.userId && event.detail.userId !== user.id)) {
      clearAccount();
    }
  });
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden || !user) return;
    const request = epoch;
    try {
      const current = await A.user();
      if (request === epoch && user && current.id !== user.id) clearAccount();
    } catch (error) { if (request === epoch && sessionError(error)) clearAccount(); }
  });
  await initialize();
})();
