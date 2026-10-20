(() => {
  'use strict';
  const A = window.EloAuth, F = window.EloAuthForm, next = A.nextRoute();
  const form = document.getElementById('recoveryForm'), email = document.getElementById('recoveryEmail');
  const submit = form.querySelector('[type="submit"]'), error = document.getElementById('recoveryError');
  const entry = document.getElementById('recoveryEntry'), preview = document.getElementById('recoveryPreview'), skip = document.getElementById('recoverySkip');
  const field = text => F.field(email, document.getElementById('recoveryEmailError'), text);
  document.querySelectorAll('[data-login-link]').forEach(link => { link.href = 'login.html?next=' + encodeURIComponent(next); });
  email.addEventListener('input', () => { field(''); error.hidden = true; });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (submit.disabled) return;
    email.value = email.value.trim(); error.hidden = true;
    const message = !email.value ? 'Informe seu e-mail para continuar.' : !email.validity.valid || email.value.length > 254 ? 'Confira o formato do e-mail.' : '';
    field(message); if (message) { email.focus(); return; }
    F.busy(form, true, submit, 'Enviando…');
    try {
      await A.requestRecovery(email.value, next);
      document.getElementById('recoveryAddress').textContent = email.value;
      entry.hidden = true; preview.hidden = false;
      skip.href = '#recoveryPreviewTitle'; skip.textContent = 'Ir para as instruções';
      document.getElementById('recoveryPreviewTitle').focus();
    } catch (failure) { F.error(error, A.message(failure)); }
    finally { F.busy(form, false, submit, 'Enviar link de recuperação'); }
  });
  document.getElementById('changeRecoveryEmail').addEventListener('click', () => {
    preview.hidden = true; entry.hidden = false; skip.href = '#recoveryEmail'; skip.textContent = 'Ir para o formulário'; field(''); email.focus();
  });
})();
