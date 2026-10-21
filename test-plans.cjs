const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./dist/plan-catalog.js');

test('monthly price covers one to three people and adds only excess seats', () => {
  for (const [people, total] of [[1,12900],[2,12900],[3,12900],[4,14800],[5,16700],[8,22400],[10,26200]]) {
    assert.equal(P.monthlyTotal(people), total);
  }
  for (const people of [0,-1,1.5,NaN,Infinity,'4',null,Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => P.monthlyTotal(people), /invalid_people/);
  }
});

test('payment is unavailable by default and only accepts explicit HTTPS destinations', () => {
  assert.equal(P.paymentUrl(), null);
  const credentialUrl = new URL('https://example.invalid');
  credentialUrl.username = 'fixture'; credentialUrl.password = 'fixture';
  for (const url of ['',null,{},'javascript:alert(1)','data:text/html,test','http://example.invalid','//example.invalid',credentialUrl.href]) {
    assert.equal(P.paymentUrl(url), null);
  }
  assert.equal(P.paymentUrl('https://checkout.example.invalid/plano'), 'https://checkout.example.invalid/plano');
});

test('published price labels and examples come from the same catalog', () => {
  const labels = ['monthly','included','extra','orientation'].map(planText => ({dataset:{planText}}));
  const examples = [3,4,5].map(planPeople => ({dataset:{planPeople}}));
  P.fill({querySelectorAll:selector => selector==='[data-plan-text]'?labels:examples});
  assert.match(labels[0].textContent,/129\/mês/);
  assert.equal(labels[1].textContent,'Até 3 pessoas');
  assert.match(labels[2].textContent,/19 por pessoa adicional\/mês/);
  assert.match(labels[3].textContent,/30 minutos/);
  assert.match(examples[2].textContent,/167\/mês/);
});
