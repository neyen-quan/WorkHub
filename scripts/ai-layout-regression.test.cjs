const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {EventEmitter}=require('node:events');
const path=require('node:path');
const source=fs.readFileSync(process.env.WORKHUB_TEST_SOURCE || path.join(__dirname,'../electron/main.cjs'),'utf8');
const uiSource=fs.readFileSync(path.join(__dirname,'../src/main.jsx'),'utf8');
const translatorUrl=source.match(/^\s*translator: '(https:\/\/translate\.google\.com\/[^']+)'/m)?.[1];
const A='ai-chat-personal-1::gpt-personal', B='ai-chat-personal-2::gpt-personal', C='ai-chat-alter::gpt-alterframe', D='ai-chat-nico::ia-nico', G='ai-chat-gemini::gemini-personal';
function harness(){
  const events=[],operations=[];
  class Contents extends EventEmitter {
    constructor(){super();this.loads=[];this.styles=[];this.session={};this.debugger={isAttached:()=>true,sendCommand:async()=>{}};}
    insertCSS(css,options){this.styles.push({css,options});return Promise.resolve('style-key');}
    isDestroyed(){return false;} setUserAgent(){} setWindowOpenHandler(handler){this.windowOpenHandler=handler;} setAudioMuted(){}
    loadURL(url){this.loads.push(url);return Promise.resolve();}
  }
  class View{
    constructor(options){this.options=options;this.webContents=new Contents();this.rect={x:0,y:0,width:0,height:0};}
    setBounds(rect){operations.push(['bounds',this,{...rect}]);this.rect={...rect};}
    getBounds(){return {...this.rect};} setBackgroundColor(){}
  }
  const host={children:[],addChildView(view,index){operations.push(['add',view,index]);this.children=this.children.filter(v=>v!==view);if(Number.isInteger(index))this.children.splice(Math.max(0,Math.min(index,this.children.length)),0,view);else this.children.push(view);},removeChildView(view){operations.push(['remove',view]);this.children=this.children.filter(v=>v!==view);}};
  const context=vm.createContext({WebContentsView:View,path,process,URL,setImmediate,translatorUrl,__dirname:path.join(__dirname,'../electron'),
    shell:{openExternal(){}},win:{contentView:host,getContentBounds:()=>({width:1200,height:900}),webContents:{send:(...args)=>events.push(args)}},
    editingController:{install(){}},applyRemoteTheme(){},configureNotificationPermissions(){},isMessagingService:()=>false,installResizableSidebar(){},installWhatsAppSidebarResize(){},publishSplitRatios(){}});
  vm.runInContext(`let remoteViews=new Map(),currentViews=[],loadedViewTargets=new Map(),currentAiTargets={},currentTheme='dark',workMode=false;
  let currentLayoutIds=[],currentSplitIds=null,currentSplitRatio=50,currentSplitRatio2=66.67,currentAiLayoutIds=null,currentAiRatios={x:50,y:50},contentTop=130;
  let microRefreshView=null,microRefreshAttached=false,currentMicroRefreshViewId=null,splitterXView=null,splitterX2View=null,splitterYView=null;
  let splitterXAttached=false,splitterX2Attached=false,splitterYAttached=false,splitterDraggingAxis=null;
  const gmailSessionProfiles={'gmail-neyen':'gmail-laacade','gmail-laacade':'gmail-neyen','gmail-hincharc':'gmail-quan','gmail-quan':'gmail-hincharc','gmail-deva':'gmail-deva','gmail-alterframe':'gmail-alterframe'}; const sites={translator:translatorUrl,'gmail-neyen':'https://mail.google.com/mail/u/0/?authuser=account%40example.invalid','gpt-personal':'https://chatgpt.com/','gpt-alterframe':'https://chatgpt.com/','ia-nico':'https://portal-colegas.vercel.app/login','gemini-personal':'https://gemini.google.com/app?hl=es-419',microinfluencers:'https://preview.example/'};
  ${source.slice(source.indexOf('function validatedAiTarget('),source.indexOf('function showWindow('))}
  globalThis.api={layout:(ids,targets={},mixed=false)=>layoutViews(ids,win.getContentBounds(),mixed?ids:null,50,mixed?null:ids,{x:50,y:50},targets),view:id=>remoteViews.get(id),target:(id,service,target)=>{currentAiTargets={[id]:target};return validatedAiTarget(id,service);},resize:resizeCurrentSplitViews,rects:()=>currentViews.map(v=>v.getBounds())};`,context);
  return {...context.api,events,operations,host};
}
test('SPA navigation persisted to renderer must not reload its document',()=>{
 const h=harness();h.layout([A]);const v=h.view(A);
 v.webContents.emit('did-navigate-in-page',{},'https://chatgpt.com/c/workhub',true);
 h.layout([A,B],{[A]:'https://chatgpt.com/c/workhub'});
 assert.equal(v.webContents.loads.length,1,'saving a visited URL triggered a second loadURL');
});
test('stale snapshots and two simultaneous navigations never replay old chat URLs',()=>{
 const h=harness();h.layout([A,B]);
 for(const id of [A,B])h.view(id).webContents.emit('did-navigate-in-page',{},`https://chatgpt.com/c/${id[8]}`,true);
 for(let i=0;i<12;i++)h.layout(i%2?[A]:[A,B],{[A]:i%2?'https://chatgpt.com/':'https://chatgpt.com/c/new',[B]:'https://chatgpt.com/c/other'});
 for(const id of [A,B])assert.equal(h.view(id).webContents.loads.length,1);
});
test('visible GPT stays attached and is never resized to zero when adding a sibling',()=>{
 const h=harness();h.layout([A]);const v=h.view(A);h.operations.length=0;h.layout([A,B]);
 assert.ok(!h.operations.some(([op,view,rect])=>view===v&&(op==='remove'||op==='bounds'&&(!rect.width||!rect.height))));
});
test('stale native GPT views cannot sit above the active panel and steal search clicks',()=>{
 const h=harness();h.layout([A,B,C]);h.layout([A,B]);
 const a=h.view(A),b=h.view(B),stale=h.view(C);
 stale.setBounds({x:0,y:130,width:1200,height:745});
 // Simulate Electron retaining a previously selected remote view at the top
 // of its native z stack after the visible layout has changed.
 h.host.addChildView(stale);
 h.layout([A,B]);
 assert.ok(!h.host.children.includes(stale),'inactive remote view remained attached');
 assert.deepEqual(h.host.children.slice(0,2),[a,b],'active views were not restored to canonical stacking order');
 const point={x:100,y:160};
 const hit=[...h.host.children].reverse().find(view=>{const r=view.getBounds();return point.x>=r.x&&point.x<r.x+r.width&&point.y>=r.y&&point.y<r.y+r.height;});
 assert.equal(hit,a,'a stale or overlapping native view intercepted the click on the first GPT panel');
});
test('providers and 1–3 subpanels retain separate contents and fit the viewport',()=>{
 const h=harness();for(const ids of [[A],[A,B],[A,C,D],[A,B,C],[D],[A,B]]){
 h.layout(ids);h.resize();const views=ids.map(id=>h.view(id));assert.equal(new Set(views).size,ids.length);
 for(const r of h.rects()){assert.ok(r.x>=0&&r.y>=130&&r.x+r.width<=1200&&r.y+r.height<=875);}
 for(let i=0;i<views.length;i++)for(let j=i+1;j<views.length;j++){
 const a=views[i].getBounds(),b=views[j].getBounds();assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);
 }
 }
 for(const id of [A,B,C,D])assert.equal(h.view(id).webContents.loads.length,1);
 assert.equal(h.view(A).options.webPreferences.partition,h.view(B).options.webPreferences.partition);
 assert.notEqual(h.view(A).options.webPreferences.partition,h.view(C).options.webPreferences.partition);
});
test('Gemini Personal reuses the persistent Google session of Gmail ',()=>{
 const h=harness();h.layout([G,'gmail-neyen']);const gemini=h.view(G);
 assert.ok(gemini,'Gemini did not create a remote view');
 assert.equal(gemini.webContents.loads[0],'https://gemini.google.com/app?hl=es-419');
 assert.equal(gemini.options.webPreferences.partition,'persist:workhub-gmail-laacade');
 assert.equal(gemini.options.webPreferences.partition,h.view('gmail-neyen').options.webPreferences.partition,'Gemini must use the already signed-in Gmail Personal profile');
 h.layout([A,G]);
 assert.notEqual(gemini.options.webPreferences.partition,h.view(A).options.webPreferences.partition,'Gemini must not reuse a GPT session');
 assert.equal(h.target(G,'gemini-personal','https://gemini.google.com/app?hl=es-419'),'https://gemini.google.com/app?hl=es-419');
 assert.equal(h.target(G,'gemini-personal','https://example.com/'),'https://gemini.google.com/app?hl=es-419','Gemini sub-tabs must stay on Google Gemini');
 h.layout([A,G]);
 assert.equal(new Set(h.rects().map(rect=>rect.x)).size,2,'Gemini and GPT must split as separate selectable panels');
 assert.equal(gemini.webContents.loads.length,1,'changing panel selection must preserve Gemini login and page');
});
test('each AI provider accepts eight saved sub-tabs and refuses the ninth',()=>{
 const start=uiSource.indexOf('function createAiChat(event)');
 const end=uiSource.indexOf('function renameAiChat(',start);
 assert.ok(start>=0&&end>start,'AI sub-tab creation function was not found');
 const fn=uiSource.slice(start,end);
 const ctx={AI_APPS:[{id:'gpt-personal',short:'GPT Personal'}],URL,Date,Math,
  seedTabs:[{id:'existing',service:'gpt-personal',name:'GPT Personal',url:'https://chatgpt.com/',customName:false}]};
 vm.runInNewContext(`let aiTabs=seedTabs;let aiChatDialog=null;let aiDialogError='';
 function setAiTabs(update){aiTabs=update(aiTabs)} function setAiChatDialog(value){aiChatDialog=value}
 function setAiDialogError(value){aiDialogError=value} function focusAiChat(){} function setTab(){}
 ${fn}
 globalThis.configure=value=>{aiChatDialog=value;aiDialogError=''};
 globalThis.add=()=>createAiChat({preventDefault(){}});
 globalThis.count=()=>aiTabs.filter(item=>item.service==='gpt-personal').length;
 globalThis.error=()=>aiDialogError;`,ctx);
 for(let count=2;count<=8;count++){
  ctx.configure({service:'gpt-personal',name:`GPT Personal ${count}`,url:''});ctx.add();
  assert.equal(ctx.count(),count,`provider should retain ${count} sub-tabs`);
 }
 ctx.configure({service:'gpt-personal',name:'GPT Personal 9',url:''});ctx.add();
 assert.equal(ctx.count(),8,'the ninth sub-tab must be rejected');
 assert.match(ctx.error(),/ocho subpestañas/);
 assert.match(uiSource,/selectedAiTabs\.length} \/ \$\{workspacePanelLimit\(currentWorkspacePanels\(\),aiTabs\)}/,'the visible indicator must reflect the current workspace limit');
});
test('native layout never attaches a fourth AI or mixed workspace panel',()=>{
 const h=harness();h.layout([A,B,C,D]);assert.equal(h.rects().length,3);assert.equal(h.view(D),undefined);
 h.layout([A,B,C,D],{},true);assert.equal(h.rects().length,3);assert.equal(h.view(D),undefined);
});
test('Google sign-in popups for Gemini stay in the Gemini view and shared Google account profile',async()=>{
 const h=harness();h.layout([G,'gmail-neyen']);const wc=h.view(G).webContents;
 const auth='https://accounts.google.com/signin/v2/identifier?service=gemini';
 assert.equal(wc.windowOpenHandler({url:auth}).action,'deny');
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(wc.loads[1],auth,'Google authentication should continue inside the Gemini subtab');
 assert.equal(wc.loads.length,2);
});
test('Gemini migration adds one subtab and nests the provider in the existing Trabajo IA folder',()=>{
 const providers=['gpt-personal','gpt-alterframe','ia-nico','gemini-personal'];
 const aiApps=providers.map(id=>({id}));
 const defaults=[
  {id:'chat-default-personal',service:'gpt-personal',name:'GPT Personal',url:'https://chatgpt.com/',customName:false},
  {id:'chat-default-alterframe',service:'gpt-alterframe',name:'GPT Alterframe',url:'https://chatgpt.com/',customName:false},
  {id:'chat-default-nico',service:'ia-nico',name:'Guía de Nico',url:'https://portal-colegas.vercel.app/login',customName:false},
  {id:'chat-default-gemini-personal',service:'gemini-personal',name:'Gemini Personal',url:'https://gemini.google.com/app?hl=es-419',customName:false}
 ];
 const start=uiSource.indexOf('function loadAiWorkspace()'),end=uiSource.indexOf('function normalizeAiSplitPanes(');
 const store=new Map([['workhub-ai-chat-tabs',JSON.stringify(defaults.slice(0,3))],['workhub-ai-provider-tabs-migrated-v1','done']]);
 const storage={getItem:key=>store.has(key)?store.get(key):null,setItem:(key,value)=>store.set(key,String(value))};
 const ctx={AI_APPS:aiApps,DEFAULT_AI_WORKSPACE:defaults,AI_PROVIDER_TABS_MIGRATION:'workhub-ai-provider-tabs-migrated-v1',GEMINI_PERSONAL_TAB_MIGRATION:'workhub-gemini-personal-tab-v1',localStorage:storage};
 vm.runInNewContext(`${uiSource.slice(start,end)};globalThis.load=loadAiWorkspace;`,ctx);
 const tabs=JSON.parse(JSON.stringify(ctx.load()));
 assert.deepEqual(tabs.map(item=>item.service),providers,'Gemini should be appended while existing chats are preserved');
 assert.equal(tabs[3].url,'https://gemini.google.com/app?hl=es-419');
 assert.equal(storage.getItem('workhub-gemini-personal-tab-v1'),'done');

 const navStart=uiSource.indexOf('function loadNavItems()'),navEnd=uiSource.indexOf('function removeTab(');
 const navStore=new Map([['workhub-tab-structure',JSON.stringify([{type:'folder',id:'folder-work',name:'Trabajo',open:true,children:providers.slice(0,3)}])]]);
 const navCtx={AI_APPS:aiApps,TAB_IDS:['gpt-personal','gpt-alterframe','ia-nico','gemini-personal','documents'],localStorage:{getItem:key=>navStore.get(key)||null}};
 vm.runInNewContext(`${uiSource.slice(navStart,navEnd)};globalThis.load=loadNavItems;`,navCtx);
 const nav=JSON.parse(JSON.stringify(navCtx.load()));
 assert.ok(nav.find(item=>item.id==='folder-work').children.includes('gemini-personal'),'Gemini should be inserted in the existing provider folder');
});
test('mixed three-panel divider works with a Documents slot',()=>{
 const h=harness();h.layout([A,null,'microinfluencers'],{},true);h.resize();assert.equal(h.rects().length,2);
});
test('modal hide/show retains chat contents without reloading',()=>{
 const h=harness();h.layout([A,B]);const a=h.view(A);h.layout([]);assert.ok(!h.host.children.includes(a));h.layout([A,B]);assert.equal(h.view(A),a);assert.equal(a.webContents.loads.length,1);
});
test('Microinfluencers URL edits still navigate deliberately',()=>{
 const h=harness(),id='global-1::microinfluencers';h.layout([A,id],{[id]:'https://preview.example/one'},true);h.layout([A,id],{[id]:'https://preview.example/two'},true);assert.equal(h.view(id).webContents.loads.length,2);
});
test('errors identify the failing panel and successful load announces recovery',()=>{
 const h=harness();h.layout([A,B]);const wc=h.view(B).webContents;
 wc.emit('did-fail-load',{},-105,'ERR_NAME_NOT_RESOLVED','https://chatgpt.com/',true);
 assert.equal(h.events.find(([type])=>type==='view-error')[1].viewId,B);
 wc.emit('did-finish-load');assert.equal(h.events.find(([type])=>type==='view-ready')[1].viewId,B);
});

test('embedded-frame navigation does not replace the saved chat address',()=>{
 const h=harness();h.layout([A]);h.view(A).webContents.emit('did-navigate-in-page',{},'https://embedded.example/',false);
 assert.equal(h.events.filter(([type])=>type==='ai-view-navigation').length,0);
});

test('every remote document disables native drag regions before finish-load, including reused GPT panels',()=>{
 const h=harness();h.layout([A,B,C]);
 for(const id of [A,B,C]){
  const wc=h.view(id).webContents;
  wc.emit('dom-ready');
  assert.equal(wc.styles.length,1,'pointer policy missing before did-finish-load');
  assert.equal(wc.styles[0].options.cssOrigin,'user','author CSS could override the policy');
  assert.match(wc.styles[0].css,/app-region:\s*no-drag\s*!important/);
  assert.match(wc.styles[0].css,/:root \*/,'dynamically mounted controls must be covered');
 }
 const wc=h.view(A).webContents;
 h.layout([C]);h.layout([A,B]);
 assert.equal(wc.styles.length,1,'layout updates must not accumulate styles');
 wc.emit('dom-ready');
 assert.equal(wc.styles.length,2,'a fresh document needs its own policy');
 assert.equal(wc.loads.length,1,'installing the policy must not reload chats');
});

test('Translator uses its own profile and retains typed-page state from full view to 2–3 mixed panels',()=>{
 const h=harness();h.layout(['translator']);const translator=h.view('translator');
 assert.ok(translator,'translator view must exist');
 assert.equal(translator.options.webPreferences.partition,'persist:workhub-translator');
 const url=new URL(translator.webContents.loads[0]);
 assert.equal(url.hostname,'translate.google.com');assert.equal(url.searchParams.get('sl'),'es');assert.equal(url.searchParams.get('tl'),'en');
 h.layout([A,'translator'],{},true);assert.equal(h.rects().length,2);
 h.layout([A,C,'translator'],{},true);assert.equal(h.rects().length,3);
 h.layout([A,B]);h.layout(['translator']);
 assert.equal(h.view('translator'),translator);assert.equal(translator.webContents.loads.length,1,'switching and splitting must preserve the existing translator document');
 assert.notEqual(h.view(A).options.webPreferences.partition,translator.options.webPreferences.partition);
});
test('Translator is inserted once into Trabajo and later user moves are preserved',()=>{
 const start=uiSource.indexOf('function loadNavItems()'),end=uiSource.indexOf('function removeTab(');
 let saved=[{type:'folder',id:'work',name:'Trabajo',open:true,children:['gpt-personal','gemini-personal','microinfluencers']},{type:'tab',id:'documents'}];
 const context={AI_APPS:[{id:'gpt-personal'},{id:'gemini-personal'}],TAB_IDS:['gpt-personal','gemini-personal','microinfluencers','translator','documents'],localStorage:{getItem:()=>JSON.stringify(saved)}};
 vm.runInNewContext(uiSource.slice(start,end)+';globalThis.load=loadNavItems;',context);
 const first=JSON.parse(JSON.stringify(context.load()));
 assert.deepEqual(first[0].children,['gpt-personal','gemini-personal','microinfluencers','translator']);
 saved=first;assert.equal(context.load()[0].children.filter(id=>id==='translator').length,1);
 saved=[{...first[0],children:first[0].children.filter(id=>id!=='translator')},first[1],{type:'tab',id:'translator'}];
 const moved=JSON.parse(JSON.stringify(context.load()));
 assert.ok(!moved[0].children.includes('translator'));assert.equal(moved.filter(item=>item.type==='tab'&&item.id==='translator').length,1);
});

test('reordering the selected native views does not reload any chat or preview',()=>{
 const h=harness(),M='microinfluencers',targets={[M]:'https://preview.example/retained'};
 h.layout([A,M,C],targets,true);const saved=[A,M,C].map(id=>h.view(id));
 h.layout([C,A,M],targets,true);h.resize();
 [A,M,C].forEach((id,index)=>{assert.equal(h.view(id),saved[index]);assert.equal(h.view(id).webContents.loads.length,1);});
 assert.ok(h.view(C).getBounds().x<h.view(A).getBounds().x);
 assert.ok(h.view(A).getBounds().x<h.view(M).getBounds().x);
});
