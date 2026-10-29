const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const esbuild=require(process.env.WORKHUB_ESBUILD || 'esbuild');
const source=fs.readFileSync(path.join(__dirname,'../src/main.jsx'),'utf8');
const sampleChats=[
 ['a','Fanvue 1','gpt-personal'],['b','Fanvue 2','gpt-personal'],['c','Prom Fotos','gpt-personal'],['d','Workhub','gpt-personal'],['e','WorkHub','gpt-personal'],['f','MSGHub','gpt-personal'],['h','MicroInflus','gpt-personal'],['i','General','gpt-personal'],
 ['n','Nico','ia-nico'],['g','Gemini','gemini-personal'],['x','Alterframe','gpt-alterframe'],['y','Alterframe 2','gpt-alterframe']
].map(([id,name,service])=>({id,name,service,url:service==='ia-nico'?'https://portal-colegas.vercel.app/login':service==='gemini-personal'?'https://gemini.google.com/app':'https://chatgpt.com/'}));
const nav=[{type:'folder',id:'work',name:'Trabajo',open:true,children:['gpt-personal','ia-nico','microinfluencers','gemini-personal','gpt-alterframe','documents','translator']}];
const panel=id=>({section:'ai',sub:id});
const pure={};
vm.runInNewContext(source.slice(source.indexOf('const MAX_WORKSPACE_PANELS'),source.indexOf('const INITIAL_PERSONAL_USAGE'))+';globalThis.order=orderWorkspacePanels;globalThis.plan=planWorkspacePanelSelection;globalThis.key=workspacePanelKey;',pure);
const ordered=panels=>JSON.parse(JSON.stringify(pure.order(panels,nav,sampleChats)));
function permutations(list){return list.length ? list.flatMap((item,index)=>permutations(list.filter((_,i)=>i!==index)).map(rest=>[item,...rest])) : [[]];}
test('all click orders produce left-to-right tab order, including the user examples',()=>{
 for(const ids of permutations(['a','c','d']))assert.deepEqual(ordered(ids.map(panel)).map(item=>item.sub),['a','c','d']);
 for(const ids of permutations(['a','b','c']))assert.deepEqual(ordered(ids.map(panel)).map(item=>item.sub),['a','b','c']);
});
test('replacement planning never changes current views until a valid choice',()=>{
 const current=['a','c','d'].map(panel),before=JSON.stringify(current);
 const request=pure.plan(current,panel('e'));assert.equal(request.needsReplacement,true);assert.equal(JSON.stringify(current),before);
 assert.equal(JSON.stringify(pure.plan(current,panel('e'),'missing').panels),before);
 const accepted=pure.plan(current,panel('b'),'ai:d');assert.deepEqual(ordered(accepted.panels).map(item=>item.sub),['a','b','c']);
});
test('collapsed folders and provider order define the layout; document slots survive sorting',()=>{
 const reversed=[{...nav[0],open:false,children:[...nav[0].children].reverse()}];
 const selected=[panel('a'),{section:'microinfluencers'},panel('g')];
 assert.deepEqual(JSON.parse(JSON.stringify(pure.order(selected,reversed,sampleChats))).map(item=>item.sub || item.section),['g','microinfluencers','a']);
 const docs=pure.order([{section:'documents',slot:2},panel('a'),{section:'documents',slot:0}],nav,sampleChats);
 assert.deepEqual(JSON.parse(JSON.stringify(docs)).map(item=>item.section==='ai'?item.sub:item.slot),['a',0,2]);
});
// Run the actual App handlers and JSX with a hook/element host. The Electron
// layout bridge is recorded; no services or authenticated sessions are used.
function uiHarness(initial=['a'], savedMemory=null){
 const store=new Map(Object.entries({
 'workhub-gmail-deva-startup-v2':'done','workhub-ai-provider-tabs-migrated-v1':'done','workhub-gemini-personal-tab-v1':'done',
 'workhub-ai-chat-tabs':JSON.stringify(sampleChats),'workhub-ai-active-tab':initial[0],
 'workhub-ai-visible-tabs':JSON.stringify(initial),'workhub-global-panels':JSON.stringify(initial.map(panel)),
 'workhub-tab-structure':JSON.stringify(nav)
 }));
 if(savedMemory)store.set('workhub-ai-provider-views',savedMemory);
 const hooks=[],layouts=[];let cursor=0,effects=[],tree;
 const equal=(a,b)=>a&&b&&a.length===b.length&&a.every((value,index)=>Object.is(value,b[index]));
 const element=(type,props,...children)=>({type,props:{...props,children:children.flat(Infinity)}});
 const chrome={getBoundingClientRect:()=>({height:66}),getClientRects:()=>[{}]};
 const overlay={getBoundingClientRect:()=>({height:38}),getClientRects:()=>[{}]};
 const scope={APP_VERSION:'0.8.0',React:{createElement:element,Fragment:'fragment'},createPortal:child=>({type:'portal',props:{children:[child]}}),
 localStorage:{getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,String(value))},
 document:{body:{},querySelector:selector=>selector==='.chrome'?chrome:selector.startsWith('.overlay-bar')?overlay:null},
 window:{innerWidth:1900,innerHeight:1000,workhub:{setTheme(){},layout:(...args)=>{layouts.push(args);return Promise.resolve();}},addEventListener(){},removeEventListener(){},alert:message=>{throw Error('Unexpected alert: '+message)}},
 ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:fn=>{fn();return 1},cancelAnimationFrame(){},setTimeout,clearTimeout,
 useState(initial){const index=cursor++;if(!hooks[index])hooks[index]={value:typeof initial==='function'?initial():initial};return [hooks[index].value,update=>{hooks[index].value=typeof update==='function'?update(hooks[index].value):update}];},
 useRef(initial){const index=cursor++;if(!hooks[index])hooks[index]={value:{current:initial}};return hooks[index].value;},
 useMemo(fn,deps){const index=cursor++;if(!hooks[index]||!equal(hooks[index].deps,deps))hooks[index]={value:fn(),deps};return hooks[index].value;},
 useEffect(fn,deps){const index=cursor++;if(!hooks[index]||!equal(hooks[index].deps,deps)){hooks[index]?.cleanup?.();hooks[index]={deps};effects.push({index,fn});}}
 };
 const icons=source.match(/import \{ (.*?) \} from 'lucide-react';/)[1].split(',').map(name=>name.trim().split(' as ').at(-1));
 for(const icon of icons)scope[icon]=()=>null;
 let code=source.split('\n').filter(line=>!line.startsWith('import ')).join('\n');
 code=code.slice(0,code.lastIndexOf('createRoot('))+'\nglobalThis.renderApp=App;';
 vm.runInNewContext(esbuild.transformSync(code,{loader:'jsx',format:'cjs'}).code,scope);
 function render(){cursor=0;effects=[];tree=scope.renderApp();for(const {index,fn} of effects){const text=fn.toString();if(text.includes('rememberProviderViews()')||text.includes('window.workhub.layout(')||/^\(\) => \{\s*localStorage\.setItem/.test(text))hooks[index].cleanup=fn();}return tree;}
 function nodes(root=tree){if(!root||typeof root!=='object')return [];return [root,...(root.props?.children||[]).flatMap(child=>nodes(child))];}
 const text=node=>typeof node==='string'||typeof node==='number'?String(node):(node?.props?.children||[]).map(text).join('');
 function click(predicate){const button=nodes().find(node=>node.type==='button'&&predicate(node));assert.ok(button,'button not found');button.props.onClick();render();}
 const api={render,nodes,text,layouts,store,
 main:name=>click(node=>node.props.className?.split(' ').includes('tab')&&text(node)===name),
 selected:()=>JSON.parse(store.get('workhub-global-panels')||'[]'),
 visible:()=>{const args=layouts.at(-1);return args ? args[2] || args[4] || args[0] : [];},
 toggle:name=>click(node=>node.props['aria-label']?.endsWith(': '+name)),
 mainTick:name=>click(node=>node.props['aria-label']?.match(new RegExp('^(Agregar|Quitar) '+name+' .*vista'))),
 open:name=>click(node=>node.props.className==='ai-chat-open'&&text(node)===name),
 choose:name=>click(node=>node.props.onClick&&text(node).match(new RegExp('^[123]'+name+'$'))),
 cancel:()=>click(node=>text(node)==='Cancelar'),
 dialog:()=>nodes().find(node=>node.props?.role==='dialog'),
 reorder(sourceName,targetName){
   const wrap=name=>nodes().find(node=>node.type==='div'&&node.props?.className?.split(' ').includes('ai-chat-tab')&&text(node).includes(name));
   let dragged='';wrap(sourceName).props.onDragStart({target:{closest:()=>null},dataTransfer:{setData:(_,value)=>dragged=value}});render();
   wrap(targetName).props.onDrop({preventDefault(){},clientX:0,currentTarget:{getBoundingClientRect:()=>({left:0,width:100})},dataTransfer:{getData:()=>dragged}});render();
 }
 };
 render();return api;
}
const clean=value=>JSON.parse(JSON.stringify(value));
const ids=ui=>ui.selected().map(item=>item.sub || item.section);
test('Personal alone asks on the third checkbox and replaces in subtab order',()=>{
 const ui=uiHarness(['d']);ui.toggle('Fanvue 1');assert.deepEqual(ids(ui),['a','d']);
 const before=clean(ui.selected());ui.toggle('Prom Fotos');assert.ok(ui.dialog());assert.deepEqual(clean(ui.selected()),before);assert.deepEqual(clean(ui.visible()),[]);
 assert.ok(ui.text(ui.dialog()).includes('Fanvue 1'));assert.ok(ui.text(ui.dialog()).includes('Workhub'));
 ui.choose('Workhub');assert.ok(!ui.dialog());assert.deepEqual(ids(ui),['a','c']);
 assert.equal(JSON.parse(ui.store.get('workhub-ai-chat-tabs')).filter(chat=>chat.service==='gpt-personal').length,8);
});
test('cancel and Escape preserve the two Personal views and their native IDs',()=>{
 const ui=uiHarness(['a','c']),before=clean(ui.visible());ui.toggle('WorkHub');ui.cancel();assert.deepEqual(ids(ui),['a','c']);assert.deepEqual(clean(ui.visible()),before);
 ui.toggle('WorkHub');ui.dialog().props.onKeyDown({key:'Escape',preventDefault(){},stopPropagation(){}});ui.render();assert.ok(!ui.dialog());assert.deepEqual(clean(ui.visible()),before);
});
test('dragging selected subtabs reorders panes; clicking a name opens it alone',()=>{
 const ui=uiHarness(['a','d']);ui.reorder('Workhub','Fanvue 1');assert.deepEqual(ids(ui),['d','a']);
 assert.deepEqual(clean(ui.visible()).map(id=>id.split('::')[0]),['ai-chat-d','ai-chat-a']);
 ui.open('Fanvue 1');assert.deepEqual(ids(ui),['a']);
});
test('mixed providers allow three and ask which to replace on the fourth',()=>{
 const ui=uiHarness(['a']);ui.mainTick('Gemini Personal');ui.mainTick('Microinfluencers');assert.deepEqual(ids(ui),['a','microinfluencers','g']);
 ui.mainTick('IA Nico');assert.ok(ui.dialog());assert.deepEqual(ids(ui),['a','microinfluencers','g']);
 ui.choose('Gemini');assert.deepEqual(ids(ui),['a','n','microinfluencers']);
 for(const args of ui.layouts)assert.ok((args[2]||args[4]||args[0]).length<=3);
});
test('old Personal-only saves restore two ordered views without deleting chats',()=>{
 for(const saved of [['d','c','b','a'],['d','c','a']]){
 const ui=uiHarness(saved);assert.deepEqual(ids(ui),saved.length===4?['a','b']:['a','c']);assert.equal(ui.visible().length,2);
 assert.equal(JSON.parse(ui.store.get('workhub-ai-chat-tabs')).length,sampleChats.length);
 }
});
test('two Personal chats plus another main tab allow three, including Documentos',()=>{
 for(const main of ['IA Nico','Gemini Personal','GPT AlterFrame','Microinfluencers','Translator','Documentos']){
 const ui=uiHarness(['a','c']);ui.mainTick(main);assert.ok(!ui.dialog(),main);assert.equal(ui.selected().length,3,main);
 ui.mainTick(main);assert.deepEqual(ids(ui),['a','c']);assert.equal(ui.visible().length,2);
 }
});
test('mixed fourth subtab can replace a Personal chat, but not create three Personal-only panes',()=>{
 const ui=uiHarness(['n','a','c']);ui.toggle('WorkHub');assert.ok(ui.dialog());
 const options=ui.nodes(ui.dialog()).filter(node=>node.type==='button').map(ui.text);
 assert.deepEqual(options,['1Fanvue 1','2Prom Fotos','Cancelar']);
 ui.choose('Fanvue 1');assert.deepEqual(ids(ui),['c','e','n']);
 const chats=JSON.parse(ui.store.get('workhub-ai-chat-tabs'));assert.ok(chats.some(chat=>chat.id==='a'));assert.equal(chats.length,sampleChats.length);
});
test('replacing the other main tab with Personal is allowed when the result has only two',()=>{
 const ui=uiHarness(['n','a']);ui.toggle('Prom Fotos');assert.deepEqual(ids(ui),['a','c','n']);
 ui.mainTick('IA Nico');assert.deepEqual(ids(ui),['a','c']);
 ui.toggle('WorkHub');assert.ok(ui.dialog());ui.choose('Fanvue 1');assert.deepEqual(ids(ui),['c','e']);
});
test('other AI providers keep their three-view limit',()=>{
 const chats=[1,2,3,4].map(n=>({id:'x'+n,service:'gpt-alterframe'}));
 const current=chats.slice(0,2).map(chat=>panel(chat.id));
 assert.equal(pure.plan(current,panel('x3'),null,chats).panels.length,3);
 assert.equal(pure.plan([...current,panel('x3')],panel('x4'),null,chats).needsReplacement,true);
});
test('planner enforces both limits and rejects replacements that would leave three Personal views',()=>{
 assert.equal(pure.plan([panel('a'),panel('c')],panel('d'),null,sampleChats).needsReplacement,true);
 const mixed=[panel('a'),panel('c'),panel('n')];
 assert.deepEqual(clean(pure.plan(mixed,panel('d'),'ai:n',sampleChats).panels),mixed);
 assert.deepEqual(ordered(pure.plan(mixed,panel('d'),'ai:c',sampleChats).panels).map(p=>p.sub),['a','d','n']);
});

test('provider name restores independent split selections and subtab names still focus one',()=>{
 const ui=uiHarness(['d','e']);
 ui.main('GPT AlterFrame');assert.deepEqual(ids(ui),['x']);
 ui.toggle('Alterframe 2');assert.deepEqual(ids(ui),['x','y']);
 ui.main('GPT Personal');assert.deepEqual(ids(ui),['d','e']);
 ui.main('GPT AlterFrame');assert.deepEqual(ids(ui),['x','y']);
 ui.open('Alterframe 2');assert.deepEqual(ids(ui),['y']);
 ui.main('GPT Personal');assert.deepEqual(ids(ui),['d','e']);
 ui.main('GPT AlterFrame');assert.deepEqual(ids(ui),['y']);
 ui.main('Documentos');ui.main('GPT Personal');assert.deepEqual(ids(ui),['d','e']);
 const restored=uiHarness(['d','e'],ui.store.get('workhub-ai-provider-views'));
 restored.main('GPT AlterFrame');assert.deepEqual(ids(restored),['y']);
});
test('saved selections ignore removed IDs, retain tab order and enforce Personal limit',()=>{
 const ui=uiHarness(['x'],JSON.stringify({'gpt-personal':['gone','e','d','a']}));
 ui.main('GPT Personal');assert.deepEqual(ids(ui),['a','d']);
});
