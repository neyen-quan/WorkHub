const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync(__dirname+'/../electron/desktop-update-ipc.cjs','utf8');
const place=new Function(code.slice(code.indexOf('function centeredBounds('),code.indexOf('module.exports='))+';return centeredBounds;')();
test('update dialog centers on left monitor using desktop coordinates, including negative origins',()=>{
 assert.deepEqual(place({x:-1920,y:0,width:1920,height:1040},810,650),{x:-1365,y:195,width:810,height:650});
 assert.deepEqual(place({x:1920,y:-200,width:2560,height:1400},810,650),{x:2795,y:175,width:810,height:650});
 assert.deepEqual(place({x:-800,y:0,width:800,height:600},810,650),{x:-800,y:0,width:800,height:600});
});
test('reopening the update center uses the current WorkHub monitor and repositions the existing popup',()=>{
 const start=code.indexOf(' function open(){'),end=code.indexOf(" ipcMain.handle('desktop-update-install'",start);
 const method=code.slice(start,end);let ownerBounds={x:-1920,y:0,width:1900,height:1000},placed;
 const scope={host:()=>({getBounds:()=>ownerBounds}),displayFor:b=>({workArea:{x:b.x<0?-1920:0,y:0,width:1920,height:1040}}),centeredBounds:place,center:{isDestroyed:()=>false,setBounds:b=>placed=b,show(){},focus(){}}};
 vm.runInNewContext(method+';open();',scope);assert.equal(placed.x,-1365);
 ownerBounds={x:10,y:0,width:1800,height:1000};vm.runInNewContext('open()',scope);assert.equal(placed.x,555);
});
