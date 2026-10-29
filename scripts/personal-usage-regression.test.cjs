const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../electron/main.cjs'), 'utf8');
const context = vm.createContext({ Date });
vm.runInContext(source.slice(source.indexOf('function parsePersonalUsage('), source.indexOf('const PERSONAL_USAGE_SCRIPT')), context);
const read = context.parsePersonalUsage;
const now = Date.parse('2026-10-13T15:03:23Z');
const meters = 'Plan limits\n5-hour limit\nResets in 2h 38m\n13% left\nWeekly limit\nResets in 6d 21h\n86% left\nCredits';
test('reads both separate allowances and relative reset dates', () => {
  const result = read(meters, now);
  assert.equal(result.fiveHour.left, 13);
  assert.equal(result.weekly.left, 86);
  assert.equal(result.fiveHour.resetAt, now + (2*60+38)*60000);
  assert.equal(result.weekly.resetAt, now + (6*24+21)*3600000);
  assert.equal(result.resets, null, 'an absent reset section must preserve existing records');
});
test('captures available resets with exact Argentina expiry times and removes used rows on next reading', () => {
  const section = '\nUsage limit resets\nAvailable 3\nHistory\nFull reset (Weekly + 5 hr)\nExpires Oct 22, 3:30 PM GMT-3\nUse reset\nFull reset (Weekly + 5 hr)\nExpires Oct 29, 4:07 PM GMT-3\nUse reset\nFull reset (Weekly + 5 hr)\nExpires Nov 6, 6:41 PM GMT-3';
  const result = read(meters + section, now);
  assert.equal(result.resets.length, 3);
  assert.equal(result.resets[0].expiresAt, Date.parse('2026-10-22T18:30:00Z'));
  assert.equal(result.resets[2].expiresAt, Date.parse('2026-11-06T21:41:00Z'));
  assert.equal(read(meters + '\nUsage limit resets\nAvailable 0\nHistory', now).resets.length, 0);
});
test('invalid or partial meters cannot overwrite a saved snapshot', () => {
  assert.equal(read(meters.replace('13% left', '130% left'), now), null);
  assert.equal(read('Weekly limit\nResets in 1d\n20% left', now), null);
  assert.equal(read(meters.replace('13% left', 'Loading...'), now), null);
});
test('reads Spanish counters and does not invent a date for an unknown reset format', () => {
  const result = read('Límite de 5 horas\nSe reinicia en 2h 38m\n13% restante\nLímite semanal\nSe reinicia en mañana por la tarde\n86% restante', now);
  assert.equal(result.fiveHour.left, 13);
  assert.equal(result.weekly.resetAt, null);
  assert.equal(result.weekly.resetText, 'mañana por la tarde');
});
test('only a Usage settings dialog can supply counters; History cannot replace available resets', () => {
  const scope = vm.createContext({ location:{hostname:'chatgpt.com'}, document:{querySelectorAll:()=>[]} });
  vm.runInContext(source.slice(source.indexOf('const PERSONAL_USAGE_SCRIPT'), source.indexOf('let personalUsageReading')) + '\nglobalThis.script=PERSONAL_USAGE_SCRIPT;', scope);
  assert.equal(vm.runInContext(scope.script, scope), null);
  const dialog = { getClientRects:()=>[{}], innerText:meters+'\nUsage limit resets\nAvailable 3', querySelectorAll:()=>[] };
  scope.document.querySelectorAll = () => [dialog];
  assert.match(vm.runInContext(scope.script, scope), /Available 3/);
  dialog.querySelectorAll = () => [{innerText:'History'}];
  assert.doesNotMatch(vm.runInContext(scope.script, scope), /Available 3/);
  scope.location.hostname = 'example.com';
  assert.equal(vm.runInContext(scope.script, scope), null);
});
