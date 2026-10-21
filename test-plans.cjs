const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./dist/plan-catalog.js');

test('monthly and annual totals retain cents and bill extra seats for the full period', () => {
  for (const [code, examples] of [
    ['equipe_mensal', [[1,14990],[2,14990],[3,14990],[4,16890],[5,18790]]],
    ['equipe_anual', [[1,155880],[2,155880],[3,155880],[4,178680],[5,201480]]]
  ]) {
    for (const [people, expected] of examples) assert.equal(P.total(code, people), expected);
    for (const people of [0,-1,1.5,NaN,Infinity,'4',null,Number.MAX_SAFE_INTEGER]) {
      assert.throws(() => P.total(code, people), /invalid_people/);
    }
  }
  assert.equal(P.money(12990).replace(/\s/g,''), 'R$129,90');
  assert.equal(P.money(155880).replace(/\s/g,''), 'R$1.558,80');
});

test('payment is unavailable by default and only accepts explicit HTTPS destinations', () => {
  for (const code of ['equipe_mensal','equipe_anual','equipe',undefined]) assert.equal(P.paymentUrl(code), null);
  const credentialUrl = new URL('https://example.invalid');
  credentialUrl.username = 'fixture'; credentialUrl.password = 'fixture';
  for (const url of ['',null,{},'javascript:alert(1)','data:text/html,test','http://example.invalid','//example.invalid',credentialUrl.href]) {
    assert.equal(P.safePaymentUrl(url), null);
  }
  assert.equal(P.safePaymentUrl('https://checkout.example.invalid/plano'), 'https://checkout.example.invalid/plano');
});

test('annual copy distinguishes total payment, monthly equivalent and actual savings', () => {
  const annual = P.labels('equipe_anual'), monthly = P.labels('equipe_mensal');
  assert.match(annual.charge, /1\.558,80\/ano/);
  assert.match(annual.equivalent, /129,90\/mês.*antecipado.*12 meses/);
  assert.equal(P.savingCents, 24000);
  assert.match(annual.savings, /240,00.*13,34%/);
  assert.match(annual.extra, /228,00.*ano/);
  assert.match(monthly.charge, /149,90\/mês/);
  assert.match(monthly.conditions, /sem fidelidade anual/);
  assert.doesNotMatch(annual.conditions, /sem fidelidade/);
  assert.equal(P.annual.benefits.length, 5);
  assert.match(P.annual.benefits.join(' '), /60 minutos.*30 minutos.*30º.*45º.*Checklist.*12 meses/);
});

test('legacy and invalid codes never silently inherit current prices or benefits', () => {
  for (const code of ['equipe','essencial','personalizado','unknown',null,{},'__proto__']) {
    assert.equal(P.find(code), null);
    assert.throws(() => P.labels(code), /invalid_plan/);
    assert.throws(() => P.total(code, 3), /invalid_plan/);
  }
});

test('a summary uses its saved period while offer cards retain their own prices', () => {
  const label = (planText, planCode) => ({dataset:{planText},closest:()=>planCode?{dataset:{planCode}}:null});
  const nodes = [label('charge'),label('extra'),label('charge','equipe_mensal')];
  P.fill({querySelectorAll:selector=>selector==='[data-plan-text]'?nodes:[]}, 'equipe_anual');
  assert.match(nodes[0].textContent,/1\.558,80\/ano/);
  assert.match(nodes[1].textContent,/228,00/);
  assert.match(nodes[2].textContent,/149,90\/mês/);
});
