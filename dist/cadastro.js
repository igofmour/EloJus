(() => {
  'use strict';
  const A = window.EloAuth, F = window.EloAuthForm, next = A.nextRoute();
  const form = document.getElementById('signupForm'), submit = document.getElementById('signupSubmit');
  const name = document.getElementById('signupName'), email = document.getElementById('signupEmail');
  const password = document.getElementById('signupPassword'), confirm = document.getElementById('signupConfirm');
  const error = document.getElementById('signupError'), clear = F.passwords(form);
  const errors = new Map([[name, 'nameError'], [email, 'emailError'], [password, 'passwordError'], [confirm, 'confirmError']]);
  document.querySelectorAll('[data-login-link]').forEach(link => { link.href = 'login.html?next=' + encodeURIComponent(next); });
  const field = (input, text) => F.field(input, document.getElementById(errors.get(input)), text);
  for (const input of errors.keys()) input.addEventListener('input', () => { field(input, ''); error.hidden = true; });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (submit.disabled) return;
    for (const input of errors.keys()) field(input, ''); error.hidden = true;
    name.value = name.value.trim(); email.value = email.value.trim();
    if (name.value.length < 2 || name.value.length > 120) field(name, 'Informe seu nome completo.');
    if (!email.value || !email.validity.valid) field(email, 'Informe um e-mail válido.');
    if (password.value.length < 8 || password.value.length > 128) field(password, 'Use entre 8 e 128 caracteres.');
    if (!confirm.value) field(confirm, 'Repita sua senha para confirmar.');
    else if (confirm.value !== password.value) field(confirm, 'As senhas precisam ser iguais.');
    const invalid = form.querySelector('[aria-invalid="true"]'); if (invalid) { invalid.focus(); return; }
    F.busy(form, true, submit, 'Criando conta…');
    try {
      const result = await A.register(name.value, email.value, password.value, next); clear();
      document.getElementById('registeredName').textContent = name.value;
      document.getElementById('registeredEmail').textContent = email.value;
      if (!result.confirmationRequired) {
        document.getElementById('successTitle').textContent = 'Sua conta está pronta.';
        document.getElementById('signupSuccessIntro').textContent = 'Entre com seu e-mail e senha para continuar.';
      }
      document.getElementById('signupDetails').hidden = true; document.getElementById('signupSuccess').hidden = false;
      document.querySelector('.signup-content').setAttribute('aria-labelledby', 'successTitle');
      document.querySelector('.skip-link').href = '#successTitle';
      document.title = 'Confirme seu e-mail — EloJus'; document.getElementById('successTitle').focus();
    } catch (failure) { clear(); F.busy(form, false, submit, 'Criar conta'); F.error(error, A.message(failure)); }
  });
})();
