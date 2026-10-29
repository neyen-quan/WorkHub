const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {safeAsset,serveDesktop}=require('../electron/desktop-runtime.cjs');
test('desktop assets retain the old origin and cannot escape their directory',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'workhub-server-test-'));
 await fs.writeFile(path.join(root,'index.html'),'<h1>Workhub</h1>');
 assert.equal(safeAsset(root,'/'),path.join(root,'index.html'));
 assert.throws(()=>safeAsset(root,'/%2e%2e%2fsecret'));
 const server=await serveDesktop(root);
 try {
  const r=await fetch('http://127.0.0.1:5173/');assert.equal(r.status,200);assert.match(await r.text(),/Workhub/);
  assert.equal((await fetch('http://127.0.0.1:5173/',{method:'POST'})).status,403);
  assert.equal((await fetch('http://127.0.0.1:5173/missing')).status,404);
  await assert.rejects(serveDesktop(root),{code:'EADDRINUSE'});
 } finally {await new Promise(resolve=>server.close(resolve));await fs.rm(root,{recursive:true});}
});
