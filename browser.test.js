const { chromium } = require('playwright');
const fs = require('node:fs');

const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
function source(from, to) {
  const start = html.indexOf(from), end = html.indexOf(to, start);
  if (start < 0 || end < 0) throw new Error('Missing application function: ' + from);
  return html.slice(start, end);
}

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<div id="dVisitLabel"></div><div id="dVisitList"></div><input id="setSearch" value="三田"><div id="setSearchResults"></div>');
    const payload = '<img src=x onerror=alert(1)>';
    await page.addScriptTag({ content: `
      window.getVisits = () => [{ date:'2026-04-05', rating:3, ts:9, food:${JSON.stringify(payload)}, memo:${JSON.stringify(payload)} }];
      window.__delVisit = (...args) => { window.deleted = args; };
      window.__pickLocation = (...args) => { window.picked = args; };
      window.fetch = async () => ({ json: async () => [{ lat:'35.6', lon:'139.7', display_name:${JSON.stringify(payload + ', 東京')} }] });
      ${source('function renderVisitHistory(', 'window.__delVisit=')}
      ${source('async function searchNominatim(', 'window.__pickLocation=')}
    ` });
    const result = await page.evaluate(async () => {
      renderVisitHistory(5);
      await searchNominatim();
      const food = document.querySelector('.visit-food');
      const address = document.querySelector('.sr-item-name');
      document.querySelector('.del-btn').click();
      document.querySelector('.sr-item').click();
      return {
        food: food.textContent, address: address.textContent,
        injected: !!document.querySelector('.visit-food img, .sr-item img'),
        deleted: window.deleted, picked: window.picked
      };
    });
    if (result.food !== '🍽️ ' + payload || result.address !== payload || result.injected ||
        result.deleted.join(',') !== '5,9' || result.picked.slice(0, 2).join(',') !== '35.6,139.7')
      throw new Error('Visit or search DOM behavior failed: ' + JSON.stringify(result));
    console.log('Chromium: visit and search text rendered literally; handlers work');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
