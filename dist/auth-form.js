(() => {
  'use strict';
  document.querySelectorAll('[data-email-setup]').forEach(node => { node.hidden = !window.EloAuthConfig?.emailSetupPending; });
  function error(node, text) { node.textContent = text; node.hidden = !text; if (text) node.focus(); }
  function field(input, node, text) { node.textContent = text; node.hidden = !text; input.setAttribute('aria-invalid', String(Boolean(text))); }
  function busy(form, value, button, text) { form.setAttribute('aria-busy', String(value)); form.querySelectorAll('input,button').forEach(control => { control.disabled = value; }); if (button) button.querySelector('span').textContent = text; }
  function passwords(form) {
    const inputs = Array.from(form.querySelectorAll('input[autocomplete="new-password"],input[autocomplete="current-password"]'));
    const buttons = form.querySelectorAll('[data-password-toggle]');
    buttons.forEach(button => {
      button.dataset.showLabel = button.getAttribute('aria-label');
      button.addEventListener('click', () => {
        const input = document.getElementById(button.dataset.passwordToggle), show = input.type === 'password';
        input.type = show ? 'text' : 'password'; button.setAttribute('aria-pressed', String(show));
        button.setAttribute('aria-label', show ? button.dataset.showLabel.replace('Mostrar', 'Ocultar') : button.dataset.showLabel);
      });
    });
    function clear() { inputs.forEach(input => { input.value = ''; input.type = 'password'; }); buttons.forEach(button => { button.setAttribute('aria-pressed', 'false'); button.setAttribute('aria-label', button.dataset.showLabel); }); }
    window.addEventListener('pagehide', clear); window.addEventListener('pageshow', clear);
    return clear;
  }
  window.EloAuthForm = { error, field, busy, passwords };
})();
