(async () => {
  'use strict';
  const A = window.EloAuth, F = window.EloAuthForm, next = A.nextRoute();
  const form = document.getElementById('loginForm'), email = document.getElementById('loginEmail'), password = document.getElementById('loginPassword');
  const submit = document.getElementById('loginSubmit'), error = document.getElementById('loginError'), clear = F.passwords(form);
  document.getElementById('signupLink').href = 'cadastro.html?next=' + encodeURIComponent(next);
  document.getElementById('forgotPassword').href = 'recuperar-senha.html?next=' + encodeURIComponent(next);
  const fields = new Map([[email, document.getElementById('emailError')], [password, document.getElementById('passwordError')]]);
  for (const [input, node] of fields) input.addEventListener('input', () => { F.field(input, node, ''); error.hidden = true; });
  for (const type of ['keydown', 'keyup']) password.addEventListener(type, event => { document.getElementById('capsLockNote').hidden = !event.getModifierState?.('CapsLock'); });
  password.addEventListener('blur', () => { document.getElementById('capsLockNote').hidden = true; });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (submit.disabled) return;
    error.hidden = true; email.value = email.value.trim();
    F.field(email, fields.get(email), !email.value ? 'Informe seu e-mail.' : !email.validity.valid ? 'Confira o formato do e-mail.' : '');
    F.field(password, fields.get(password), password.value ? '' : 'Informe sua senha.');
    const invalid = form.querySelector('[aria-invalid="true"]'); if (invalid) { invalid.focus(); return; }
    F.busy(form, true, submit, 'Entrando…');
    try { await A.login(email.value, password.value); clear(); location.assign(A.destination(next)); }
    catch (failure) { clear(); F.busy(form, false, submit, 'Entrar'); F.error(error, A.message(failure)); }
  });
  if (new URLSearchParams(location.search).get('reason') === 'session') {
    const notice = document.getElementById('registrationNotice'); notice.textContent = 'Entre na sua conta para continuar.'; notice.hidden = false;
  }
  if (A.hasCallback()) {
    F.busy(form, true, submit, 'Confirmando e-mail…');
    try { await A.consumeCode('signup'); location.replace(A.destination(next)); }
    catch (failure) { F.busy(form, false, submit, 'Entrar'); F.error(error, A.message(failure)); }
  }
})();
