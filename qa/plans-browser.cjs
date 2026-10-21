// Uses a separately installed Playwright; never reads remote credentials or data.
const {chromium}=require(process.env.ELOJUS_PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {start}=require('./plans-preview.cjs');
async function run(){
  const qa=await start();
  let browser;
  try { browser=await chromium.launch({headless:true,...(process.env.ELOJUS_BROWSER_CHANNEL?{channel:process.env.ELOJUS_BROWSER_CHANNEL}:{})}); }
  catch(error){await qa.close();throw error;}
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage(), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const out=path.resolve(__dirname,'../test-results/plans');fs.mkdirSync(out,{recursive:true});
  const visible=async selector=>{await page.locator(selector).waitFor({state:'visible'});};
  const checkWidth=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const screenshot=async name=>{await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});};
  const saved=async()=>(await qa.db.query('select plan_code,plan_selected_at from public.offices where id=$1',[qa.officeId])).rows[0];
  const safePayment=async()=>{assert.equal(await page.locator('#paymentUnavailable').isDisabled(),true);assert.equal(await page.locator('#paymentLink').getAttribute('href'),null);};
  try{
    await page.goto(qa.url+'/planos.html');await visible('#planChoices');
    assert.equal(await page.locator('input[name=plan]').count(),2);
    assert.match(await page.locator('#priceMensal').textContent(),/149,90/);
    assert.match(await page.locator('#priceAnual').textContent(),/1\.558,80/);
    assert.match(await page.locator('#equivalentAnual').textContent(),/129,90.*antecipado/);
    assert.match(await page.locator('.annual-card .plan-category').textContent(),/240,00.*13,34%/);
    await page.locator('#reviewPlan').click();await visible('#planError');
    // Native radio keyboard navigation must work as well as clicking a card.
    await page.locator('#planMensal').focus();await page.keyboard.press('Space');
    assert.equal(await page.locator('#planMensal').isChecked(),true);
    await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#planAnual').isChecked(),true);
    await screenshot('desktop');await checkWidth();
    await page.locator('#reviewPlan').click();await visible('#savePlan');
    assert.match(await page.locator('.review-price').textContent(),/1\.558,80\/ano/);
    assert.equal(await page.locator('#planReview [data-plan-benefits] li').count(),5);
    assert.equal((await saved()).plan_code,null);
    await page.route('**/rest/v1/offices?**',route=>route.request().method()==='PATCH'?route.fulfill({status:500,contentType:'application/json',body:'{"message":"internal secret"}'}):route.continue());
    await page.locator('#savePlan').click();await visible('#saveError');
    assert.doesNotMatch(await page.locator('#saveError').textContent(),/secret/);
    assert.equal(await page.locator('#continueContract').isVisible(),false);
    await page.unroute('**/rest/v1/offices?**');
    await page.locator('#savePlan').click();await visible('#savedMessage');
    const annual=await saved();assert.equal(annual.plan_code,'equipe_anual');assert.ok(annual.plan_selected_at);
    assert.equal(qa.mutations.length,1);assert.deepEqual(qa.mutations[0].payload,{plan_code:'equipe_anual'});
    await page.reload();await visible('#savedMessage');assert.equal(qa.mutations.length,1);assert.deepEqual(await saved(),annual);
    await page.locator('#continueContract').click();await visible('#contractSummary');
    assert.equal(await page.locator('#summaryPlan').textContent(),'Equipe anual');
    assert.match(await page.locator('.contract-price').textContent(),/1\.558,80\/ano.*129,90\/mês/s);
    assert.match(await page.locator('[data-plan-text=terms]').textContent(),/12 meses.*antecipado.*renovação.*reembolso/);
    assert.equal(await page.locator('#contractSummary [data-plan-benefits] li').count(),5);
    await safePayment();await screenshot('summary-annual-desktop');await checkWidth();
    for(const width of [390,320]){
      await page.setViewportSize({width,height:844});await screenshot('summary-annual-'+width);await checkWidth();
    }
    await page.goto(qa.url+'/cadastro-escritorio.html');await visible('#officeReview');
    assert.match(await page.locator('#saveNoteText').textContent(),/Equipe anual escolhido e salvo/);
    await page.goto(qa.url+'/planos.html');await visible('#savedMessage');
    await page.locator('#changePlan').click();await visible('#planChoices');
    for(const width of [390,320]){
      await page.setViewportSize({width,height:844});await screenshot('plans-'+width);await checkWidth();
    }
    await page.locator('label[for=planMensal]').click();await page.locator('#reviewPlan').click();await visible('#savePlan');
    assert.match(await page.locator('.review-price').textContent(),/149,90\/mês/);
    assert.match(await page.locator('#planReview [data-plan-text=conditions]').textContent(),/sem fidelidade anual/);
    assert.equal((await saved()).plan_code,'equipe_anual'); // Reviewing never saves.
    await page.locator('#savePlan').click();await visible('#savedMessage');
    assert.equal((await saved()).plan_code,'equipe_mensal');assert.equal(qa.mutations.length,2);
    await page.reload();await visible('#savedMessage');
    await page.locator('#continueContract').click();await visible('#contractSummary');await safePayment();
    assert.match(await page.locator('.contract-price').textContent(),/149,90\/mês/);
    assert.doesNotMatch(await page.locator('#contractSummary').textContent(),/1\.558,80|60 minutos|45º/);
    assert.equal(await page.locator('#contractSummary [data-plan-benefits] li').count(),3);
    await screenshot('summary-monthly-320');await checkWidth();
    await page.goto(qa.url+'/cadastro-escritorio.html');await visible('#officeReview');
    assert.match(await page.locator('#saveNoteText').textContent(),/Equipe mensal escolhido e salvo/);
    // Opening a draft annual choice cannot replace the persisted monthly summary.
    await page.goto(qa.url+'/planos.html');await visible('#savedMessage');await page.locator('#changePlan').click();
    await page.locator('label[for=planAnual]').click();await page.locator('#reviewPlan').click();await visible('#savePlan');
    await page.goto(qa.url+'/contratacao.html');await visible('#contractSummary');
    assert.equal(await page.locator('#summaryPlan').textContent(),'Equipe mensal');
    // A session change clears previously loaded office details in both pages.
    await page.evaluate(()=>{window.qaSignedOut=true;window.dispatchEvent(new CustomEvent('elo-auth-change',{detail:{event:'SIGNED_OUT'}}));});
    await visible('#gateAction');assert.equal(await page.locator('#contractSummary').isVisible(),false);
    assert.equal(await page.locator('#summaryOffice').textContent(),'');
    await page.goto(qa.url+'/planos.html');await visible('#savedMessage');
    await page.evaluate(()=>{window.qaSignedOut=true;window.dispatchEvent(new CustomEvent('elo-auth-change',{detail:{event:'SIGNED_OUT'}}));});
    await visible('#gateAction');assert.equal(await page.locator('#planReview').isVisible(),false);
    assert.equal(await page.locator('#officeName').textContent(),'');
    // Every legacy code remains unchanged until the owner confirms a new offer.
    for(const legacy of ['equipe','essencial','personalizado']){
      await qa.db.query('update public.offices set plan_code=$1 where id=$2',[legacy,qa.officeId]);
      await page.reload();await visible('#previousPlanNote');assert.equal(qa.mutations.length,2);
      assert.equal(await page.locator('input[name=plan]:checked').count(),0);
      assert.equal((await saved()).plan_code,legacy);
      await page.goto(qa.url+'/contratacao.html');await visible('#gateAction');
      assert.equal(await page.locator('#contractSummary').isVisible(),false);
      assert.equal(await page.locator('#gateAction').getAttribute('href'),'planos.html');
      await page.goto(qa.url+'/planos.html');await visible('#previousPlanNote');
    }
    for(const persona of ['other','collaborator']){
      await page.evaluate(value=>localStorage.setItem('plan-qa-persona',value),persona);
      await page.goto(qa.url+'/planos.html');await visible('#gateAction');
      assert.equal(await page.locator('#planChoices').isVisible(),false);
      for(const code of ['equipe_mensal','equipe_anual']){
        const response=await fetch(qa.url+'/rest/v1/offices?id=eq.'+qa.officeId,{method:'PATCH',headers:{'content-type':'application/json','x-qa-persona':persona},body:JSON.stringify({plan_code:code})});
        assert.deepEqual(await response.json(),[]);
      }
    }
    assert.equal((await saved()).plan_code,'personalizado');
    await page.evaluate(()=>localStorage.setItem('plan-qa-persona','owner'));
    await page.route('**/rest/v1/offices?**',route=>route.abort());
    await page.goto(qa.url+'/planos.html');await visible('#gateError');await visible('#retryLoad');
    await page.unroute('**/rest/v1/offices?**');await page.locator('#retryLoad').click();await visible('#planChoices');
    assert.deepEqual(errors,[]);
    console.log('Plan browser checks passed: both billing periods, exact prices/benefits, keyboard, PostgreSQL persistence, reload, unsaved drafts, safe payment, all legacy choices, auth loss, error/retry, owner isolation, desktop and 390/320 px.');
  }finally{await context.close();await browser.close();await qa.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
