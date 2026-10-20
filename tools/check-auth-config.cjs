const fs = require('node:fs');
const vm = require('node:vm');
const box = { window: {} };
vm.runInNewContext(fs.readFileSync('dist/auth-config.js', 'utf8'), box);
const config = box.window.EloAuthConfig;
(async () => {
  const response = await fetch(config.url + '/auth/v1/settings', { headers: { apikey: config.publishableKey } });
  if (!response.ok) throw new Error('Auth settings HTTP ' + response.status);
  const value = await response.json();
  console.log(JSON.stringify({ reachable: true, emailEnabled: value.external?.email, signupEnabled: !value.disable_signup, emailConfirmationRequired: !value.mailer_autoconfirm, smtpSetupPending: config.emailSetupPending }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
