(async () => {
  'use strict';
  const A = window.EloAuth, F = window.EloAuthForm, next = A.nextRoute();
  const form = document.getElementById('resetForm'), submit = form.querySelector('[type="submit"]');
  const password = document.getElementById('resetPassword'), confirm = document.getElementById('resetConfirm');
  const error = document.getElementById('resetError'), clear = F.passwords(form);
  const errors = new Map([[password, 'resetPasswordError'], [confirm, 'resetConfirmError']]);
  const field = (input, text) => F.field(input, document.getElementById(errors.get(input)), text);
  let authorized = false;
  document.querySelectorAll('[data-login-link]').forEach(link => { link.href = 'login.html?next=' + encodeURIComponent(next); });
  document.querySelectorAll('[data-recovery-link]').forEach(link => { link.href = 'recuperar-senha.html?next=' + encodeURIComponent(next); });
  for (const input of errors.keys()) input.addEventListener('input', () => { field(input, ''); error.hidden = true; });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (!authorized || submit.disabled) return;
    for (const input of errors.keys()) field(input, ''); error.hidden = true;
    if (password.value.length < 8 || password.value.length > 128) field(password, 'Use entre 8 e 128 caracteres.');
    if (!confirm.value) field(confirm, 'Repita a nova senha para confirmar.');
    else if (confirm.value !== password.value) field(confirm, 'As senhas precisam ser iguais.');
    const invalid = form.querySelector('[aria-invalid="true"]'); if (invalid) { invalid.focus(); return; }
    F.busy(form, true, submit, 'Salvando nova senha…');
    try {
      const result = await A.resetPassword(password.value); clear(); authorized = false;
      document.getElementById('resetEntry').hidden = true; document.getElementById('resetComplete').hidden = false;
      if (!result.sessionsRevoked) document.getElementById('resetCompleteNote').textContent = 'Sua senha foi alterada. Não conseguimos confirmar o encerramento das outras sessões. Entre novamente e revise seus acessos.';
      const skip = document.getElementById('resetSkip'); skip.href = '#resetCompleteTitle'; skip.textContent = 'Ir para a conclusão';
      document.title = 'Senha alterada — EloJus'; document.getElementById('resetCompleteTitle').focus();
    } catch (failure) {
      clear(); F.busy(form, false, submit, 'Redefinir senha'); F.error(error, A.message(failure));
      if (failure.code === 'invalid_link') { authorized = false; form.hidden = true; }
    }
  });
  F.busy(form, true, submit, 'Validando link…');
  try {
    await A.consumeCode('recovery'); authorized = true;
    document.getElementById('resetLinkStatus').hidden = true; form.hidden = false;
    F.busy(form, false, submit, 'Redefinir senha'); password.focus();
  } catch (failure) {
    clear(); document.getElementById('resetLinkStatus').hidden = true;
    F.error(error, A.message(failure));
    document.getElementById('resetTitle').textContent = 'Solicite um novo link.';
    document.getElementById('resetIntro').textContent = 'Para criar uma nova senha, abra o link recebido no seu e-mail.';
    document.getElementById('resetRecoveryLink').textContent = 'Solicitar link de recuperação';
    document.getElementById('resetRecoveryLink').className = 'submit-button';
  }
})();
