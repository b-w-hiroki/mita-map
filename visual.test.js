// Full local UI with all external resources blocked and geolocation mocked.
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const html=fs.readFileSync('index.html','utf8').replace(/<script[^>]+src=[^>]*><\/script>/g,'');
  await page.route('**/*',r=>r.request().url()==='https://offline.test/'?r.fulfill({contentType:'text/html',body:html}):r.abort());
  await page.addInitScript(()=>Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(ok,fail){fail({code:1});}}}));
  await page.goto('https://offline.test/');
  await page.evaluate(()=>openSettingsModal());
  await page.click('#setGeoBtn');
  assert.match(await page.locator('#setGeoStatus').textContent(),/住所・駅名/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  fs.mkdirSync('qa-artifacts',{recursive:true});
  await page.screenshot({path:'qa-artifacts/location-denied-mobile.png',fullPage:true});
  await page.evaluate(()=>closeSettingsModal());
  console.log('Chromium full local UI: 390x844 mock denial fallback and dismissal; external resources blocked, no real location.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
