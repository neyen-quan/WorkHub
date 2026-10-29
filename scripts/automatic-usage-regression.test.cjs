const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../electron/main.cjs'),'utf8');
const raw={usage:{rate_limit:{primary_window:{used_percent:87,limit_window_seconds:18000,reset_at:1791896400},secondary_window:{used_percent:14,limit_window_seconds:604800,reset_at:1792501200}},rate_limit_reset_credits:{available_count:3}},resets:{available_count:3,credits:[{status:'available',expires_at:'2026-10-22T18:30:00Z'},{status:'available',expires_at:'2026-10-29T19:07:00Z'},{status:'available',expires_at:'2026-11-06T21:41:00Z'}]}};
const sampleTime=Date.parse('2026-10-13T15:29:00Z');
function harness(result=raw) {
  const events=[],requests=[];
  const view={webContents:{isDestroyed:()=>false,getURL:()=> 'https://chatgpt.com/c/existing-chat',executeJavaScript:script=>{requests.push(script);return Promise.resolve(result);}}};
  const scope=vm.createContext({Date:class extends Date {static now(){return sampleTime;}},URL,setTimeout,clearTimeout,remoteViews:new Map([['ai-chat-personal::gpt-personal',view]]),win:{isDestroyed:()=>false,webContents:{send:(type,data)=>events.push({type,data})}}});
  vm.runInContext(source.slice(source.indexOf('function parsePersonalUsageApi('),source.indexOf('const personalUsageTimer')),scope);
  return {scope,events,requests,read:(args={})=>{scope.args=args;return vm.runInContext('readPersonalUsage(args)',scope);},parse:(result,now=sampleTime)=>scope.parsePersonalUsageApi(result,now)};
}
test('reads structured limits and reset dates without navigating or creating a window',async()=>{
  const h=harness();const data=await h.read();
  assert.equal(data.fiveHour.left,13);assert.equal(data.weekly.left,86);
  assert.equal(data.fiveHour.resetAt,1791896400000);
  assert.equal(data.resets.length,3);assert.equal(data.resets[0].expiresAt,Date.parse('2026-10-22T18:30:00Z'));
  assert.equal(data.status,'ready');assert.equal(h.requests.length,1);
  assert.ok(h.events.some(event=>event.data.status==='checking'));
  assert.ok(h.events.some(event=>event.data.status==='ready'));
  const collector=source.slice(source.indexOf('async function collectPersonalUsage()'),source.indexOf('const personalUsageTimer'));
  assert.doesNotMatch(collector,/loadURL|\.reload\(|BrowserWindow|remoteViews\.set|currentViews\.push/);
});
test('simultaneous checks share one request and cached checks do not query again',async()=>{
  const h=harness();const first=h.read(),second=h.read();assert.equal(first,second);
  await first;await h.read();assert.equal(h.requests.length,1);
});
test('API failures report the actual error, retain failure status and back off',async()=>{
  const h=harness({error:'HTTP 401 al consultar sesión'});const result=await h.read();
  assert.equal(result.status,'error');assert.equal(result.fiveHour,undefined);
  assert.match(result.error,/HTTP 401/);assert.ok(result.retryAt>=sampleTime+9*60000);
  assert.equal((await h.read()).status,'error');assert.equal(h.requests.length,1);
});
test('window duration determines the meter even when weekly is primary',()=>{
  const h=harness();const input=structuredClone(raw);
  const rate=input.usage.rate_limit;[rate.primary_window,rate.secondary_window]=[rate.secondary_window,rate.primary_window];
  const value=h.parse(input);assert.equal(value.fiveHour.left,13);assert.equal(value.weekly.left,86);
  rate.secondary_window=null;const weeklyOnly=h.parse(input);assert.equal(weeklyOnly.fiveHour,null);assert.equal(weeklyOnly.weekly.left,86);
});
test('invalid quota data cannot become a zero or fully available meter',()=>{
  const h=harness();const input=structuredClone(raw);input.usage.rate_limit.primary_window.used_percent='unknown';input.usage.rate_limit.secondary_window.used_percent=NaN;
  assert.equal(h.parse(input),null);
});
test('used and expired resets are excluded; failed reset details preserve meter data',()=>{
  const h=harness();const input=structuredClone(raw);input.resets.credits[0].status='redeemed';input.resets.credits[1].expires_at='2026-10-12T00:00:00Z';
  const result=h.parse(input);assert.equal(result.resets.length,1);
  input.resets=null;input.resetsError='HTTP 503 al consultar resets';const partial=h.parse(input);assert.equal(partial.resets,null);assert.equal(partial.resetCount,3);assert.equal(partial.fiveHour.left,13);
  input.usage.rate_limit_reset_credits.available_count=0;assert.equal(h.parse(input).resets.length,0);
});
test('same-origin API requests expose only quota data, never credentials or account identifiers',async()=>{
  const h=harness();const calls=[];
  const session={accessToken:'private-test-token',account:{id:'private-account-id'}};
  h.scope.location={origin:'https://chatgpt.com'};h.scope.AbortController=AbortController;h.scope.atob=atob;
  h.scope.fetch=async(path,options)=>{
    calls.push({path,options});
    let data=path==='/api/auth/session' ? session : path.endsWith('reset-credits') ? {...raw.resets,credits:raw.resets.credits.map(credit=>({...credit,id:'private-credit-id'}))} : {...raw.usage,account_id:'private-account-id',user_id:'private-user-id'};
    return {ok:true,json:async()=>data};
  };
  const result=await vm.runInContext('eval(PERSONAL_USAGE_REQUEST_SCRIPT)',h.scope);
  assert.deepEqual(calls.map(call=>call.path),['/api/auth/session','/backend-api/wham/usage','/backend-api/wham/rate-limit-reset-credits']);
  for(const call of calls){assert.equal(call.options.method,'GET');assert.equal(call.options.credentials,'include');}
  assert.equal(calls[1].options.headers['ChatGPT-Account-ID'],'private-account-id');
  assert.doesNotMatch(JSON.stringify(result),/private-/);
  assert.equal(result.usage.rate_limit.primary_window.used_percent,87);
});
test('reset endpoint failure does not prevent a successful quota response',async()=>{
  const h=harness();h.scope.location={origin:'https://chatgpt.com'};h.scope.AbortController=AbortController;h.scope.atob=atob;
  h.scope.fetch=async path=>path.endsWith('reset-credits') ? {ok:false,status:503} : {ok:true,json:async()=>path==='/api/auth/session' ? {accessToken:'test-token'} : raw.usage};
  const result=await vm.runInContext('eval(PERSONAL_USAGE_REQUEST_SCRIPT)',h.scope);
  assert.equal(result.usage.rate_limit.primary_window.used_percent,87);assert.match(result.resetsError,/HTTP 503/);
});
