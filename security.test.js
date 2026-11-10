const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const script = html.match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g).find(s => s.includes('function renderVisitHistory('));
function source(from, to) { return script.slice(script.indexOf(from), script.indexOf(to, script.indexOf(from))); }
function element() {
  return {
    children: [], className: '', style: {}, textContent: '',
    append(...items) { this.children.push(...items); },
    appendChild(item) { this.children.push(item); },
    replaceChildren(...items) { this.children = items; },
    addEventListener(type, fn) { this[type] = fn; }
  };
}

test('visit food and memo display literally and delete is clickable', () => {
  const nodes = { dVisitLabel: element(), dVisitList: element() };
  let deleted;
  const ctx = {
    document: { getElementById: id => nodes[id], createElement: element },
    getVisits: () => [{ date: '2026-04-05', rating: 3, ts: 9,
      food: '<img src=x onerror=alert(1)>', memo: '<svg onload=alert(1)>' }],
    window: { __delVisit: (id, ts) => { deleted = [id, ts]; } }
  };
  vm.createContext(ctx);
  vm.runInContext(source('function renderVisitHistory(', 'window.__delVisit='), ctx);
  ctx.renderVisitHistory(5);
  const item = nodes.dVisitList.children[0];
  assert.equal(item.children[1].textContent, '🍽️ <img src=x onerror=alert(1)>');
  assert.equal(item.children[2].textContent, '📝 <svg onload=alert(1)>');
  item.children[0].children[2].click();
  assert.deepEqual(deleted, [5, 9]);
});

test('search result text is literal and selection uses the original coordinates', async () => {
  const nodes = { setSearch: { value: '三田' }, setSearchResults: element() };
  let picked;
  const ctx = {
    document: { getElementById: id => nodes[id], createElement: element },
    fetch: async () => ({ json: async () => [{
      lat: '35.6', lon: '139.7', display_name: '<img src=x onerror=alert(1)>, 東京'
    }] }),
    window: { __pickLocation: (...args) => { picked = args; } }
  };
  vm.createContext(ctx);
  vm.runInContext(source('async function searchNominatim(', 'window.__pickLocation='), ctx);
  await ctx.searchNominatim();
  const result = nodes.setSearchResults.children[0].children[0];
  assert.equal(result.children[0].textContent, '<img src=x onerror=alert(1)>');
  result.click();
  assert.deepEqual(picked.slice(0, 2), ['35.6', '139.7']);
});

function geoHarness(available=true){
  const nodes={setGeoBtn:{disabled:false},setGeoStatus:{},setName:{value:''},settingsModal:{classList:{remove(){}}}};
  const calls=[]; const saved=[];
  const ctx={document:{getElementById:id=>nodes[id]},navigator:available?{geolocation:{getCurrentPosition(...args){calls.push(args);}}}:{},map:null,applyBase(...args){saved.push(args);}};
  vm.createContext(ctx);
  vm.runInContext(source('let geoRequest = 0;', 'function updateBaseStatus(')+source('function requestCurrentBase(', "document.getElementById('setGeoBtn').addEventListener"),ctx);
  return {ctx,nodes,calls,saved};
}
test('geolocation denial keeps base and offers address search, with bounded timeout',()=>{
  const {ctx,nodes,calls,saved}=geoHarness(); ctx.requestCurrentBase(); ctx.requestCurrentBase();
  assert.equal(calls.length,1); assert.equal(calls[0][2].timeout,10000);
  calls[0][1]({code:1}); assert.equal(saved.length,0); assert.equal(nodes.setGeoBtn.disabled,false);
  assert.match(nodes.setGeoStatus.textContent,/住所・駅名/);
});
test('closing invalidates delayed location and permits a new request',()=>{
  const {ctx,calls,saved}=geoHarness(); ctx.requestCurrentBase(); ctx.closeSettingsModal(); ctx.requestCurrentBase();
  calls[0][0]({coords:{latitude:1,longitude:2}}); assert.equal(saved.length,0);
  calls[1][0]({coords:{latitude:3,longitude:4}}); assert.equal(saved.length,1); assert.equal(saved[0][0],3);
});
test('unsupported location offers search without requesting or saving',()=>{
  const {ctx,nodes,saved}=geoHarness(false);ctx.requestCurrentBase();assert.equal(saved.length,0);assert.match(nodes.setGeoStatus.textContent,/住所・駅名/);
});
test('unknown freshness and straight-line walking estimate are disclosed',()=>{
  assert.match(html,/掲載情報の出典・最終確認日は未確認/); assert.match(html,/直線距離÷80m\/分/);
  assert.match(html,/情報の訂正を提案（GitHub・公開）/);
});
